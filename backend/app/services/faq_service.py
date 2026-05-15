from datetime import datetime, timezone
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from backend.app.models.faq import FAQ


def _doc_to_faq(doc: dict) -> FAQ:
    return FAQ(
        id=str(doc["_id"]),
        question=doc["question"],
        answer=doc["answer"],
        created_at=doc["created_at"],
    )


async def list_faqs(db: AsyncIOMotorDatabase) -> list[FAQ]:
    cursor = db["faqs"].find().sort("created_at", -1)
    return [_doc_to_faq(doc) async for doc in cursor]


async def create_faq(db: AsyncIOMotorDatabase, question: str, answer: str) -> FAQ:
    doc = {
        "question": question,
        "answer": answer,
        "created_at": datetime.now(timezone.utc),
    }
    result = await db["faqs"].insert_one(doc)
    doc["_id"] = result.inserted_id
    return _doc_to_faq(doc)


async def delete_faq(db: AsyncIOMotorDatabase, faq_id: str) -> bool:
    try:
        oid = ObjectId(faq_id)
    except Exception:
        return False
    result = await db["faqs"].delete_one({"_id": oid})
    return result.deleted_count == 1
