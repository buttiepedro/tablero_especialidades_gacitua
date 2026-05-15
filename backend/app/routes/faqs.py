from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.db.mongo import get_database
from app.middleware.auth import get_current_user
from app.schemas.faq import FAQCreateRequest, FAQResponse
from app.services import faq_service

router = APIRouter(prefix="/faqs", tags=["faqs"])


@router.get("", response_model=list[FAQResponse])
async def list_faqs(
    db: AsyncIOMotorDatabase = Depends(get_database),
    _=Depends(get_current_user),
):
    faqs = await faq_service.list_faqs(db)
    return [FAQResponse(id=f.id, question=f.question, answer=f.answer, created_at=f.created_at) for f in faqs]


@router.post("", status_code=201, response_model=FAQResponse)
async def create_faq(
    body: FAQCreateRequest,
    db: AsyncIOMotorDatabase = Depends(get_database),
    _=Depends(get_current_user),
):
    if not body.question.strip() or not body.answer.strip():
        raise HTTPException(status_code=400, detail="Question and answer required")
    faq = await faq_service.create_faq(db, body.question, body.answer)
    return FAQResponse(id=faq.id, question=faq.question, answer=faq.answer, created_at=faq.created_at)


@router.delete("/{faq_id}", status_code=204)
async def delete_faq(
    faq_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    _=Depends(get_current_user),
):
    deleted = await faq_service.delete_faq(db, faq_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="FAQ not found")
