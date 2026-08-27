"""Resume file storage — S3-compatible object storage (Cloudflare R2 / AWS S3)
with a local-disk fallback for development before storage credentials exist.

The rest of the app never talks to boto3 or the filesystem directly. It stores
an opaque **storage key** (e.g. ``resumes/ab12cd34.pdf``) on the candidate row
and calls:

  * ``store_resume(content, filename)``  → key
  * ``read_resume(key)``                 → bytes   (Resume Parser Agent, downloads)
  * ``public_url(key)``                  → str|None (recruiter resume preview)

Whether a key lives in R2/S3 or on local disk is an implementation detail — the
key format is identical, so switching backends never requires a data migration
of the stored references.

Configure Cloudflare R2 by setting all of:
  R2_ACCOUNT_ID          (used to build the S3 API endpoint,
                          https://<account-id>.r2.cloudflarestorage.com)
  R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME

The bucket is private: files are always served back through the authenticated
backend ``GET /files/{key}`` route, never a public bucket URL.

If those are absent, files are written under LOCAL_STORAGE_DIR (default
``./storage``) and served via the same ``GET /files/{key}`` route — so local
development works with no R2 credentials.
"""
import os
import uuid
from pathlib import Path
from typing import Optional

ALLOWED_EXTENSIONS = {".pdf", ".docx"}
# Content types we serve local files back with, keyed by extension.
_CONTENT_TYPES = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
}
# Client-declared MIME types we accept on upload (a superset of what we serve,
# since some clients label .doc/.docx as legacy msword).
ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
}
# Hard cap on any single resume upload (10 MB), enforced server-side.
MAX_RESUME_BYTES = 10 * 1024 * 1024
# Magic-byte signatures per extension. Content sniffing means a renamed or
# spoofed file (e.g. an .exe saved as .pdf) can't slip past the extension/MIME
# check — validation holds regardless of what the client claims.
_MAGIC_SIGNATURES = {
    ".pdf": (b"%PDF",),
    ".docx": (b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08"),  # ZIP container
}
_KEY_PREFIX = "resumes"


class StorageError(Exception):
    """Raised when a file cannot be stored or retrieved.

    ``code`` lets callers map a rejection to the right HTTP status:
    ``file_too_large`` → 413, ``invalid_filetype`` → 400.
    """

    def __init__(self, message: str, *, code: str = "storage_error"):
        super().__init__(message)
        self.code = code


def _ext(filename: str) -> str:
    return Path(filename).suffix.lower()


def content_type_for(key: str) -> str:
    return _CONTENT_TYPES.get(_ext(key), "application/octet-stream")


def _use_s3() -> bool:
    return bool(
        os.environ.get("R2_ACCOUNT_ID")
        and os.environ.get("R2_ACCESS_KEY_ID")
        and os.environ.get("R2_SECRET_ACCESS_KEY")
        and os.environ.get("R2_BUCKET_NAME")
    )


def is_object_storage_configured() -> bool:
    """True when real S3/R2 object storage is wired up (vs. local-disk fallback)."""
    return _use_s3()


def _local_dir() -> Path:
    d = Path(os.environ.get("LOCAL_STORAGE_DIR", "storage")).resolve()
    d.mkdir(parents=True, exist_ok=True)
    return d


def _new_key(filename: str) -> str:
    """A collision-free, path-safe storage key that keeps the real extension."""
    ext = _ext(filename)
    return f"{_KEY_PREFIX}/{uuid.uuid4().hex}{ext}"


def _s3_client():
    # Imported lazily so the app runs without boto3 configured.
    import boto3
    from botocore.config import Config

    return boto3.client(
        "s3",
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
        # Cloudflare R2's S3 API endpoint is derived from the account id.
        endpoint_url=f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
        region_name="auto",
        config=Config(signature_version="s3v4"),
    )


# ── Public API ────────────────────────────────────────────────────────────

def validate_resume(
    content: bytes, filename: str, content_type: Optional[str] = None
) -> None:
    """Server-side gate for every resume upload, shared by all intake channels.

    Enforces (independent of any client-side check):
      * size ≤ 10 MB               → StorageError(code="file_too_large")
      * extension in {.pdf, .docx} → StorageError(code="invalid_filetype")
      * declared MIME (if any) allowed → StorageError(code="invalid_filetype")
      * magic bytes match the extension → StorageError(code="invalid_filetype")

    Raises :class:`StorageError` with a ``code`` callers translate to HTTP
    413/400. Returns ``None`` when the file is acceptable.
    """
    if len(content) > MAX_RESUME_BYTES:
        raise StorageError(
            f"Resume exceeds the {MAX_RESUME_BYTES // (1024 * 1024)}MB limit",
            code="file_too_large",
        )

    ext = _ext(filename)
    if ext not in ALLOWED_EXTENSIONS:
        raise StorageError(
            f"Unsupported resume file type: {ext or '(none)'} — PDF or DOCX only",
            code="invalid_filetype",
        )

    # Trust the extension over a client-declared MIME type, but reject a
    # content type that's positively wrong (some clients omit it entirely).
    if content_type:
        declared = content_type.split(";")[0].strip().lower()
        if declared and declared not in ALLOWED_CONTENT_TYPES:
            raise StorageError(
                f"Unsupported content type: {declared} — PDF or DOCX only",
                code="invalid_filetype",
            )

    # Content sniffing: the bytes themselves must look like the claimed type,
    # so a renamed .exe/.jpg can't pass by wearing a .pdf/.docx name.
    signatures = _MAGIC_SIGNATURES.get(ext, ())
    if signatures and not any(content.startswith(sig) for sig in signatures):
        raise StorageError(
            "File contents do not match a valid PDF or DOCX file",
            code="invalid_filetype",
        )


def store_resume(
    content: bytes, filename: str, content_type: Optional[str] = None
) -> str:
    """Persist raw resume bytes and return the storage key to save on the
    candidate row. Rejects anything that isn't a valid PDF/DOCX ≤ 10 MB."""
    validate_resume(content, filename, content_type)

    key = _new_key(filename)

    if _use_s3():
        client = _s3_client()
        client.put_object(
            Bucket=os.environ["R2_BUCKET_NAME"],
            Key=key,
            Body=content,
            ContentType=content_type_for(key),
        )
    else:
        dest = _local_dir() / key
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(content)

    return key


def read_resume(key: str) -> bytes:
    """Fetch stored bytes by key (used by the Resume Parser Agent and the
    recruiter download route)."""
    if _use_s3():
        client = _s3_client()
        try:
            obj = client.get_object(Bucket=os.environ["R2_BUCKET_NAME"], Key=key)
            return obj["Body"].read()
        except Exception as exc:  # noqa: BLE001 — surface a clean domain error
            raise StorageError(f"Could not read {key}: {exc}") from exc

    path = _safe_local_path(key)
    if not path.exists():
        raise StorageError(f"Resume not found: {key}")
    return path.read_bytes()


def public_url(key: Optional[str]) -> Optional[str]:
    """URL a recruiter's browser can open for a stored file.

    The R2 bucket is private, so both R2 and local-disk keys are served back
    through the authenticated backend ``GET /files/{key}`` route rather than a
    public bucket URL. The frontend fetches this path through its same-origin
    proxy so the auth cookie rides along."""
    if not key:
        return None
    backend = os.environ.get("BACKEND_URL", "http://localhost:7860")
    return f"{backend.rstrip('/')}/files/{key}"


def _safe_local_path(key: str) -> Path:
    """Resolve a key under the local storage dir, refusing path traversal."""
    base = _local_dir()
    candidate = (base / key).resolve()
    if base not in candidate.parents and candidate != base:
        raise StorageError("Invalid storage key")
    return candidate


# ── Avatar (profile picture) storage ────────────────────────────────────────

ALLOWED_AVATAR_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
ALLOWED_AVATAR_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
}
# Hard cap on any single avatar upload (5 MB).
MAX_AVATAR_BYTES = 5 * 1024 * 1024
_AVATAR_KEY_PREFIX = "avatars"
# Magic-byte signatures so a renamed/spoofed file can't pass as an image.
_AVATAR_MAGIC = {
    ".jpg": (b"\xff\xd8\xff",),
    ".jpeg": (b"\xff\xd8\xff",),
    ".png": (b"\x89PNG\r\n\x1a\n",),
    ".gif": (b"GIF87a", b"GIF89a"),
    ".webp": (b"RIFF",),  # RIFF....WEBP
}


