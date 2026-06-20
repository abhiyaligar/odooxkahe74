import asyncio
import pytest
from typing import AsyncGenerator
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.types import CHAR

# Patch UUID compilation for SQLite compatibility
@compiles(UUID, "sqlite")
def compile_uuid_sqlite(type_, compiler, **kw):
    return "CHAR(36)"

from app.main import app
from app.db.base import Base
from app.db.session import get_db

# Use in-memory SQLite for testing
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False}
)

TestingSessionLocal = async_sessionmaker(
    bind=engine,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)

# Run migrations/create tables on startup of test session
@pytest.fixture(scope="session", autouse=True)
def event_loop():
    """Create an instance of the default event loop for each test case."""
    policy = asyncio.get_event_loop_policy()
    res_loop = policy.new_event_loop()
    yield res_loop
    res_loop.close()

@pytest.fixture(scope="session", autouse=True)
async def setup_db():
    async with engine.begin() as conn:
        # Create all tables in SQLite
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        # Tear down all tables in SQLite
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()

@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Provides an isolated database session per test, rolled back at the end."""
    async with TestingSessionLocal() as session:
        yield session
        await session.rollback()

@pytest.fixture(autouse=True)
def override_db_dependency(db_session: AsyncSession):
    """Overrides the FastAPI get_db dependency to use the test session."""
    async def _get_test_db():
        yield db_session

    app.dependency_overrides[get_db] = _get_test_db
    yield
    app.dependency_overrides.pop(get_db, None)

@pytest.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    """Provides an HTTPX AsyncClient bound to the FastAPI application."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as ac:
        yield ac
