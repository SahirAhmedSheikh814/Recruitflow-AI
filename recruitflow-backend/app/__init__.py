"""RecruitFlow AI backend package.

Load environment variables from a local ``.env`` file as early as possible —
before any submodule (``app.db.session``, services, workers) reads
``os.environ``. Running the app as ``uvicorn app.main:app`` imports this package
first, so the variables are present by the time ``DATABASE_URL`` is accessed.
In deployed environments (Hugging Face Spaces) the real env vars are already
set, so ``load_dotenv`` is a no-op there.
"""

from dotenv import load_dotenv

load_dotenv()
