from pydantic import BaseModel, Field
from datetime import datetime


class HorarioDia(BaseModel):
    abierto: bool = False
    inicio: str | None = None        # "HH:MM" 24h
    cierre: str | None = None        # "HH:MM" 24h
    divide_turno: bool = False
    tarde_inicio: str | None = None  # "HH:MM" 24h
    tarde_cierre: str | None = None  # "HH:MM" 24h


class Horarios(BaseModel):
    lunes: HorarioDia = Field(default_factory=HorarioDia)
    martes: HorarioDia = Field(default_factory=HorarioDia)
    miercoles: HorarioDia = Field(default_factory=HorarioDia)
    jueves: HorarioDia = Field(default_factory=HorarioDia)
    viernes: HorarioDia = Field(default_factory=HorarioDia)
    sabado: HorarioDia = Field(default_factory=HorarioDia)
    domingo: HorarioDia = Field(default_factory=HorarioDia)


class ClinicInfo(BaseModel):
    descripcion: str = ""
    direccion: str = ""
    ubicacion_url: str = ""
    pagina_web: str = ""
    horarios: Horarios = Field(default_factory=Horarios)
    updated_at: datetime | None = None