def validate_avatar(
    content: bytes, filename: str, content_type: Optional[str] = None
) -> None:
    """Server-side gate for avatar uploads: size ≤ 5 MB, image extension/MIME,
    and magic-byte match. Raises :class:`StorageError` with a ``code`` callers
    map to HTTP 413/400."""
    if len(content) > MAX_AVATAR_BYTES:
        raise StorageError(
            f"Image exceeds the {MAX_AVATAR_BYTES // (1024 * 1024)}MB limit",
            code="file_too_large",
        )

    ext = _ext(filename)
    if ext not in ALLOWED_AVATAR_EXTENSIONS:
        raise StorageError(
            f"Unsupported image type: {ext or '(none)'} — JPG, PNG, WEBP or GIF only",
            code="invalid_filetype",
        )

    if content_type:
        declared = content_type.split(";")[0].strip().lower()
        if declared and declared not in ALLOWED_AVATAR_CONTENT_TYPES:
            raise StorageError(
                f"Unsupported content type: {declared} — images only",
                code="invalid_filetype",
            )

    signatures = _AVATAR_MAGIC.get(ext, ())
    if signatures and not any(content.startswith(sig) for sig in signatures):
        raise StorageError(
            "File contents do not match a valid image",
            code="invalid_filetype",
        )


def store_avatar(
    content: bytes, filename: str, content_type: Optional[str] = None
) -> str:
    """Persist a profile-picture image and return its storage key. Rejects
    anything that isn't a valid image ≤ 5 MB."""
    validate_avatar(content, filename, content_type)

    ext = _ext(filename)
    key = f"{_AVATAR_KEY_PREFIX}/{uuid.uuid4().hex}{ext}"

    if _use_s3():
        client = _s3_client()
        client.put_object(
            Bucket=os.environ["R2_BUCKET_NAME"],
            Key=key,
            Body=content,
            ContentType=content_type_for(key),
        )
    else:
        dest = _local_dir() / key
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(content)

    return key


def read_file(key: str) -> bytes:
    """Fetch stored bytes by key for any stored object (resumes or avatars)."""
    if _use_s3():
        client = _s3_client()
        try:
            obj = client.get_object(Bucket=os.environ["R2_BUCKET_NAME"], Key=key)
            return obj["Body"].read()
        except Exception as exc:  # noqa: BLE001 — surface a clean domain error
            raise StorageError(f"Could not read {key}: {exc}") from exc

    path = _safe_local_path(key)
    if not path.exists():
        raise StorageError(f"File not found: {key}")
    return path.read_bytes()
