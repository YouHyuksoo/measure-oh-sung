from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import crud, schemas
from app.db.database import get_db
from app.models.system_log import LogLevel, LogCategory

router = APIRouter()

@router.get("/", response_model=List[schemas.SystemLogResponse])
def read_system_logs(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """모든 시스템 로그를 조회합니다."""
    logs = crud.system_log.get_multi(db, skip=skip, limit=limit)
    return logs

@router.post("/", response_model=schemas.SystemLogResponse)
def create_system_log(
    *,
    db: Session = Depends(get_db),
    log_in: schemas.SystemLogCreate,
) -> Any:
    """새로운 시스템 로그를 생성합니다."""
    log = crud.system_log.create(db=db, obj_in=log_in)
    return log

@router.get("/{id}", response_model=schemas.SystemLogResponse)
def read_system_log(
    *,
    db: Session = Depends(get_db),
    id: int,
) -> Any:
    """특정 ID의 시스템 로그를 조회합니다."""
    log = crud.system_log.get(db=db, id=id)
    if not log:
        raise HTTPException(status_code=404, detail="System log not found")
    return log

@router.get("/level/{level}", response_model=List[schemas.SystemLogResponse])
def read_logs_by_level(
    *,
    db: Session = Depends(get_db),
    level: LogLevel,
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """로그 레벨별로 조회합니다."""
    logs = crud.system_log.get_by_level(db=db, level=level, skip=skip, limit=limit)
    return logs

@router.get("/category/{category}", response_model=List[schemas.SystemLogResponse])
def read_logs_by_category(
    *,
    db: Session = Depends(get_db),
    category: LogCategory,
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """로그 카테고리별로 조회합니다."""
    logs = crud.system_log.get_by_category(db=db, category=category, skip=skip, limit=limit)
    return logs

@router.get("/session/{session_id}", response_model=List[schemas.SystemLogResponse])
def read_logs_by_session(
    *,
    db: Session = Depends(get_db),
    session_id: str,
) -> Any:
    """세션별 로그를 조회합니다."""
    logs = crud.system_log.get_by_session(db=db, session_id=session_id)
    return logs

@router.get("/recent/list", response_model=List[schemas.SystemLogResponse])
def get_recent_logs(
    *,
    db: Session = Depends(get_db),
    limit: int = 50,
) -> Any:
    """최근 로그들을 조회합니다."""
    logs = crud.system_log.get_recent_logs(db=db, limit=limit)
    return logs