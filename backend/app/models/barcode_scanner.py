from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from sqlalchemy.sql import func
from .base import Base


class BarcodeScannerSettings(Base):
    """바코드 스캐너 설정 모델"""
    __tablename__ = "barcode_scanner_settings"

    id = Column(Integer, primary_key=True, index=True)
    port = Column(String(50), nullable=False, comment="시리얼 포트 (예: COM1, COM2)")
    baudrate = Column(Integer, nullable=False, default=9600, comment="보드레이트")
    data_bits = Column(Integer, nullable=False, default=8, comment="데이터 비트")
    stop_bits = Column(Integer, nullable=False, default=1, comment="스톱 비트")
    parity = Column(String(1), nullable=False, default="N", comment="패리티 (N/E/O)")
    timeout = Column(Integer, nullable=False, default=1, comment="타임아웃 (초)")
    is_active = Column(Boolean, nullable=False, default=True, comment="활성 상태")
    description = Column(Text, nullable=True, comment="설명")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), comment="생성일시")
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), comment="수정일시")

    def __repr__(self):
        return f"<BarcodeScannerSettings(id={self.id}, port={self.port}, baudrate={self.baudrate})>"
