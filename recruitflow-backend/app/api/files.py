"""File serving for locally-stored resumes.

When object storage (R2/S3) is configured, resume files are served directly from
the bucket's public/CDN URL and this route is unused. Before those credentials
exist, resumes live on local disk and recruiters download them through here.

Access is restricted to recruiters/admins — candidate resumes are not public.
"""
import uuid
from typing import Optional

from fastapi import APIRouter, Cookie, Depends, HTTPException
from fastapi.responses import Response
from sqlmodel import Session

from app.core.security import decode_token
from app.db.session import get_session
from app.models.user import User, UserRole
from app.services import storage_service

router = APIRouter()


def require_file_viewer(
    recruiter_access_token: Optional[str] = Cookie(None),
    admin_access_token: Optional[str] = Cookie(None),
    session: Session = Depends(get_session),
) -> User:
    """Authorize a recruiter/admin to view a resume via direct browser navigation.

    Resumes open in a new browser tab (an ``<a href>`` / window open), so the
    request carries no ``X-Portal`` header and the shared cookie-selection logic
    would treat multiple portal cookies as ambiguous and reject it (401). Here we
    read the recruiter/admin cookies directly — the only roles allowed to view
    resumes — so viewing works regardless of which other portal cookies exist.
    """
    token = recruiter_access_token or admin_access_token
    if not token:
        raise HTTPException(401, "Not authenticated")
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        raise HTTPException(401, "Invalid token")
    user = session.get(User, uuid.UUID(payload["sub"]))
    if not user or not user.is_active:
        raise HTTPException(401, "User not found")
    if user.role not in (UserRole.recruiter, UserRole.admin):
        raise HTTPException(403, "Forbidden")
    return user


@router.get("/avatars/{name}")
def get_avatar(name: str):
    """Serve a profile-picture image. Avatars carry unguessable UUID names and
    are low-sensitivity, so this route is unauthenticated — an ``<img>`` tag in
    any of the three portals can load it without sending a portal cookie."""
    if storage_service.is_object_storage_configured():
        # Files are served from the bucket, not here.
        raise HTTPException(404, "Not found")
    key = f"avatars/{name}"
    try:
        data = storage_service.read_file(key)
    except storage_service.StorageError:
        raise HTTPException(404, "File not found")
    return Response(
        content=data,
        media_type=storage_service.content_type_for(key),
        headers={"Content-Disposition": f'inline; filename="{name}"'},
    )


@router.get("/{key:path}")
def get_file(
    key: str,
    _=Depends(require_file_viewer),
):
    if storage_service.is_object_storage_configured():
        # Files are served from the bucket, not here.
        raise HTTPException(404, "Not found")
    try:
        data = storage_service.read_resume(key)
    except storage_service.StorageError:
        raise HTTPException(404, "File not found")
    return Response(
        content=data,
        media_type=storage_service.content_type_for(key),
        headers={"Content-Disposition": f'inline; filename="{key.split("/")[-1]}"'},
    )
