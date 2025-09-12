from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class TestSettingsBase(BaseModel):
    p1_measure_duration: float
    wait_duration_1_to_2: float
    p2_measure_duration: float
    wait_duration_2_to_3: float
    p3_measure_duration: float
    is_active: Optional[bool] = False
    name: str
    description: Optional[str] = None

class TestSettingsCreate(TestSettingsBase):
    pass

class TestSettingsUpdate(BaseModel):
    p1_measure_duration: Optional[float] = None
    wait_duration_1_to_2: Optional[float] = None
    p2_measure_duration: Optional[float] = None
    wait_duration_2_to_3: Optional[float] = None
    p3_measure_duration: Optional[float] = None
    is_active: Optional[bool] = None
    name: Optional[str] = None
    description: Optional[str] = None

class TestSettingsResponse(TestSettingsBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True