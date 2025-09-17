"""
안전검사 관련 모델
- SafetyInspectionResult: 3대안전 검사 결과
"""
from sqlalchemy import Column, String, Float, Integer, DateTime, JSON, Enum as SQLEnum, ForeignKey
from sqlalchemy.orm import relationship
from enum import Enum
from .base import Base, TimestampMixin

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

class SafetyInspectionResult(Base, TimestampMixin):
    """3대안전 검사 결과 테이블"""
    __tablename__ = "safety_inspection_results"
    
    # 바코드 및 검사 세션 정보
    barcode = Column(String(100), nullable=False, comment="바코드")
    session_id = Column(String(50), nullable=False, comment="검사 세션 ID")
    
    # 사용된 모델 정보
    inspection_model_id = Column(Integer, ForeignKey("inspection_models.id"), nullable=False)
    inspection_model = relationship("InspectionModel")
    
    # 검사 타입
    test_type = Column(String(50), nullable=False, default="SAFETY_INSPECTION", comment="검사 타입")
    
    # 전체 검사 상태
    status = Column(SQLEnum(SafetyInspectionStatus), nullable=False, comment="검사 상태")
    overall_result = Column(SQLEnum(SafetyTestResult), nullable=False, comment="전체 결과")
    
    # 3대안전 검사 결과 (JSON 형태로 저장)
    results = Column(JSON, nullable=False, comment="검사 결과 상세")
    # 예시: {
    #   "dielectric": {"value": 0.061, "unit": "mA", "result": "PASS"},
    #   "insulation": {"value": 0.051, "unit": "MΩ", "result": "FAIL"},
    #   "ground": {"value": 8.16, "unit": "Ω", "result": "PASS"}
    # }
    
    # 검사 시간 정보
    start_time = Column(DateTime, comment="검사 시작 시간")
    end_time = Column(DateTime, comment="검사 종료 시간")
    
    # 오류 정보
    error_message = Column(String(500), comment="오류 메시지")
    
    def __repr__(self):
        return f"<SafetyInspectionResult(id={self.id}, barcode='{self.barcode}', overall_result='{self.overall_result}')>"
