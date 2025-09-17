"""
검사 관련 모든 모델 통합
- InspectionModel: 검사 모델 관리
- InspectionStep: 검사 단계 관리  
- PollingSettings: 폴링 설정 관리
"""
from sqlalchemy import Column, String, Boolean, Integer, Float, ForeignKey
from sqlalchemy.orm import relationship
from .base import Base, TimestampMixin

# ==================== 검사 모델 ====================
class InspectionModel(Base, TimestampMixin):
    """검사 모델 관리 테이블 - 각 모델별 검사단계를 가변적으로 관리"""
    __tablename__ = "inspection_models"
    
    # 모델 정보
    model_name = Column(String(100), unique=True, nullable=False, comment="모델 이름")
    description = Column(String(255), comment="모델 설명")
    
    # 활성 여부
    is_active = Column(Boolean, default=True, comment="모델 사용 여부")

    # 관계 설정 - 검사단계들
    inspection_steps = relationship("InspectionStep", back_populates="inspection_model", cascade="all, delete-orphan", order_by="InspectionStep.step_order")

    # 관계 설정 - 폴링 설정들
    polling_settings = relationship("PollingSettings", back_populates="inspection_model", cascade="all, delete-orphan")

# ==================== 검사단계 모델 ====================
class InspectionStep(Base, TimestampMixin):
    """검사 단계 관리 테이블 - 각 모델별 검사단계를 가변적으로 관리"""
    __tablename__ = "inspection_steps"
    
    # 모델과의 관계
    inspection_model_id = Column(Integer, ForeignKey("inspection_models.id"), nullable=False, comment="검사 모델 ID")
    
    # 검사단계 정보
    step_name = Column(String(100), nullable=False, comment="검사항목명")
    step_order = Column(Integer, nullable=False, comment="검사 순서")
    lower_limit = Column(Float, nullable=False, comment="하한값")
    upper_limit = Column(Float, nullable=False, comment="상한값")
    
    # 관계 설정
    inspection_model = relationship("InspectionModel", back_populates="inspection_steps")

# ==================== 폴링 설정 모델 ====================
class PollingSettings(Base, TimestampMixin):
    """폴링 설정 모델"""
    __tablename__ = "polling_settings"

    id = Column(Integer, primary_key=True, index=True)
    inspection_model_id = Column(Integer, ForeignKey("inspection_models.id"), nullable=False)
    polling_interval = Column(Float, nullable=False, default=0.5)  # 폴링 간격 (초)
    polling_duration = Column(Float, nullable=False, default=30.0)  # 폴링 지속 시간 (초)
    is_active = Column(Boolean, nullable=False, default=True)

    # 관계 설정
    inspection_model = relationship("InspectionModel", back_populates="polling_settings")
