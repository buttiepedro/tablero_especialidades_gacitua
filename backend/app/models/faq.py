from pydantic import BaseModel
from datetime import datetime


class FAQ(BaseModel):
    id: str
    question: str
    answer: str
    created_at: datetime
