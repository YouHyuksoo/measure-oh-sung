from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class BarcodeScannerSettingsBase(BaseModel):
    port: str
    baudrate: int = 9600
    data_bits: int = 8
    stop_bits: int = 1
    parity: str = "N"
    timeout: int = 1
    is_active: bool = True
    description: Optional[str] = None


class BarcodeScannerSettingsCreate(BarcodeScannerSettingsBase):
    pass


class BarcodeScannerSettingsUpdate(BaseModel):
    port: Optional[str] = None
    baudrate: Optional[int] = None
    data_bits: Optional[int] = None
    stop_bits: Optional[int] = None
    parity: Optional[str] = None
    timeout: Optional[int] = None
    is_active: Optional[bool] = None
    description: Optional[str] = None


class BarcodeScannerSettingsResponse(BarcodeScannerSettingsBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class BarcodeScannerStatus(BaseModel):
    is_connected: bool
    is_listening: bool
    connected_port: Optional[str] = None
    last_barcode: Optional[str] = None
    scan_count: int = 0
    settings: Optional[BarcodeScannerSettingsResponse] = None


class BarcodeTestResult(BaseModel):
    success: bool
    message: str
    data: Optional[str] = None
    raw_data: Optional[str] = None
