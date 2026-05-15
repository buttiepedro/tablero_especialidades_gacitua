from pydantic import BaseModel
from datetime import datetime


class UserInDB(BaseModel):
    id: str
    username: str
    hashed_password: str
    created_at: datetime
