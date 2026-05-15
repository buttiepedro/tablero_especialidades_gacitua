from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from backend.app.config.settings import settings

SKIP_PATHS = {"/", "/docs", "/openapi.json", "/redoc"}


class APIKeyMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.method == "OPTIONS" or request.url.path in SKIP_PATHS:
            return await call_next(request)
        key = request.headers.get("X-API-Key")
        if not key or key != settings.API_KEY:
            return JSONResponse(status_code=403, content={"detail": "invalid_api_key"})
        return await call_next(request)
