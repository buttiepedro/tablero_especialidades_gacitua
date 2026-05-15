from pydantic import BaseModel


class EspecialidadResponse(BaseModel):
    id: str
    especialidad: str
    descripcion: str


class EspecialidadUpdateRequest(BaseModel):
    descripcion: str


class SyncRequest(BaseModel):
    especialidades: list[str]


class SyncResponse(BaseModel):
    imported: int
