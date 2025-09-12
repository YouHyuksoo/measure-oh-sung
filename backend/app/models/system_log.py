from sqlalchemy import Column, String, Text, Integer, JSON, Enum as SQLEnum
from enum import Enum
from .base import Base, TimestampMixin

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

class SystemLog(Base, TimestampMixin):
    """시스템 로그 테이블"""
    __tablename__ = "system_logs"
    
    # 로그 레벨 및 카테고리
    level = Column(SQLEnum(LogLevel), nullable=False, comment="로그 레벨")
    category = Column(SQLEnum(LogCategory), nullable=False, comment="로그 카테고리")
    
    # 로그 내용
    message = Column(String(500), nullable=False, comment="로그 메시지")
    details = Column(Text, comment="상세 정보")
    
    # 발생 위치
    module = Column(String(100), comment="모듈명")
    function = Column(String(100), comment="함수명") 
    line_number = Column(Integer, comment="라인 번호")
    
    # 연관 정보
    user_id = Column(String(100), comment="사용자 ID")
    session_id = Column(String(50), comment="세션 ID")
    device_id = Column(Integer, comment="관련 장비 ID")
    
    # 추가 정보 (JSON)
    extra_data = Column(JSON, comment="추가 데이터")