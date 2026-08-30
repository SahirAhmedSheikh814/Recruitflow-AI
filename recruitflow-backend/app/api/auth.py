import os
import uuid
import secrets
from datetime import datetime, timedelta
from typing import Optional
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Response, Request, Cookie, Header, UploadFile, File, status
from fastapi.responses import RedirectResponse
from jose import jwt, JWTError
from pydantic import BaseModel, EmailStr
from sqlmodel import Session, select

from app.db.session import get_session
from app.models.user import User, UserRole
from app.core.security import (
    hash_password, verify_password,
    create_access_token, create_refresh_token, decode_token,
    SECRET_KEY, ALGORITHM,
)
from app.core.deps import get_current_user, require_role  # single source of truth
from app.core.rate_limit import check_auth_rate_limit
from app.services import google_oauth
from app.services import storage_service

router = APIRouter()

# Secure cookies over HTTPS in production; relaxed for local HTTP dev.
COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "true").lower() == "true"
COOKIE_OPTS = dict(httponly=True, secure=COOKIE_SECURE, samesite="lax")

FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")


# ── Environment-aware frontend origin resolution ──────────────────────────
#
# After Google OAuth we must send the browser back to the frontend it started
# on — the LOCAL portal during local dev, the production Vercel portal in prod.
# The old code always used the static FRONTEND_URL env var, so a backend whose
# .env pointed at production would bounce a local sign-in to the live site.
#
# Instead we capture the origin the flow began on (from the proxy-forwarded
# host / Origin / Referer of the /auth/google request), validate it against an
# allowlist, sign it into the OAuth `state`, and read it back on callback. This
# changes only the redirect *target* — token generation, cookies, and the CSRF
# state signature/expiry are all untouched. When no trusted origin is available
# we fall back to FRONTEND_URL, preserving the previous behaviour exactly.

# Loopback origins are always safe redirect targets (the user's own machine).
_LOCAL_ORIGINS = {
    "http://localhost:3000",
    "http://127.0.0.1:3000",
}


def _allowed_frontend_origins() -> set[str]:
    """Origins we are willing to redirect the browser back to after OAuth.

    The configured production URL, common local-dev hosts, plus anything listed
    in ALLOWED_FRONTEND_ORIGINS (comma-separated) — so new environments need no
    code change.
    """
    origins = {FRONTEND_URL.rstrip("/")}
    origins.update(_LOCAL_ORIGINS)
    for extra in os.environ.get("ALLOWED_FRONTEND_ORIGINS", "").split(","):
        cleaned = extra.strip().rstrip("/")
        if cleaned:
            origins.add(cleaned)
    return origins


def _origin_from_request(request: Request) -> Optional[str]:
    """Best-effort frontend origin for THIS request.

    Prefers the host the Next.js `/backend` rewrite forwards (`X-Forwarded-*`),
    then a same-origin `Origin`, then the `Referer`'s origin. Returns None when
    nothing usable is present.
    """
    xf_host = request.headers.get("x-forwarded-host")
    if xf_host:
        host = xf_host.split(",")[0].strip()
        proto = request.headers.get("x-forwarded-proto", "https").split(",")[0].strip()
        if host:
            return f"{proto}://{host}"
    origin = request.headers.get("origin")
    if origin:
        return origin.rstrip("/")
    referer = request.headers.get("referer")
    if referer:
        parsed = urlparse(referer)
        if parsed.scheme and parsed.netloc:
            return f"{parsed.scheme}://{parsed.netloc}"
    return None


def _resolve_frontend_origin(candidate: Optional[str]) -> str:
    """Return `candidate` only if it is allowlisted, else the FRONTEND_URL default."""
    if candidate:
        cleaned = candidate.rstrip("/")
        if cleaned in _allowed_frontend_origins():
            return cleaned
    return FRONTEND_URL.rstrip("/")


class SignupRequest(BaseModel):
    email: str
    password: str
    full_name: str


class LoginRequest(BaseModel):
    email: str
    password: str


def _cookie_names_for_role(role: UserRole) -> tuple[str, str]:
    """Return (access_cookie_name, refresh_cookie_name) scoped to this role.

    Each portal type gets its own cookie namespace so candidate, recruiter, and
    admin sessions can coexist in the same browser without overwriting each other.
    """
    prefix = role.value  # "candidate", "recruiter", or "admin"
    return (f"{prefix}_access_token", f"{prefix}_refresh_token")


