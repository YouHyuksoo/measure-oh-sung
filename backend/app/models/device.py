from sqlalchemy import Column, String, Integer, Boolean, JSON, Enum as SQLEnum, Float, Text, ForeignKey
from sqlalchemy.orm import relationship
from enum import Enum
from .base import Base, TimestampMixin

class DeviceType(str, Enum):
    """장비 타입 열거형"""
    POWER_METER = "POWER_METER"
    SAFETY_TESTER = "SAFETY_TESTER"
    BARCODE_SCANNER = "BARCODE_SCANNER"

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

    # Relationship
    commands = relationship("DeviceCommand", back_populates="device", cascade="all, delete-orphan")

class CommandCategory(str, Enum):
    """명령어 카테고리"""
    IDENTIFICATION = "IDENTIFICATION"  # 식별
    STATUS = "STATUS"  # 상태
    CONTROL = "CONTROL"  # 제어
    MEASUREMENT = "MEASUREMENT"  # 측정
    CONFIGURATION = "CONFIGURATION"  # 구성/설정
    STREAMING = "STREAMING"  # 스트리밍

class DeviceCommand(Base, TimestampMixin):
    """장비별 SCPI 명령어 관리 테이블"""
    __tablename__ = "device_commands"

    # 연결 정보
    device_id = Column(Integer, ForeignKey("devices.id"), nullable=False, comment="장비 ID")

    # 명령어 기본 정보
    name = Column(String(100), nullable=False, comment="명령어 이름")
    category = Column(SQLEnum(CommandCategory), nullable=False, comment="명령어 카테고리")
    command = Column(String(100), nullable=False, comment="실제 명령어")
    description = Column(Text, comment="명령어 설명")

    # 명령어 특성
    has_response = Column(Boolean, default=True, comment="응답 여부")
    response_pattern = Column(String(200), comment="예상 응답 패턴")
    timeout = Column(Integer, default=5, comment="타임아웃 (초)")
    retry_count = Column(Integer, default=3, comment="재시도 횟수")

    # 매개변수 설정
    parameters = Column(JSON, comment="명령어 매개변수 설정")
    parameter_description = Column(Text, comment="매개변수 설명")

    # 사용 설정
    is_active = Column(Boolean, default=True, comment="활성화 여부")
    order_sequence = Column(Integer, default=0, comment="표시 순서")

    # Relationship
    device = relationship("Device", back_populates="commands")