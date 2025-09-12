from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime

class InspectionModelBase(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    model_name: str
    description: Optional[str] = None
    p1_lower_limit: float
    p1_upper_limit: float
    p2_lower_limit: float
    p2_upper_limit: float
    p3_lower_limit: float
    p3_upper_limit: float
    is_active: Optional[bool] = True

class InspectionModelCreate(InspectionModelBase):
    pass

class InspectionModelUpdate(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    model_name: Optional[str] = None
    description: Optional[str] = None
    p1_lower_limit: Optional[float] = None
    p1_upper_limit: Optional[float] = None
    p2_lower_limit: Optional[float] = None
    p2_upper_limit: Optional[float] = None
    p3_lower_limit: Optional[float] = None
    p3_upper_limit: Optional[float] = None
    is_active: Optional[bool] = None

class InspectionModelResponse(InspectionModelBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True