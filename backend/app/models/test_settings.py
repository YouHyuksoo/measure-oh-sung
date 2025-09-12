from sqlalchemy import Column, Integer, Float, Boolean, String
from .base import Base, TimestampMixin

class TestSettings(Base, TimestampMixin):
    """검사 시간 설정 테이블"""
    __tablename__ = "test_settings"
    
    # 측정 시간 설정 (초 단위)
    p1_measure_duration = Column(Float, default=5.0, comment="P1 측정 시간")
    wait_duration_1_to_2 = Column(Float, default=2.0, comment="P1-P2 대기 시간") 
    p2_measure_duration = Column(Float, default=5.0, comment="P2 측정 시간")
    wait_duration_2_to_3 = Column(Float, default=2.0, comment="P2-P3 대기 시간")
    p3_measure_duration = Column(Float, default=5.0, comment="P3 측정 시간")
    
    # 활성 설정 여부 (단일 설정만 활성화)
    is_active = Column(Boolean, default=False, comment="활성 설정 여부")
    
    # 설정 이름 및 설명
    name = Column(String(100), nullable=False, comment="설정 이름")
    description = Column(String(255), comment="설정 설명")