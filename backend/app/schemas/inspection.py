"""
검사 관련 모든 스키마 통합
- InspectionModel: 검사 모델 스키마
- InspectionStep: 검사 단계 스키마
- PollingSettings: 폴링 설정 스키마
"""
from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime

# ==================== 검사 모델 스키마 ====================
class InspectionModelBase(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    model_name: str
    description: Optional[str] = None
    is_active: Optional[bool] = True

class InspectionModelCreate(InspectionModelBase):
    inspection_steps: List[dict] = []  # 검사단계 정보

class InspectionModelUpdate(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    model_name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    inspection_steps: Optional[List[dict]] = None

class InspectionModelResponse(InspectionModelBase):
    id: int
    created_at: datetime
    updated_at: datetime
    inspection_steps: List[dict] = []

    class Config:
        from_attributes = True

# ==================== 검사단계 스키마 ====================
class InspectionStepBase(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    step_name: str
    step_order: int
    lower_limit: float
    upper_limit: float

class InspectionStepCreate(InspectionStepBase):
    inspection_model_id: int

class InspectionStepUpdate(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    step_name: Optional[str] = None
    step_order: Optional[int] = None
    lower_limit: Optional[float] = None
    upper_limit: Optional[float] = None

class InspectionStepResponse(BaseModel):
    """검사단계 응답 스키마"""
    id: int
    step_name: str
    step_order: int
    lower_limit: float
    upper_limit: float
    inspection_model_id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

# ==================== 폴링 설정 스키마 ====================
class PollingSettingsBase(BaseModel):
    """폴링 설정 기본 스키마"""
    inspection_model_id: int
    polling_interval: float = 0.5  # 폴링 간격 (초)
    polling_duration: float = 30.0  # 폴링 지속 시간 (초)
    is_active: bool = True

class PollingSettingsCreate(PollingSettingsBase):
    """폴링 설정 생성 스키마"""
    pass

class PollingSettingsUpdate(BaseModel):
    """폴링 설정 업데이트 스키마"""
    polling_interval: Optional[float] = None
    polling_duration: Optional[float] = None
    is_active: Optional[bool] = None

class PollingSettings(PollingSettingsBase):
    """폴링 설정 응답 스키마"""
    id: int
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True
