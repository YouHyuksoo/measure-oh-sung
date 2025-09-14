"""add barcode scanner device type

Revision ID: c4fb5e4593db
Revises: 6f0b66e7e62b
Create Date: 2025-09-14 15:39:09.821742

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c4fb5e4593db'
down_revision: Union[str, None] = '6f0b66e7e62b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
