from pydantic import BaseModel, Field
from datetime import datetime
from app.models.clinic import HorarioDia, Horarios


class ClinicUpdateRequest(BaseModel):
    descripcion: str | None = None
    direccion: str | None = None
    ubicacion_url: str | None = None
    pagina_web: str | None = None
    horarios: Horarios | None = None


class ClinicResponse(BaseModel):
    descripcion: str
    direccion: str
    ubicacion_url: str
    pagina_web: str
    horarios: Horarios = Field(default_factory=Horarios)
    updated_at: datetime | None = None
