"""add confirmed to mo status

Revision ID: 5a22c54ad243
Revises: 40122b18e15e
Create Date: 2026-06-20 20:50:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '5a22c54ad243'
down_revision: Union[str, None] = '40122b18e15e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # PostgreSQL doesn't allow ALTER TYPE ... ADD VALUE inside a transaction.
    # We run it using the autocommit execution context block.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE manufacturingorderstatus ADD VALUE 'Confirmed'")

def downgrade() -> None:
    pass
