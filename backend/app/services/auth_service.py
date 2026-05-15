from datetime import datetime, timezone
import bcrypt
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from backend.app.models.user import UserInDB


def _doc_to_user(doc: dict) -> UserInDB:
    return UserInDB(
        id=str(doc["_id"]),
        username=doc["username"],
        hashed_password=doc["hashed_password"],
        created_at=doc["created_at"],
    )


async def register(db: AsyncIOMotorDatabase, username: str, plain_password: str) -> UserInDB:
    existing = await db["users"].find_one({"username": username})
    if existing:
        raise ValueError("Username already exists")
    hashed = bcrypt.hashpw(plain_password.encode(), bcrypt.gensalt(rounds=12)).decode()
    doc = {
        "username": username,
        "hashed_password": hashed,
        "created_at": datetime.now(timezone.utc),
    }
    result = await db["users"].insert_one(doc)
    doc["_id"] = result.inserted_id
    return _doc_to_user(doc)


async def authenticate(db: AsyncIOMotorDatabase, username: str, plain_password: str) -> UserInDB | None:
    doc = await db["users"].find_one({"username": username})
    if not doc:
        return None
    if not bcrypt.checkpw(plain_password.encode(), doc["hashed_password"].encode()):
        return None
    return _doc_to_user(doc)


async def get_by_username(db: AsyncIOMotorDatabase, username: str) -> UserInDB | None:
    doc = await db["users"].find_one({"username": username})
    if not doc:
        return None
    return _doc_to_user(doc)
