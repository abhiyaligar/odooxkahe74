"""add_email_verification_table

Revision ID: 8d123bfa4e23
Revises: 4f63d505529b
Create Date: 2026-06-21 07:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8d123bfa4e23'
down_revision: Union[str, None] = '4f63d505529b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create the Enum for VerificationType only if not exists
    verification_type_enum = sa.Enum('EmailVerification', 'PasswordReset', name='verificationtype', create_type=False)

    # Create verification_codes table
    op.create_table('verification_codes',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('code', sa.String(), nullable=False),
        sa.Column('type', verification_type_enum, nullable=False),
        sa.Column('is_used', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_verification_codes_id'), 'verification_codes', ['id'], unique=False)
    op.create_index(op.f('ix_verification_codes_email'), 'verification_codes', ['email'], unique=False)

    # Add is_email_verified to users
    op.add_column('users', sa.Column('is_email_verified', sa.Boolean(), server_default='false', nullable=False))


def downgrade() -> None:
    # Drop is_email_verified column from users
    op.drop_column('users', 'is_email_verified')

    # Drop verification_codes table
    op.drop_index(op.f('ix_verification_codes_email'), table_name='verification_codes')
    op.drop_index(op.f('ix_verification_codes_id'), table_name='verification_codes')
    op.drop_table('verification_codes')

    # Drop the Enum for VerificationType
    verification_type_enum = sa.Enum('EmailVerification', 'PasswordReset', name='verificationtype')
    verification_type_enum.drop(op.get_bind(), checkfirst=True)
