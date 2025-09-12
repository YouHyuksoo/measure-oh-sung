from sqlalchemy import Column, String, Float, Boolean
from .base import Base, TimestampMixin

class InspectionModel(Base, TimestampMixin):
    """검사 모델 관리 테이블 - 각 모델별 상/하한값 관리"""
    __tablename__ = "inspection_models"
    
    # 모델 정보
    model_name = Column(String(100), unique=True, nullable=False, comment="모델 이름")
    description = Column(String(255), comment="모델 설명")
    
    # P1 검사 스펙
    p1_lower_limit = Column(Float, nullable=False, comment="P1 하한값")
    p1_upper_limit = Column(Float, nullable=False, comment="P1 상한값")
    
    # P2 검사 스펙  
    p2_lower_limit = Column(Float, nullable=False, comment="P2 하한값")
    p2_upper_limit = Column(Float, nullable=False, comment="P2 상한값")
    
    # P3 검사 스펙
    p3_lower_limit = Column(Float, nullable=False, comment="P3 하한값")
    p3_upper_limit = Column(Float, nullable=False, comment="P3 상한값")
    
    # 활성 여부
    is_active = Column(Boolean, default=True, comment="모델 사용 여부")