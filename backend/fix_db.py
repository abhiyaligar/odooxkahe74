import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from app.core.config import settings
from sqlalchemy import text

async def main():
    engine = create_async_engine(settings.DB_URL)
    async with engine.begin() as conn:
        await conn.execute(text("DROP TABLE IF EXISTS products CASCADE;"))
        await conn.execute(text("DROP TABLE IF EXISTS vendors CASCADE;"))
        await conn.execute(text("DROP TABLE IF EXISTS boms CASCADE;"))
        await conn.execute(text("DROP TYPE IF EXISTS producttype CASCADE;"))
        await conn.execute(text("DROP TYPE IF EXISTS procurementstrategy CASCADE;"))
        await conn.execute(text("DROP TYPE IF EXISTS procurementtype CASCADE;"))
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
