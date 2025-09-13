from sqlalchemy import Column, Integer, Boolean, DateTime, String, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.base import Base


class InspectionTimerSettings(Base):
    """검사 타이머 설정 모델"""
    __tablename__ = "inspection_timer_settings"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, default="기본 타이머 설정")
    description = Column(String(500), nullable=True)

    # 검사 모델 연결 (특정 모델용 설정인지)
    inspection_model_id = Column(Integer, ForeignKey("inspection_models.id"), nullable=True)

    # 관계 설정
    inspection_model = relationship("InspectionModel", back_populates="timer_settings")

    # P1 단계 설정
    p1_prepare_time = Column(Integer, nullable=False, default=5)  # P1 준비시간 (초)
    p1_duration = Column(Integer, nullable=False, default=10)     # P1 검사시간 (초)

    # P2 단계 설정
    p2_prepare_time = Column(Integer, nullable=False, default=5)  # P2 준비시간 (초)
    p2_duration = Column(Integer, nullable=False, default=15)     # P2 검사시간 (초)

    # P3 단계 설정
    p3_prepare_time = Column(Integer, nullable=False, default=5)  # P3 준비시간 (초)
    p3_duration = Column(Integer, nullable=False, default=20)     # P3 검사시간 (초)

    # 자동 진행 설정
    auto_progress = Column(Boolean, nullable=False, default=True)

    # 활성화 상태 (현재 사용 중인 설정인지)
    is_active = Column(Boolean, nullable=False, default=False)

    # 생성/수정 시간
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    def __repr__(self):
        return f"<InspectionTimerSettings(id={self.id}, name='{self.name}', is_active={self.is_active})>"

    @property
    def total_duration(self) -> int:
        """전체 예상 검사 시간 (초)"""
        return (
            self.p1_prepare_time + self.p1_duration +
            self.p2_prepare_time + self.p2_duration +
            self.p3_prepare_time + self.p3_duration
        )