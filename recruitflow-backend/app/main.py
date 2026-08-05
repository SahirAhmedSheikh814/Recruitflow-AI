import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.db.session import create_db_and_tables
import app.models  # noqa: F401 — registers all tables with SQLModel metadata
from app.agents.llm_config import configure_llm
from app.api import auth, jobs, applications, interviews, admin, ats, analytics, files, recruiter
from app.workers import scheduler

logger = logging.getLogger("recruitflow.main")

# Local dev origins for the three portals. Production frontend domains are added
# via the FRONTEND_ORIGINS env var (comma-separated) on the Railway service.
_DEFAULT_ORIGINS = [
    "http://localhost:3000",  # combined dev frontend (legacy)
    "http://localhost:3001",  # Candidate Portal
    "http://localhost:3002",  # Recruiter Dashboard
    "http://localhost:3003",  # Admin Portal
]


def _allowed_origins() -> list[str]:
    extra = [o.strip() for o in os.environ.get("FRONTEND_ORIGINS", "").split(",") if o.strip()]
    # De-duplicate while preserving order.
    return list(dict.fromkeys(_DEFAULT_ORIGINS + extra))

@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    # Wire the Agents SDK to OpenRouter once at startup so a misconfiguration
    # surfaces in the boot log, not mid-run. Non-fatal: the non-agent endpoints
    # (auth, jobs, public site) must still boot even if the LLM key is absent.
    try:
        configure_llm()
    except RuntimeError as exc:
        logger.warning("LLM not configured — agent runs will fail: %s", exc)
    scheduler.start()  # intake pollers — dormant until channel credentials exist
    yield
    await scheduler.stop()

app = FastAPI(title="RecruitFlow AI", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(jobs.router, prefix="/jobs", tags=["jobs"])
app.include_router(applications.router, prefix="/applications", tags=["applications"])
app.include_router(interviews.router, prefix="/interviews", tags=["interviews"])
app.include_router(recruiter.router, prefix="/recruiter", tags=["recruiter"])
app.include_router(admin.router, prefix="/admin", tags=["admin"])
app.include_router(ats.router, prefix="/ats", tags=["ats"])
app.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
app.include_router(files.router, prefix="/files", tags=["files"])

@app.get("/health")
def health():
    return {"status": "ok"}
