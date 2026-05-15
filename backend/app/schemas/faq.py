from pydantic import BaseModel
from datetime import datetime


class FAQCreateRequest(BaseModel):
    question: str
    answer: str


class FAQResponse(BaseModel):
    id: str
    question: str
    answer: str
    created_at: datetime
