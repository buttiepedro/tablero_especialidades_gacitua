from fastapi import Request, HTTPException, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.db.mongo import get_database
from app.utils.jwt_utils import decode_token
from app.services import auth_service
from app.models.user import UserInDB


async def get_current_user(
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> UserInDB:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_token(token)
    if payload is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    username = payload.get("sub")
    if not username:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    user = await auth_service.get_by_username(db, username)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user
