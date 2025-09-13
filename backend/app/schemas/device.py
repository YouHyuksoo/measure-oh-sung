from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum

class DeviceType(str, Enum):
    """장비 타입 열거형"""
    MULTIMETER = "MULTIMETER"
    OSCILLOSCOPE = "OSCILLOSCOPE"
    POWER_SUPPLY = "POWER_SUPPLY"
    FUNCTION_GENERATOR = "FUNCTION_GENERATOR"
    POWER_METER = "POWER_METER"
    SAFETY_TESTER = "SAFETY_TESTER"
    OTHER = "OTHER"

class ConnectionStatus(str, Enum):
    """연결 상태 열거형"""
    CONNECTED = "CONNECTED"
    DISCONNECTED = "DISCONNECTED"
    ERROR = "ERROR"

class DeviceBase(BaseModel):
    name: str
    device_type: DeviceType
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    firmware_version: Optional[str] = None
    port: str
    baud_rate: Optional[int] = 9600
    data_bits: Optional[int] = 8
    parity: Optional[str] = "None"
    stop_bits: Optional[int] = 1
    flow_control: Optional[str] = "None"
    timeout: Optional[int] = 5
    idn_command: Optional[str] = "*IDN?"
    scpi_commands: Optional[Dict[str, Any]] = None
    connection_status: Optional[ConnectionStatus] = ConnectionStatus.DISCONNECTED
    is_active: Optional[bool] = True
    response_delay: Optional[float] = 0.1
    max_retry_count: Optional[int] = 3

class DeviceCreate(DeviceBase):
    pass

class DeviceUpdate(BaseModel):
    name: Optional[str] = None
    device_type: Optional[DeviceType] = None
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    firmware_version: Optional[str] = None
    port: Optional[str] = None
    baud_rate: Optional[int] = None
    data_bits: Optional[int] = None
    parity: Optional[str] = None
    stop_bits: Optional[int] = None
    flow_control: Optional[str] = None
    timeout: Optional[int] = None
    idn_command: Optional[str] = None
    scpi_commands: Optional[Dict[str, Any]] = None
    connection_status: Optional[ConnectionStatus] = None
    is_active: Optional[bool] = None
    response_delay: Optional[float] = None
    max_retry_count: Optional[int] = None

class CommandCategory(str, Enum):
    """명령어 카테고리"""
    IDENTIFICATION = "IDENTIFICATION"  # 식별
    STATUS = "STATUS"  # 상태
    CONTROL = "CONTROL"  # 제어
    MEASUREMENT = "MEASUREMENT"  # 측정
    CONFIGURATION = "CONFIGURATION"  # 구성/설정
    STREAMING = "STREAMING"  # 스트리밍

class DeviceCommandBase(BaseModel):
    name: str
    category: CommandCategory
    command: str
    description: Optional[str] = None
    has_response: Optional[bool] = True
    response_pattern: Optional[str] = None
    timeout: Optional[int] = 5
    retry_count: Optional[int] = 3
    parameters: Optional[Dict[str, Any]] = None
    parameter_description: Optional[str] = None
    is_active: Optional[bool] = True
    order_sequence: Optional[int] = 0

class DeviceCommandCreate(DeviceCommandBase):
    device_id: int

class DeviceCommandUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[CommandCategory] = None
    command: Optional[str] = None
    description: Optional[str] = None
    has_response: Optional[bool] = None
    response_pattern: Optional[str] = None
    timeout: Optional[int] = None
    retry_count: Optional[int] = None
    parameters: Optional[Dict[str, Any]] = None
    parameter_description: Optional[str] = None
    is_active: Optional[bool] = None
    order_sequence: Optional[int] = None

class DeviceCommandResponse(DeviceCommandBase):
    id: int
    device_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class DeviceResponse(DeviceBase):
    id: int
    created_at: datetime
    updated_at: datetime
    commands: Optional[List[DeviceCommandResponse]] = []

    class Config:
        from_attributes = True

class CommandExecutionRequest(BaseModel):
    """명령어 실행 요청"""
    command_id: int
    parameters: Optional[Dict[str, Any]] = None

class CommandExecutionResponse(BaseModel):
    """명령어 실행 응답"""
    success: bool
    response_data: Optional[str] = None
    error_message: Optional[str] = None
    execution_time: float
    timestamp: datetime