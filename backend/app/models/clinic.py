from pydantic import BaseModel
from datetime import datetime


class ClinicInfo(BaseModel):
    descripcion: str = ""
    direccion: str = ""
    ubicacion_url: str = ""
    pagina_web: str = ""
    updated_at: datetime | None = None
