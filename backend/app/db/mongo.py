import logging
from contextlib import asynccontextmanager
from fastapi import HTTPException
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from backend.app.config.settings import settings

logger = logging.getLogger(__name__)

_client: AsyncIOMotorClient | None = None
_db_available: bool = False


@asynccontextmanager
async def lifespan(app):
    global _client, _db_available
    _client = AsyncIOMotorClient(settings.MONGODB_URL, serverSelectionTimeoutMS=5000)
    db = _client[settings.MONGODB_DB_NAME]
    try:
        await db["users"].create_index("username", unique=True)
        await db["especialidades"].create_index("nombre", unique=True)
        await db["faqs"].create_index([("created_at", -1)])
        _db_available = True
        logger.info("MongoDB connected — %s", settings.MONGODB_DB_NAME)
    except Exception as e:
        _db_available = False
        logger.error("MongoDB unavailable — app running without DB: %s", type(e).__name__)
    yield
    _client.close()
    _db_available = False


async def get_database() -> AsyncIOMotorDatabase:
    if not _db_available or _client is None:
        raise HTTPException(status_code=503, detail="database_unavailable")
    return _client[settings.MONGODB_DB_NAME]
