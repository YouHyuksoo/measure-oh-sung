from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class InspectionTimerSettingsBase(BaseModel):
    """검사 타이머 설정 기본 스키마"""
    name: str = Field(..., min_length=1, max_length=255, description="설정 이름")
    description: Optional[str] = Field(None, max_length=500, description="설정 설명")

    # 검사 모델 연결 (None이면 전역 설정)
    inspection_model_id: Optional[int] = Field(None, description="검사 모델 ID (None=전역 설정)")

    # P1 단계 설정
    p1_prepare_time: int = Field(..., ge=0, le=300, description="P1 준비시간 (초)")
    p1_duration: int = Field(..., ge=1, le=600, description="P1 검사시간 (초)")

    # P2 단계 설정
    p2_prepare_time: int = Field(..., ge=0, le=300, description="P2 준비시간 (초)")
    p2_duration: int = Field(..., ge=1, le=600, description="P2 검사시간 (초)")

    # P3 단계 설정
    p3_prepare_time: int = Field(..., ge=0, le=300, description="P3 준비시간 (초)")
    p3_duration: int = Field(..., ge=1, le=600, description="P3 검사시간 (초)")

    # 자동 진행 설정
    auto_progress: bool = Field(True, description="자동 진행 활성화")


class InspectionTimerSettingsCreate(InspectionTimerSettingsBase):
    """검사 타이머 설정 생성 스키마"""
    pass


class InspectionTimerSettingsUpdate(BaseModel):
    """검사 타이머 설정 수정 스키마"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=500)

    # 검사 모델 연결
    inspection_model_id: Optional[int] = Field(None, description="검사 모델 ID")

    # P1 단계 설정
    p1_prepare_time: Optional[int] = Field(None, ge=0, le=300)
    p1_duration: Optional[int] = Field(None, ge=1, le=600)

    # P2 단계 설정
    p2_prepare_time: Optional[int] = Field(None, ge=0, le=300)
    p2_duration: Optional[int] = Field(None, ge=1, le=600)

    # P3 단계 설정
    p3_prepare_time: Optional[int] = Field(None, ge=0, le=300)
    p3_duration: Optional[int] = Field(None, ge=1, le=600)

    # 자동 진행 설정
    auto_progress: Optional[bool] = None


class InspectionTimerSettingsResponse(InspectionTimerSettingsBase):
    """검사 타이머 설정 응답 스키마"""
    id: int
    is_active: bool
    total_duration: int = Field(..., description="전체 예상 검사 시간 (초)")
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# 호환성을 위한 간단한 스키마 (기존 프론트엔드와 호환)
class SimpleTimerSettings(BaseModel):
    """간단한 타이머 설정 스키마 (기존 API 호환용)"""
    p1PrepareTime: int = Field(..., alias="p1_prepare_time")
    p1Duration: int = Field(..., alias="p1_duration")
    p2PrepareTime: int = Field(..., alias="p2_prepare_time")
    p2Duration: int = Field(..., alias="p2_duration")
    p3PrepareTime: int = Field(..., alias="p3_prepare_time")
    p3Duration: int = Field(..., alias="p3_duration")
    autoProgress: bool = Field(..., alias="auto_progress")

    class Config:
        populate_by_name = True