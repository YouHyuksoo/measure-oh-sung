from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import crud, schemas
from app.db.database import get_db

router = APIRouter()

@router.get("/", response_model=List[schemas.TestSettingsResponse])
def read_test_settings(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """모든 테스트 설정을 조회합니다."""
    test_settings = crud.test_settings.get_multi(db, skip=skip, limit=limit)
    return test_settings

@router.post("/", response_model=schemas.TestSettingsResponse)
def create_test_settings(
    *,
    db: Session = Depends(get_db),
    test_settings_in: schemas.TestSettingsCreate,
) -> Any:
    """새로운 테스트 설정을 생성합니다."""
    test_settings = crud.test_settings.create(db=db, obj_in=test_settings_in)
    return test_settings

@router.put("/{id}", response_model=schemas.TestSettingsResponse)
def update_test_settings(
    *,
    db: Session = Depends(get_db),
    id: int,
    test_settings_in: schemas.TestSettingsUpdate,
) -> Any:
    """테스트 설정을 업데이트합니다."""
    test_settings = crud.test_settings.get(db=db, id=id)
    if not test_settings:
        raise HTTPException(status_code=404, detail="Test settings not found")
    test_settings = crud.test_settings.update(db=db, db_obj=test_settings, obj_in=test_settings_in)
    return test_settings

@router.get("/{id}", response_model=schemas.TestSettingsResponse)
def read_test_settings_by_id(
    *,
    db: Session = Depends(get_db),
    id: int,
) -> Any:
    """특정 ID의 테스트 설정을 조회합니다."""
    test_settings = crud.test_settings.get(db=db, id=id)
    if not test_settings:
        raise HTTPException(status_code=404, detail="Test settings not found")
    return test_settings

@router.delete("/{id}", response_model=schemas.TestSettingsResponse)
def delete_test_settings(
    *,
    db: Session = Depends(get_db),
    id: int,
) -> Any:
    """테스트 설정을 삭제합니다."""
    test_settings = crud.test_settings.get(db=db, id=id)
    if not test_settings:
        raise HTTPException(status_code=404, detail="Test settings not found")
    test_settings = crud.test_settings.remove(db=db, id=id)
    return test_settings

@router.get("/active/current", response_model=schemas.TestSettingsResponse)
def get_active_test_settings(
    *,
    db: Session = Depends(get_db),
) -> Any:
    """현재 활성화된 테스트 설정을 조회합니다."""
    test_settings = crud.test_settings.get_active(db=db)
    if not test_settings:
        raise HTTPException(status_code=404, detail="No active test settings found")
    return test_settings

@router.post("/{id}/activate", response_model=schemas.TestSettingsResponse)
def activate_test_settings(
    *,
    db: Session = Depends(get_db),
    id: int,
) -> Any:
    """특정 테스트 설정을 활성화합니다."""
    test_settings = crud.test_settings.get(db=db, id=id)
    if not test_settings:
        raise HTTPException(status_code=404, detail="Test settings not found")
    test_settings = crud.test_settings.set_active(db=db, settings_id=id)
    return test_settings