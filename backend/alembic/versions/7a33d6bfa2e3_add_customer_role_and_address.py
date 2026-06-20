"""add customer role and address

Revision ID: 7a33d6bfa2e3
Revises: 5a22c54ad243
Create Date: 2026-06-20 23:45:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '7a33d6bfa2e3'
down_revision: Union[str, None] = '5a22c54ad243'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # 1. Add 'Customer' to userrole enum in PostgreSQL
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE userrole ADD VALUE 'Customer'")

    # 2. Add 'address' column to customers table
    op.add_column('customers', sa.Column('address', sa.String(), nullable=True))

def downgrade() -> None:
    op.drop_column('customers', 'address')
