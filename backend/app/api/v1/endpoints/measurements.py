from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app import crud, schemas
from app.db.database import get_db
from app.models.measurement import MeasurementPhase, MeasurementResult

router = APIRouter()

@router.get("/", response_model=List[schemas.MeasurementResponse])
def read_measurements(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """모든 측정 데이터를 조회합니다."""
    measurements = crud.measurement.get_multi(db, skip=skip, limit=limit)
    return measurements

@router.post("/", response_model=schemas.MeasurementResponse)
def create_measurement(
    *,
    db: Session = Depends(get_db),
    measurement_in: schemas.MeasurementCreate,
) -> Any:
    """새로운 측정 데이터를 생성합니다."""
    measurement = crud.measurement.create(db=db, obj_in=measurement_in)
    return measurement

@router.get("/{id}", response_model=schemas.MeasurementResponse)
def read_measurement(
    *,
    db: Session = Depends(get_db),
    id: int,
) -> Any:
    """특정 ID의 측정 데이터를 조회합니다."""
    measurement = crud.measurement.get(db=db, id=id)
    if not measurement:
        raise HTTPException(status_code=404, detail="Measurement not found")
    return measurement

@router.get("/barcode/{barcode}", response_model=List[schemas.MeasurementResponse])
def read_measurements_by_barcode(
    *,
    db: Session = Depends(get_db),
    barcode: str,
) -> Any:
    """바코드별 측정 데이터를 조회합니다."""
    measurements = crud.measurement.get_by_barcode(db=db, barcode=barcode)
    return measurements

@router.get("/session/{session_id}", response_model=List[schemas.MeasurementResponse])
def read_measurements_by_session(
    *,
    db: Session = Depends(get_db),
    session_id: str,
) -> Any:
    """세션별 측정 데이터를 조회합니다."""
    measurements = crud.measurement.get_by_session(db=db, session_id=session_id)
    return measurements

@router.get("/barcode/{barcode}/phase/{phase}", response_model=schemas.MeasurementResponse)
def read_measurement_by_barcode_and_phase(
    *,
    db: Session = Depends(get_db),
    barcode: str,
    phase: MeasurementPhase,
) -> Any:
    """바코드와 측정 단계로 특정 측정 데이터를 조회합니다."""
    measurement = crud.measurement.get_by_barcode_and_phase(db=db, barcode=barcode, phase=phase)
    if not measurement:
        raise HTTPException(status_code=404, detail="Measurement not found")
    return measurement

@router.get("/failed/list", response_model=List[schemas.MeasurementResponse])
def get_failed_measurements(
    *,
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """실패한 측정 데이터들을 조회합니다."""
    measurements = crud.measurement.get_failed_measurements(db=db, skip=skip, limit=limit)
    return measurements
