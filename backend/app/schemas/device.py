from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime
from enum import Enum

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

class DeviceResponse(DeviceBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True