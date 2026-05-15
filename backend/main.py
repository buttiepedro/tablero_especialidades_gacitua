import logging
from backend.app.routes import auth, clinic, especialidades
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pymongo.errors import ServerSelectionTimeoutError, ConnectionFailure
from backend.app.db.mongo import lifespan, get_database
from backend.app.config.settings import settings
from backend.app.routes import faqs

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s  %(name)s  %(message)s",
)

app = FastAPI(title="Tablero Especialidades API", version="0.2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(ServerSelectionTimeoutError)
@app.exception_handler(ConnectionFailure)
async def db_error_handler(request, exc):
    return JSONResponse(
        status_code=503,
        content={"detail": "database_unavailable"},
    )


app.include_router(auth.router)
app.include_router(clinic.router)
app.include_router(especialidades.router)
app.include_router(faqs.router)


@app.get("/health")
async def health():
    from backend.app.db.mongo import _db_available
    if not _db_available:
        return JSONResponse(
            status_code=503,
            content={"ok": False, "db": False, "version": "0.2"},
        )
    return {"ok": True, "db": True, "version": "0.2"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=settings.PORT, reload=True)
