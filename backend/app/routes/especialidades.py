from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.db.mongo import get_database
from app.middleware.auth import get_current_user
from app.schemas.especialidad import (
    EspecialidadResponse,
    EspecialidadUpdateRequest,
    SyncRequest,
    SyncResponse,
)
from app.services import especialidad_service

router = APIRouter(tags=["especialidades"])


@router.get("/especialidades", response_model=list[EspecialidadResponse])
async def list_especialidades(
    db: AsyncIOMotorDatabase = Depends(get_database),
    _=Depends(get_current_user),
):
    items = await especialidad_service.list_especialidades(db)
    return [EspecialidadResponse(id=e.id, especialidad=e.nombre, descripcion=e.descripcion) for e in items]


@router.put("/especialidades/{item_id}", response_model=EspecialidadResponse)
async def update_especialidad(
    item_id: str,
    body: EspecialidadUpdateRequest,
    db: AsyncIOMotorDatabase = Depends(get_database),
    _=Depends(get_current_user),
):
    item = await especialidad_service.update_especialidad(db, item_id, body.descripcion)
    if not item:
        raise HTTPException(status_code=404, detail="Especialidad not found")
    return EspecialidadResponse(id=item.id, especialidad=item.nombre, descripcion=item.descripcion)


@router.post("/sync/especialidades", response_model=SyncResponse)
async def sync_especialidades(
    body: SyncRequest,
    db: AsyncIOMotorDatabase = Depends(get_database),
    _=Depends(get_current_user),
):
    count = await especialidad_service.sync_especialidades(db, body.especialidades)
    return SyncResponse(imported=count)
