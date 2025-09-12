from sqlalchemy import Column, String, Integer, Boolean, JSON, Enum as SQLEnum, Float
from enum import Enum
from .base import Base, TimestampMixin

class DeviceType(str, Enum):
    """장비 타입 열거형"""
    MULTIMETER = "MULTIMETER"
    OSCILLOSCOPE = "OSCILLOSCOPE"
    POWER_SUPPLY = "POWER_SUPPLY"
    FUNCTION_GENERATOR = "FUNCTION_GENERATOR"
    OTHER = "OTHER"

class ConnectionStatus(str, Enum):
    """연결 상태 열거형"""
    CONNECTED = "CONNECTED"
    DISCONNECTED = "DISCONNECTED"
    ERROR = "ERROR"

class Device(Base, TimestampMixin):
    """장비 관리 테이블"""
    __tablename__ = "devices"
    
    # 장비 기본 정보
    name = Column(String(100), nullable=False, comment="장비 이름")
    device_type = Column(SQLEnum(DeviceType), nullable=False, comment="장비 타입")
    manufacturer = Column(String(100), comment="제조사")
    model = Column(String(100), comment="모델명")
    firmware_version = Column(String(50), comment="펌웨어 버전")
    
    # 통신 설정
    port = Column(String(20), nullable=False, comment="통신 포트 (예: COM1)")
    baud_rate = Column(Integer, default=9600, comment="보드레이트")
    data_bits = Column(Integer, default=8, comment="데이터 비트")
    parity = Column(String(10), default="None", comment="패리티")
    stop_bits = Column(Integer, default=1, comment="스톱 비트")
    flow_control = Column(String(20), default="None", comment="흐름 제어")
    timeout = Column(Integer, default=5, comment="타임아웃 (초)")
    
    # SCPI 명령어 설정
    idn_command = Column(String(50), default="*IDN?", comment="장비 식별 명령어")
    scpi_commands = Column(JSON, comment="장비별 SCPI 명령어 목록")
    
    # 상태 정보
    connection_status = Column(SQLEnum(ConnectionStatus), default=ConnectionStatus.DISCONNECTED, comment="연결 상태")
    is_active = Column(Boolean, default=True, comment="사용 여부")
    
    # 장비 특성
    response_delay = Column(Float, default=0.1, comment="명령어 응답 지연 시간 (초)")
    max_retry_count = Column(Integer, default=3, comment="최대 재시도 횟수")