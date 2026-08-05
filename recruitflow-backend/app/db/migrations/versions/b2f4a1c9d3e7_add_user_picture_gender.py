"""add user picture_url and gender

Revision ID: b2f4a1c9d3e7
Revises: 1c27c78fde99
Create Date: 2026-08-05

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = 'b2f4a1c9d3e7'
down_revision: Union[str, Sequence[str], None] = '1c27c78fde99'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('users', sa.Column('picture_url', sqlmodel.sql.sqltypes.AutoString(), nullable=True))
    op.add_column('users', sa.Column('gender', sqlmodel.sql.sqltypes.AutoString(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'gender')
    op.drop_column('users', 'picture_url')
