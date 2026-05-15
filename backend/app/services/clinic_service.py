from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorDatabase
from backend.app.models.clinic import ClinicInfo


def _doc_to_clinic(doc: dict) -> ClinicInfo:
    return ClinicInfo(
        descripcion=doc.get("descripcion", ""),
        direccion=doc.get("direccion", ""),
        ubicacion_url=doc.get("ubicacion_url", ""),
        pagina_web=doc.get("pagina_web", ""),
        updated_at=doc.get("updated_at"),
    )


async def get_clinic(db: AsyncIOMotorDatabase) -> ClinicInfo:
    doc = await db["clinic_info"].find_one()
    if not doc:
        empty = {
            "descripcion": "",
            "direccion": "",
            "ubicacion_url": "",
            "pagina_web": "",
            "updated_at": datetime.now(timezone.utc),
        }
        await db["clinic_info"].insert_one(empty)
        return _doc_to_clinic(empty)
    return _doc_to_clinic(doc)


async def update_clinic(db: AsyncIOMotorDatabase, data: dict) -> ClinicInfo:
    update_fields = {k: v for k, v in data.items() if v is not None}
    update_fields["updated_at"] = datetime.now(timezone.utc)
    doc = await db["clinic_info"].find_one_and_update(
        {},
        {"$set": update_fields},
        upsert=True,
        return_document=True,
    )
    return _doc_to_clinic(doc)
