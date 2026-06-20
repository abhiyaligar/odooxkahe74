from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.core.config import settings

ASYNC_DB_URL = settings.DB_URL
if ASYNC_DB_URL.startswith("postgresql://"):
    ASYNC_DB_URL = ASYNC_DB_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
elif ASYNC_DB_URL.startswith("postgres://"):
    ASYNC_DB_URL = ASYNC_DB_URL.replace("postgres://", "postgresql+asyncpg://", 1)

engine = create_async_engine(ASYNC_DB_URL, echo=True)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)

async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