def _set_tokens(response: Response, user: User):
    access = create_access_token(str(user.id), user.role)
    refresh = create_refresh_token(str(user.id))
    access_name, refresh_name = _cookie_names_for_role(user.role)
    response.set_cookie(access_name, access, max_age=15 * 60, **COOKIE_OPTS)
    response.set_cookie(refresh_name, refresh, max_age=7 * 24 * 3600, **COOKIE_OPTS)
    return {"id": str(user.id), "role": user.role, "full_name": user.full_name}


@router.post("/signup", status_code=201, dependencies=[Depends(check_auth_rate_limit)])
def signup(body: SignupRequest, response: Response, session: Session = Depends(get_session)):
    # Public signup ALWAYS creates a candidate. Recruiters are created by admins
    # (POST /admin/recruiters); the initial admin is seeded via scripts/seed_admin.py.
    if session.exec(select(User).where(User.email == body.email)).first():
        raise HTTPException(400, "Email already registered")
    user = User(
        email=body.email,
        password_hash=hash_password(body.password),
        full_name=body.full_name,
        role=UserRole.candidate,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return _set_tokens(response, user)


@router.post("/login", dependencies=[Depends(check_auth_rate_limit)])
def login(body: LoginRequest, response: Response, session: Session = Depends(get_session)):
    user = session.exec(select(User).where(User.email == body.email)).first()
    if not user or not verify_password(body.password, user.password_hash or ""):
        raise HTTPException(401, "Invalid credentials")
    if not user.is_active:
        raise HTTPException(403, "Account disabled")
    return _set_tokens(response, user)


@router.post("/refresh", dependencies=[Depends(check_auth_rate_limit)])
def refresh(
    response: Response,
    x_portal: Optional[str] = Header(None),
    candidate_refresh_token: Optional[str] = Cookie(None),
    recruiter_refresh_token: Optional[str] = Cookie(None),
    admin_refresh_token: Optional[str] = Cookie(None),
    session: Session = Depends(get_session),
):
    """Refresh the access token using the appropriate role-scoped refresh cookie.

    Several portal refresh cookies can be present in one browser at once, so we
    use the ``X-Portal`` header to pick the right one — otherwise we'd refresh the
    wrong session. With no header we fall back to whichever single cookie exists.
    """
    by_portal = {
        "candidate": candidate_refresh_token,
        "recruiter": recruiter_refresh_token,
        "admin": admin_refresh_token,
    }
    if x_portal in by_portal:
        refresh_token = by_portal[x_portal]
    else:
        present = [t for t in by_portal.values() if t]
        refresh_token = present[0] if len(present) == 1 else None
    if not refresh_token:
        raise HTTPException(401, "No refresh token")
    payload = decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(401, "Invalid refresh token")
    user = session.get(User, uuid.UUID(payload["sub"]))
    if not user or not user.is_active:
        raise HTTPException(401, "User not found")
    return _set_tokens(response, user)


@router.post("/logout")
def logout(response: Response):
    """Clear all three portal-scoped cookie pairs so logout works regardless of role."""
    for role in [UserRole.candidate, UserRole.recruiter, UserRole.admin]:
        access_name, refresh_name = _cookie_names_for_role(role)
        # Mirror the attributes the cookies were set with (path, samesite, secure,
        # httponly). A delete_cookie whose attributes don't match the original may
        # be ignored by the browser, leaving a stale token that still passes the
        # portal's route guard after sign-out.
        response.delete_cookie(access_name, **COOKIE_OPTS)
        response.delete_cookie(refresh_name, **COOKIE_OPTS)
    return {"message": "Logged out"}


# ── Google OAuth 2.0 ──────────────────────────────────────────────────────

def _make_state(origin: Optional[str] = None) -> str:
    """Short-lived signed state token for CSRF protection.

    Optionally carries the frontend `origin` the flow began on so the callback
    can return the browser to the right environment. The origin is signed (not
    just passed in the URL), so it cannot be tampered with.
    """
    expire = datetime.utcnow() + timedelta(minutes=10)
    payload: dict = {"exp": expire, "nonce": secrets.token_hex(8)}
    if origin:
        payload["origin"] = origin
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def _decode_state(state: str) -> Optional[dict]:
    """Return the decoded state payload, or None if invalid/expired."""
    try:
        return jwt.decode(state, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None


@router.get("/google", dependencies=[Depends(check_auth_rate_limit)])
def google_login(request: Request):
    """Redirect the browser to Google's consent screen."""
    if not google_oauth.is_configured():
        raise HTTPException(503, "Google OAuth is not configured")
    # Remember (allowlisted) where the flow started so the callback returns here.
    origin = _resolve_frontend_origin(_origin_from_request(request))
    state = _make_state(origin)
    url = google_oauth.build_authorization_url(state)
    return RedirectResponse(url)


@router.get("/google/callback")
async def google_callback(
    request: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    session: Session = Depends(get_session),
):
    """Google redirects here after the user grants (or denies) consent."""
    payload = _decode_state(state) if state else None
    # Prefer the origin captured (and allowlisted) at flow start; fall back to
    # this request's own headers, then the FRONTEND_URL default.
    state_origin = payload.get("origin") if isinstance(payload, dict) else None
    frontend_url = _resolve_frontend_origin(state_origin or _origin_from_request(request))

    if error or not code or not state:
        return RedirectResponse(f"{frontend_url}/login?error=google_denied")

    if payload is None:
        return RedirectResponse(f"{frontend_url}/login?error=invalid_state")

    try:
        tokens = await google_oauth.exchange_code(code)
        profile = await google_oauth.fetch_userinfo(tokens["access_token"])
    except Exception:
        return RedirectResponse(f"{frontend_url}/login?error=google_failed")

    google_id: str = profile.get("sub", "")
    email: str = profile.get("email", "")
    full_name: str = profile.get("name", email)
    picture: str = profile.get("picture", "") or ""

    if not google_id or not email:
        return RedirectResponse(f"{frontend_url}/login?error=google_no_email")

    # Find existing user by google_id or email; create if new.
    user = session.exec(select(User).where(User.google_id == google_id)).first()
    if not user:
        user = session.exec(select(User).where(User.email == email)).first()

    if user:
        # Link google_id if they previously signed up with email/password.
        changed = False
        if not user.google_id:
            user.google_id = google_id
            changed = True
        # Keep the Google avatar in sync unless the user set their own picture.
        if picture and not user.picture_url:
            user.picture_url = picture
            changed = True
        if changed:
            session.add(user)
            session.commit()
            session.refresh(user)
        if not user.is_active:
            return RedirectResponse(f"{frontend_url}/login?error=account_disabled")
    else:
        user = User(
            email=email,
            full_name=full_name,
            google_id=google_id,
            picture_url=picture or None,
            role=UserRole.candidate,
        )
        session.add(user)
        session.commit()
        session.refresh(user)

    # Issue our own JWT cookies and redirect to the candidate portal. Google
    # login always yields a candidate, so use the candidate-scoped cookie names.
    response = RedirectResponse(f"{frontend_url}/portal")
    access = create_access_token(str(user.id), user.role)
    refresh = create_refresh_token(str(user.id))
    access_name, refresh_name = _cookie_names_for_role(user.role)
    response.set_cookie(access_name, access, max_age=15 * 60, **COOKIE_OPTS)
    response.set_cookie(refresh_name, refresh, max_age=7 * 24 * 3600, **COOKIE_OPTS)
    return response


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return {
        "id": str(user.id),
        "role": user.role,
        "full_name": user.full_name,
        "email": user.email,
        "picture_url": user.picture_url,
        "gender": user.gender,
    }


class ProfileUpdate(BaseModel):
    gender: Optional[str] = None


@router.patch("/profile")
def update_profile(
    body: ProfileUpdate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Update editable profile fields on the current user (currently gender,
    used to pick a default avatar when no photo is set)."""
    if body.gender is not None:
        g = body.gender.strip().lower()
        if g not in ("male", "female", ""):
            raise HTTPException(400, "gender must be 'male', 'female', or empty")
        user.gender = g or None
        user.updated_at = datetime.utcnow()
        session.add(user)
        session.commit()
        session.refresh(user)
    return {
        "id": str(user.id),
        "role": user.role,
        "full_name": user.full_name,
        "email": user.email,
        "picture_url": user.picture_url,
        "gender": user.gender,
    }


@router.post("/profile/picture")
async def upload_profile_picture(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Upload/replace the current user's profile picture.

    Stores the image via the shared storage service (object storage or local
    disk) and saves a browser-openable URL on ``users.picture_url``.
    """
    content = await file.read()
    try:
        key = storage_service.store_avatar(
            content, file.filename or "avatar", file.content_type
        )
    except storage_service.StorageError as exc:
        status_code = 413 if exc.code == "file_too_large" else 400
        raise HTTPException(status_code, str(exc))

    url = storage_service.public_url(key)
    user.picture_url = url
    user.updated_at = datetime.utcnow()
    session.add(user)
    session.commit()
    session.refresh(user)
    return {
        "id": str(user.id),
        "role": user.role,
        "full_name": user.full_name,
        "email": user.email,
        "picture_url": user.picture_url,
        "gender": user.gender,
    }
