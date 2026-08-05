"""Seed the initial admin account.

Usage:
    python -m scripts.seed_admin admin@example.com "Strong Password" "Admin Name"

Run once after the database is migrated. The admin can then create recruiters
via POST /admin/recruiters. Public signup can only ever create candidates.
"""
import sys
from dotenv import load_dotenv
load_dotenv()

from sqlmodel import Session, select
from app.db.session import engine
import app.models  # noqa: F401 — register tables
from app.models.user import User, UserRole
from app.core.security import hash_password


def main():
    if len(sys.argv) != 4:
        print(__doc__)
        sys.exit(1)
    email, password, full_name = sys.argv[1], sys.argv[2], sys.argv[3]
    with Session(engine) as session:
        if session.exec(select(User).where(User.email == email)).first():
            print(f"User {email} already exists — aborting.")
            sys.exit(1)
        admin = User(
            email=email,
            password_hash=hash_password(password),
            full_name=full_name,
            role=UserRole.admin,
        )
        session.add(admin)
        session.commit()
        session.refresh(admin)
        print(f"Created admin {email} (id={admin.id})")


if __name__ == "__main__":
    main()
