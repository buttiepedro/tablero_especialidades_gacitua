from pydantic_settings import BaseSettings
from pydantic import field_validator
import json


class Settings(BaseSettings):
    MONGODB_URL: str = "mongodb://localhost:27017"
    MONGODB_DB_NAME: str = "tablero"
    JWT_SECRET: str = "dev-secret-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRY_DAYS: int = 3
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]
    PORT: int = 8000
    COOKIE_SECURE: bool = False
    API_KEY: str = "replace-with-api-key"

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            return json.loads(v)
        return v

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
