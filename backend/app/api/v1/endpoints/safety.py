"""
안전검사 관련 API 엔드포인트
- SafetyInspectionResult: 3대안전 검사 결과 관리
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime, timedelta

from app.db.database import get_db
from app import crud
from app.schemas.safety import SafetyInspectionResult, SafetyInspectionResultCreate, SafetyInspectionResultUpdate

router = APIRouter()

@router.get("/", response_model=List[SafetyInspectionResult])
def get_safety_inspections(
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    barcode: Optional[str] = Query(None),
    overall_result: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None)
):
    """3대안전 검사 결과 목록 조회"""
    try:
        results = crud.safety.safety_inspection.get_multi(
            db=db,
            skip=skip,
            limit=limit,
            barcode=barcode,
            overall_result=overall_result,
            start_date=start_date,
            end_date=end_date
        )
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{inspection_id}", response_model=SafetyInspectionResult)
def get_safety_inspection(
    inspection_id: int,
    db: Session = Depends(get_db)
):
    """3대안전 검사 결과 상세 조회"""
    try:
        result = crud.safety.safety_inspection.get(db, id=inspection_id)
        if not result:
            raise HTTPException(status_code=404, detail="검사 결과를 찾을 수 없습니다.")
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/barcode/{barcode}", response_model=List[SafetyInspectionResult])
def get_safety_inspections_by_barcode(
    barcode: str,
    db: Session = Depends(get_db)
):
    """바코드별 3대안전 검사 결과 조회"""
    try:
        results = crud.safety.safety_inspection.get_by_barcode(db, barcode=barcode)
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/session/{session_id}", response_model=Optional[SafetyInspectionResult])
def get_safety_inspection_by_session(
    session_id: str,
    db: Session = Depends(get_db)
):
    """세션별 3대안전 검사 결과 조회"""
    try:
        result = crud.safety.safety_inspection.get_by_session(db, session_id=session_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/", response_model=SafetyInspectionResult)
def create_safety_inspection(
    inspection: SafetyInspectionResultCreate,
    db: Session = Depends(get_db)
):
    """3대안전 검사 결과 생성"""
    try:
        result = crud.safety.safety_inspection.create(db, obj_in=inspection)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{inspection_id}", response_model=SafetyInspectionResult)
def update_safety_inspection(
    inspection_id: int,
    inspection: SafetyInspectionResultUpdate,
    db: Session = Depends(get_db)
):
    """3대안전 검사 결과 업데이트"""
    try:
        db_obj = crud.safety_inspection.get(db, id=inspection_id)
        if not db_obj:
            raise HTTPException(status_code=404, detail="검사 결과를 찾을 수 없습니다.")
        
        result = crud.safety_inspection.update(db, db_obj=db_obj, obj_in=inspection)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{inspection_id}")
def delete_safety_inspection(
    inspection_id: int,
    db: Session = Depends(get_db)
):
    """3대안전 검사 결과 삭제"""
    try:
        result = crud.safety_inspection.delete(db, id=inspection_id)
        if not result:
            raise HTTPException(status_code=404, detail="검사 결과를 찾을 수 없습니다.")
        return {"message": "검사 결과가 삭제되었습니다."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/stats/summary")
def get_safety_inspection_stats(
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db)
):
    """3대안전 검사 통계 조회"""
    try:
        stats = crud.safety_inspection.get_stats(db, days=days)
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
