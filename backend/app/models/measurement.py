from sqlalchemy import Column, String, Float, Integer, DateTime, JSON, Enum as SQLEnum, ForeignKey
from sqlalchemy.orm import relationship
from enum import Enum
from .base import Base, TimestampMixin

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

class Measurement(Base, TimestampMixin):
    """측정 데이터 테이블"""
    __tablename__ = "measurements"
    
    # 바코드 및 검사 세션 정보
    barcode = Column(String(100), nullable=False, comment="바코드")
    session_id = Column(String(50), nullable=False, comment="검사 세션 ID")
    
    # 사용된 모델 정보
    inspection_model_id = Column(Integer, ForeignKey("inspection_models.id"), nullable=False)
    inspection_model = relationship("InspectionModel")
    
    # 측정 단계
    phase = Column(SQLEnum(MeasurementPhase), nullable=False, comment="측정 단계 (P1/P2/P3)")
    
    # 측정 데이터 (JSON 형태로 실시간 수집된 모든 값들 저장)
    raw_data = Column(JSON, comment="실시간 수집된 원시 데이터 배열")
    
    # 측정 통계값
    min_value = Column(Float, comment="최솟값")
    max_value = Column(Float, comment="최댓값") 
    avg_value = Column(Float, comment="평균값")
    std_deviation = Column(Float, comment="표준편차")
    
    # 검사 결과
    result = Column(SQLEnum(MeasurementResult), nullable=False, comment="측정 결과")
    lower_limit = Column(Float, comment="적용된 하한값")
    upper_limit = Column(Float, comment="적용된 상한값")
    
    # 측정 시간 정보
    start_time = Column(DateTime, comment="측정 시작 시간")
    end_time = Column(DateTime, comment="측정 종료 시간")
    duration = Column(Float, comment="측정 시간 (초)")