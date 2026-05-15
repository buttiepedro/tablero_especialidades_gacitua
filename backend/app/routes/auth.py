from fastapi import APIRouter, Depends, HTTPException, Request, Response
from motor.motor_asyncio import AsyncIOMotorDatabase
from backend.app.db.mongo import get_database
from backend.app.schemas.auth import LoginRequest, RegisterRequest, MeResponse
from backend.app.services import auth_service
from backend.app.utils.jwt_utils import decode_token
from backend.app.middleware.auth import get_current_user
from backend.app.models.user import UserInDB
from backend.app.config.settings import settings

router = APIRouter(prefix="/auth", tags=["auth"])

COOKIE_OPTS = dict(
    key="access_token",
    httponly=True,
    samesite="lax",
    secure=settings.COOKIE_SECURE,
    max_age=settings.JWT_EXPIRY_DAYS * 86400,
)


@router.post("/register", status_code=201)
async def register(
    body: RegisterRequest,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    if not body.username.strip() or not body.password:
        raise HTTPException(status_code=400, detail="Username and password required")

    count = await db["users"].count_documents({})
    if count > 0:
        token = request.cookies.get("access_token")
        if not token:
            raise HTTPException(status_code=401, detail="Authentication required")
        payload = decode_token(token)
        if not payload:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        existing = await auth_service.get_by_username(db, payload.get("sub", ""))
        if not existing:
            raise HTTPException(status_code=401, detail="User not found")

    try:
        user = await auth_service.register(db, body.username.strip(), body.password)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    return {"username": user.username}


@router.post("/login")
async def login(
    body: LoginRequest,
    response: Response,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    user = await auth_service.authenticate(db, body.username, body.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    from backend.app.utils.jwt_utils import create_token
    token = create_token(user.username)
    response.set_cookie(value=token, **COOKIE_OPTS)
    return {"ok": True, "access_token": token}


@router.get("/me", response_model=MeResponse)
async def me(current_user: UserInDB = Depends(get_current_user)):
    return MeResponse(username=current_user.username, created_at=current_user.created_at)


@router.post("/logout")
async def logout(response: Response, _: UserInDB = Depends(get_current_user)):
    response.delete_cookie(
        key="access_token",
        httponly=True,
        samesite="lax",
        secure=settings.COOKIE_SECURE,
    )
    return {"ok": True}
