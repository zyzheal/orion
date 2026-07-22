"""Initial migration - empty baseline

Revision ID: 001_initial
Revises:
Create Date: 2026-05-15

This is the initial migration for orion-intelligence-svc.
Currently no tables are required as the service uses external AI APIs
and caches results in Redis.

Future migrations should add tables when local storage is needed.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create initial schema.

    Note: This service does not require local database tables currently.
    All data is processed via LLM APIs and cached in Redis.
    """
    # No tables defined yet - service uses external services
    # - PostgreSQL: connection pool for async operations
    # - ClickHouse: analytics data (read-only)
    # - Redis: caching and session storage
    pass


def downgrade() -> None:
    """Remove initial schema."""
    pass