from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from backend.app.db.mongo import get_database
from backend.app.middleware.auth import get_current_user
from backend.app.schemas.clinic import ClinicUpdateRequest, ClinicResponse
from backend.app.services import clinic_service

router = APIRouter(tags=["clinic"])


@router.get("/clinic", response_model=ClinicResponse)
async def get_clinic(
    db: AsyncIOMotorDatabase = Depends(get_database),
    _=Depends(get_current_user),
):
    info = await clinic_service.get_clinic(db)
    return ClinicResponse(**info.model_dump())


@router.put("/clinic", response_model=ClinicResponse)
async def update_clinic(
    body: ClinicUpdateRequest,
    db: AsyncIOMotorDatabase = Depends(get_database),
    _=Depends(get_current_user),
):
    info = await clinic_service.update_clinic(db, body.model_dump())
    return ClinicResponse(**info.model_dump())
