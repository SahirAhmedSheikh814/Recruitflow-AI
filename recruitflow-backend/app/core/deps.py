import uuid
from typing import Optional

from fastapi import Depends, HTTPException, Cookie, Header
from sqlmodel import Session

from app.db.session import get_session
from app.models.user import User, UserRole
from app.core.security import decode_token


# Maps the X-Portal header a frontend sends to the role whose cookie it should use.
_PORTAL_TO_ROLE = {
    "candidate": "candidate",
    "recruiter": "recruiter",
    "admin": "admin",
}


def _select_access_token(
    portal: Optional[str],
    candidate_access_token: Optional[str],
    recruiter_access_token: Optional[str],
    admin_access_token: Optional[str],
) -> Optional[str]:
    """Choose which portal-scoped access-token cookie to trust for this request.

    Each portal (candidate/recruiter/admin) has its own cookie namespace so their
    sessions don't overwrite each other in a shared browser. The frontend tells us
    which portal it is via the ``X-Portal`` header. When the header is absent (e.g.
    a direct browser navigation or an older client), we fall back to whichever
    single portal cookie is present, preserving prior behaviour.
    """
    by_portal = {
        "candidate": candidate_access_token,
        "recruiter": recruiter_access_token,
        "admin": admin_access_token,
    }
    if portal in by_portal:
        return by_portal[portal]
    # No/unknown portal hint → use the only cookie present, if unambiguous.
    present = [t for t in by_portal.values() if t]
    if len(present) == 1:
        return present[0]
    return None


def get_current_user(
    x_portal: Optional[str] = Header(None),
    candidate_access_token: Optional[str] = Cookie(None),
    recruiter_access_token: Optional[str] = Cookie(None),
    admin_access_token: Optional[str] = Cookie(None),
    session: Session = Depends(get_session),
) -> User:
    access_token = _select_access_token(
        x_portal, candidate_access_token, recruiter_access_token, admin_access_token
    )
    if not access_token:
        raise HTTPException(401, "Not authenticated")
    payload = decode_token(access_token)
    if not payload or payload.get("type") != "access":
        raise HTTPException(401, "Invalid token")
    user = session.get(User, uuid.UUID(payload["sub"]))
    if not user or not user.is_active:
        raise HTTPException(401, "User not found")
    return user


def get_optional_user(
    x_portal: Optional[str] = Header(None),
    candidate_access_token: Optional[str] = Cookie(None),
    recruiter_access_token: Optional[str] = Cookie(None),
    admin_access_token: Optional[str] = Cookie(None),
    session: Session = Depends(get_session),
) -> Optional[User]:
    """Like get_current_user but returns None instead of raising when there is
    no valid session. Used by endpoints that work for both guests and logged-in
    users (e.g. the public apply flow)."""
    access_token = _select_access_token(
        x_portal, candidate_access_token, recruiter_access_token, admin_access_token
    )
    if not access_token:
        return None
    payload = decode_token(access_token)
    if not payload or payload.get("type") != "access":
        return None
    user = session.get(User, uuid.UUID(payload["sub"]))
    if not user or not user.is_active:
        return None
    return user


def require_role(*roles: UserRole):
    def dep(user: User = Depends(get_current_user)):
        if user.role not in roles:
            raise HTTPException(403, "Forbidden")
        return user
    return dep
