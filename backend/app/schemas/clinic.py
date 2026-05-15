from pydantic import BaseModel
from datetime import datetime


class ClinicUpdateRequest(BaseModel):
    descripcion: str | None = None
    direccion: str | None = None
    ubicacion_url: str | None = None
    pagina_web: str | None = None


class ClinicResponse(BaseModel):
    descripcion: str
    direccion: str
    ubicacion_url: str
    pagina_web: str
    updated_at: datetime | None = None
