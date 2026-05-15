from pydantic import BaseModel
from datetime import datetime


class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    username: str
    password: str


class MeResponse(BaseModel):
    username: str
    created_at: datetime
