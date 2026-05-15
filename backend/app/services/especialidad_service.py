from datetime import datetime, timezone
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.models.especialidad import Especialidad


def _doc_to_especialidad(doc: dict) -> Especialidad:
    return Especialidad(
        id=str(doc["_id"]),
        nombre=doc["nombre"],
        descripcion=doc.get("descripcion", ""),
        updated_at=doc.get("updated_at"),
    )


async def list_especialidades(db: AsyncIOMotorDatabase) -> list[Especialidad]:
    cursor = db["especialidades"].find().sort("nombre", 1)
    return [_doc_to_especialidad(doc) async for doc in cursor]


async def update_especialidad(db: AsyncIOMotorDatabase, item_id: str, descripcion: str) -> Especialidad | None:
    try:
        oid = ObjectId(item_id)
    except Exception:
        return None
    doc = await db["especialidades"].find_one_and_update(
        {"_id": oid},
        {"$set": {"descripcion": descripcion, "updated_at": datetime.now(timezone.utc)}},
        return_document=True,
    )
    if not doc:
        return None
    return _doc_to_especialidad(doc)


async def sync_especialidades(db: AsyncIOMotorDatabase, names: list[str]) -> int:
    names = [n.strip() for n in names if n.strip()]
    if not names:
        return 0

    existing_docs = await db["especialidades"].find({"nombre": {"$in": names}}).to_list(None)
    existing_names = {doc["nombre"] for doc in existing_docs}

    new_names = [n for n in names if n not in existing_names]
    if new_names:
        now = datetime.now(timezone.utc)
        await db["especialidades"].insert_many(
            [{"nombre": n, "descripcion": "", "updated_at": now} for n in new_names],
            ordered=False,
        )

    await db["especialidades"].delete_many({"nombre": {"$nin": names}})
    return len(names)
