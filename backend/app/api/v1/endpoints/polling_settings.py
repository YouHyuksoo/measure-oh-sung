from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import crud
from app.db.database import get_db
from app.schemas.inspection import PollingSettings, PollingSettingsCreate, PollingSettingsUpdate

router = APIRouter()

@router.get("/", response_model=List[PollingSettings])
def get_polling_settings(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """모든 폴링 설정 조회"""
    settings = crud.polling_settings.get_multi(db, skip=skip, limit=limit)
    return settings

@router.get("/model/{model_id}", response_model=PollingSettings)
def get_polling_settings_by_model(
    model_id: int,
    db: Session = Depends(get_db)
):
    """특정 모델의 폴링 설정 조회"""
    settings = crud.polling_settings.get_by_model_id(db, model_id=model_id)
    if not settings:
        raise HTTPException(status_code=404, detail="폴링 설정을 찾을 수 없습니다")
    return settings

@router.post("/", response_model=PollingSettings)
def create_polling_settings(
    settings: PollingSettingsCreate,
    db: Session = Depends(get_db)
):
    """폴링 설정 생성"""
    # 모델 존재 확인
    model = crud.inspection_model.get(db, id=settings.model_id)
    if not model:
        raise HTTPException(status_code=404, detail="검사 모델을 찾을 수 없습니다")
    
    # 기존 설정이 있으면 업데이트, 없으면 생성
    return crud.polling_settings.create_or_update_for_model(
        db=db,
        model_id=settings.model_id,
        polling_interval=settings.polling_interval,
        polling_duration=settings.polling_duration,
        is_active=settings.is_active
    )

@router.put("/{settings_id}", response_model=PollingSettings)
def update_polling_settings(
    settings_id: int,
    settings: PollingSettingsUpdate,
    db: Session = Depends(get_db)
):
    """폴링 설정 업데이트"""
    existing_settings = crud.polling_settings.get(db, id=settings_id)
    if not existing_settings:
        raise HTTPException(status_code=404, detail="폴링 설정을 찾을 수 없습니다")
    
    return crud.polling_settings.update(db, db_obj=existing_settings, obj_in=settings)

@router.put("/model/{model_id}", response_model=PollingSettings)
def update_polling_settings_by_model(
    model_id: int,
    settings: PollingSettingsUpdate,
    db: Session = Depends(get_db)
):
    """모델별 폴링 설정 업데이트"""
    # 모델 존재 확인
    model = crud.inspection_model.get(db, id=model_id)
    if not model:
        raise HTTPException(status_code=404, detail="검사 모델을 찾을 수 없습니다")
    
    # 기존 설정 조회
    existing_settings = crud.polling_settings.get_by_model_id(db, model_id=model_id)
    if not existing_settings:
        raise HTTPException(status_code=404, detail="폴링 설정을 찾을 수 없습니다")
    
    return crud.polling_settings.update(db, db_obj=existing_settings, obj_in=settings)

@router.delete("/{settings_id}")
def delete_polling_settings(
    settings_id: int,
    db: Session = Depends(get_db)
):
    """폴링 설정 삭제"""
    settings = crud.polling_settings.get(db, id=settings_id)
    if not settings:
        raise HTTPException(status_code=404, detail="폴링 설정을 찾을 수 없습니다")
    
    crud.polling_settings.remove(db, id=settings_id)
    return {"message": "폴링 설정이 삭제되었습니다"}
