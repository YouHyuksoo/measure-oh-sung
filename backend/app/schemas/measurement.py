from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

class MeasurementResult(str, Enum):
    """측정 결과 열거형"""
    PASS = "PASS"
    FAIL = "FAIL"
    ERROR = "ERROR"

class MeasurementPhase(str, Enum):
    """측정 단계 열거형"""
    P1 = "P1"
    P2 = "P2" 
    P3 = "P3"

class MeasurementBase(BaseModel):
    barcode: str
    session_id: str
    inspection_model_id: int
    phase: MeasurementPhase
    raw_data: Optional[List[float]] = None
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    avg_value: Optional[float] = None
    std_deviation: Optional[float] = None
    result: MeasurementResult
    lower_limit: Optional[float] = None
    upper_limit: Optional[float] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    duration: Optional[float] = None

class MeasurementCreate(MeasurementBase):
    pass

class MeasurementUpdate(BaseModel):
    barcode: Optional[str] = None
    session_id: Optional[str] = None
    inspection_model_id: Optional[int] = None
    phase: Optional[MeasurementPhase] = None
    raw_data: Optional[List[float]] = None
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    avg_value: Optional[float] = None
    std_deviation: Optional[float] = None
    result: Optional[MeasurementResult] = None
    lower_limit: Optional[float] = None
    upper_limit: Optional[float] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    duration: Optional[float] = None

class MeasurementResponse(MeasurementBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
