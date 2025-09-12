from pydantic_settings import BaseSettings
from typing import List, Union
import os
from pathlib import Path

class Settings(BaseSettings):
    PROJECT_NAME: str = "Measure Oh Sung"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api/v1"
    
    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",  # Next.js frontend
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ]
    
    # Database - 절대경로 사용
    @property
    def DATABASE_URL(self) -> str:
        backend_dir = Path(__file__).parent.parent.parent
        db_path = backend_dir / "measure_oh_sung.db"
        return f"sqlite:///{db_path}"
    
    # Security
    SECRET_KEY: str = "your-secret-key-change-this-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    class Config:
        env_file = ".env"

settings = Settings()
