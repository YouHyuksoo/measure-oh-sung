from sqlalchemy import Column, Integer, Float, Boolean, String, ForeignKey
from sqlalchemy.orm import relationship
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
    
    # 측정 방식 설정
    measurement_method = Column(String(20), default="polling", comment="측정 방식 (polling/synchronized)")
    data_collection_interval = Column(Float, default=0.25, comment="데이터 수집 간격 (초)")
    
    # 활성 설정 여부 (단일 설정만 활성화)
    is_active = Column(Boolean, default=False, comment="활성 설정 여부")
    
    # 설정 이름 및 설명
    name = Column(String(100), nullable=False, comment="설정 이름")
    description = Column(String(255), comment="설정 설명")

    # 검사 모델 연결 (특정 모델용 설정인지)
    inspection_model_id = Column(Integer, ForeignKey("inspection_models.id"), nullable=True, comment="검사 모델 ID (NULL=전역 설정)")

    # 관계 설정
    inspection_model = relationship("InspectionModel", back_populates="test_settings")