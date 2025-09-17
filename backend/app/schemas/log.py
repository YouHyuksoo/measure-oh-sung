"""
로그 관련 스키마
- SystemLog: 시스템 로그 스키마
"""
from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime
from enum import Enum

class LogLevel(str, Enum):
    """로그 레벨 열거형"""
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"

class LogCategory(str, Enum):
    """로그 카테고리 열거형"""
    SYSTEM = "SYSTEM"
    DEVICE = "DEVICE"
    MEASUREMENT = "MEASUREMENT"
    API = "API"
    WEBSOCKET = "WEBSOCKET"
    DATABASE = "DATABASE"

class SystemLogBase(BaseModel):
    level: LogLevel
    category: LogCategory
    message: str
    details: Optional[str] = None
    module: Optional[str] = None
    function: Optional[str] = None
    line_number: Optional[int] = None
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    device_id: Optional[int] = None
    extra_data: Optional[Dict[str, Any]] = None

class SystemLogCreate(SystemLogBase):
    pass

class SystemLogUpdate(BaseModel):
    level: Optional[LogLevel] = None
    category: Optional[LogCategory] = None
    message: Optional[str] = None
    details: Optional[str] = None
    module: Optional[str] = None
    function: Optional[str] = None
    line_number: Optional[int] = None
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    device_id: Optional[int] = None
    extra_data: Optional[Dict[str, Any]] = None

class SystemLogResponse(SystemLogBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
