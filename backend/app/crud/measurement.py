from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_
from app.crud.base import CRUDBase
from app.models.measurement import Measurement, MeasurementPhase, MeasurementResult
from app.schemas.measurement import MeasurementCreate, MeasurementUpdate

class CRUDMeasurement(CRUDBase[Measurement, MeasurementCreate, MeasurementUpdate]):
    def get_by_barcode(self, db: Session, *, barcode: str) -> List[Measurement]:
        """바코드로 측정 데이터를 조회합니다."""
        return db.query(Measurement).filter(Measurement.barcode == barcode).all()
    
    def get_by_session(self, db: Session, *, session_id: str) -> List[Measurement]:
        """세션 ID로 측정 데이터를 조회합니다."""
        return db.query(Measurement).filter(Measurement.session_id == session_id).all()
    
    def get_by_barcode_and_phase(
        self, db: Session, *, barcode: str, phase: MeasurementPhase
    ) -> Optional[Measurement]:
        """바코드와 측정 단계로 특정 측정 데이터를 조회합니다."""
        return db.query(Measurement).filter(
            and_(
                Measurement.barcode == barcode,
                Measurement.phase == phase
            )
        ).first()
    
    def get_failed_measurements(
        self, db: Session, *, skip: int = 0, limit: int = 100
    ) -> List[Measurement]:
        """실패한 측정 데이터들을 조회합니다."""
        return db.query(Measurement).filter(
            Measurement.result == MeasurementResult.FAIL
        ).offset(skip).limit(limit).all()

measurement = CRUDMeasurement(Measurement)