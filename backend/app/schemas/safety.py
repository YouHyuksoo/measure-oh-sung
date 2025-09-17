"""
안전검사 관련 스키마
- SafetyInspectionResult: 3대안전 검사 결과 스키마
"""
from pydantic import BaseModel
from typing import Dict, Any, Optional
from datetime import datetime
from enum import Enum

class SafetyTestResult(str, Enum):
    """안전시험 결과 열거형"""
    PASS = "PASS"
    FAIL = "FAIL"
    PENDING = "PENDING"

class SafetyInspectionStatus(str, Enum):
    """안전시험 상태 열거형"""
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    PENDING = "PENDING"

class SafetyTestItem(BaseModel):
    """개별 안전시험 항목"""
    value: float
    unit: str
    result: SafetyTestResult

class SafetyInspectionResults(BaseModel):
    """3대안전 검사 결과"""
    dielectric: SafetyTestItem
    insulation: SafetyTestItem
    ground: SafetyTestItem

class SafetyInspectionResultBase(BaseModel):
    """3대안전 검사 결과 기본 스키마"""
    barcode: str
    inspection_model_id: int
    test_type: str = "SAFETY_INSPECTION"
    status: SafetyInspectionStatus
    overall_result: SafetyTestResult
    results: SafetyInspectionResults
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    error_message: Optional[str] = None

class SafetyInspectionResultCreate(SafetyInspectionResultBase):
    """3대안전 검사 결과 생성 스키마"""
    session_id: str

class SafetyInspectionResultUpdate(BaseModel):
    """3대안전 검사 결과 업데이트 스키마"""
    status: Optional[SafetyInspectionStatus] = None
    overall_result: Optional[SafetyTestResult] = None
    results: Optional[SafetyInspectionResults] = None
    end_time: Optional[datetime] = None
    error_message: Optional[str] = None

class SafetyInspectionResult(SafetyInspectionResultBase):
    """3대안전 검사 결과 응답 스키마"""
    id: int
    session_id: str
    created_at: datetime
    updated_at: datetime
    inspection_model_name: Optional[str] = None

    class Config:
        from_attributes = True
