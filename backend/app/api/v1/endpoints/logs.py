"""
로그 관련 API 엔드포인트
- SystemLog: 시스템 로그 관리
"""
from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import crud, schemas
from app.db.database import get_db
from app.models.log import LogLevel, LogCategory

router = APIRouter()

@router.get("/", response_model=List[schemas.SystemLogResponse])
def read_system_logs(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """모든 시스템 로그를 조회합니다."""
    logs = crud.log.system_log.get_multi(db, skip=skip, limit=limit)
    return logs

@router.post("/", response_model=schemas.SystemLogResponse)
def create_system_log(
    *,
    db: Session = Depends(get_db),
    log_in: schemas.SystemLogCreate,
) -> Any:
    """새로운 시스템 로그를 생성합니다."""
    log = crud.log.system_log.create(db=db, obj_in=log_in)
    return log

@router.get("/recent", response_model=List[schemas.SystemLogResponse])
def get_recent_logs(
    db: Session = Depends(get_db),
    limit: int = 100,
) -> Any:
    """최근 시스템 로그를 조회합니다."""
    logs = crud.log.system_log.get_recent_logs(db, limit=limit)
    return logs

@router.get("/level/{level}", response_model=List[schemas.SystemLogResponse])
def get_logs_by_level(
    level: LogLevel,
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """로그 레벨별 시스템 로그를 조회합니다."""
    logs = crud.log.system_log.get_by_level(db, level=level, skip=skip, limit=limit)
    return logs

@router.get("/category/{category}", response_model=List[schemas.SystemLogResponse])
def get_logs_by_category(
    category: LogCategory,
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """로그 카테고리별 시스템 로그를 조회합니다."""
    logs = crud.log.system_log.get_by_category(db, category=category, skip=skip, limit=limit)
    return logs

@router.get("/session/{session_id}", response_model=List[schemas.SystemLogResponse])
def get_logs_by_session(
    session_id: str,
    db: Session = Depends(get_db),
) -> Any:
    """세션별 시스템 로그를 조회합니다."""
    logs = crud.log.system_log.get_by_session(db, session_id=session_id)
    return logs

@router.get("/{log_id}", response_model=schemas.SystemLogResponse)
def get_system_log(
    log_id: int,
    db: Session = Depends(get_db),
) -> Any:
    """특정 시스템 로그를 조회합니다."""
    log = crud.log.system_log.get(db, id=log_id)
    if not log:
        raise HTTPException(status_code=404, detail="로그를 찾을 수 없습니다.")
    return log

@router.put("/{log_id}", response_model=schemas.SystemLogResponse)
def update_system_log(
    log_id: int,
    log_in: schemas.SystemLogUpdate,
    db: Session = Depends(get_db),
) -> Any:
    """시스템 로그를 업데이트합니다."""
    log = crud.log.system_log.get(db, id=log_id)
    if not log:
        raise HTTPException(status_code=404, detail="로그를 찾을 수 없습니다.")
    log = crud.log.system_log.update(db, db_obj=log, obj_in=log_in)
    return log

@router.delete("/{log_id}")
def delete_system_log(
    log_id: int,
    db: Session = Depends(get_db),
) -> Any:
    """시스템 로그를 삭제합니다."""
    log = crud.log.system_log.get(db, id=log_id)
    if not log:
        raise HTTPException(status_code=404, detail="로그를 찾을 수 없습니다.")
    crud.log.system_log.remove(db, id=log_id)
    return {"message": "로그가 삭제되었습니다."}
