from pydantic import BaseModel
from datetime import datetime


class Especialidad(BaseModel):
    id: str
    nombre: str
    descripcion: str = ""
    updated_at: datetime | None = None
