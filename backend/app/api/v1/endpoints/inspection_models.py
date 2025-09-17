from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import crud, schemas
from app.db.database import get_db

router = APIRouter()

@router.get("/", response_model=List[schemas.InspectionModelResponse])
def read_inspection_models(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """모든 검사 모델을 조회합니다."""
    inspection_models = crud.inspection_model.get_multi(db, skip=skip, limit=limit)
    return inspection_models

@router.post("/", response_model=schemas.InspectionModelResponse)
def create_inspection_model(
    *,
    db: Session = Depends(get_db),
    inspection_model_in: schemas.InspectionModelCreate,
) -> Any:
    """새로운 검사 모델을 생성합니다."""
    # 중복된 모델명 체크
    existing_model = crud.inspection_model.get_by_name(db=db, model_name=inspection_model_in.model_name)
    if existing_model:
        raise HTTPException(status_code=400, detail="Model name already exists")
    
    inspection_model = crud.inspection_model.create_with_steps(db=db, obj_in=inspection_model_in)
    return inspection_model

@router.get("/{id}", response_model=schemas.InspectionModelResponse)
def read_inspection_model(
    *,
    db: Session = Depends(get_db),
    id: int,
) -> Any:
    """특정 ID의 검사 모델을 조회합니다."""
    inspection_model = crud.inspection_model.get(db=db, id=id)
    if not inspection_model:
        raise HTTPException(status_code=404, detail="Inspection model not found")
    return inspection_model

@router.put("/{id}", response_model=schemas.InspectionModelResponse)
def update_inspection_model(
    *,
    db: Session = Depends(get_db),
    id: int,
    inspection_model_in: schemas.InspectionModelUpdate,
) -> Any:
    """검사 모델을 업데이트합니다."""
    inspection_model = crud.inspection_model.get(db=db, id=id)
    if not inspection_model:
        raise HTTPException(status_code=404, detail="Inspection model not found")
    
    # 모델명 중복 체크 (다른 모델의 이름과 중복되는지)
    if inspection_model_in.model_name:
        existing_model = crud.inspection_model.get_by_name(db=db, model_name=inspection_model_in.model_name)
        if existing_model and existing_model.id != id:
            raise HTTPException(status_code=400, detail="Model name already exists")
    
    inspection_model = crud.inspection_model.update_with_steps(db=db, db_obj=inspection_model, obj_in=inspection_model_in)
    return inspection_model

@router.delete("/{id}", response_model=schemas.InspectionModelResponse)
def delete_inspection_model(
    *,
    db: Session = Depends(get_db),
    id: int,
) -> Any:
    """검사 모델을 삭제합니다."""
    inspection_model = crud.inspection_model.get(db=db, id=id)
    if not inspection_model:
        raise HTTPException(status_code=404, detail="Inspection model not found")
    inspection_model = crud.inspection_model.remove(db=db, id=id)
    return inspection_model

@router.get("/name/{model_name}", response_model=schemas.InspectionModelResponse)
def read_inspection_model_by_name(
    *,
    db: Session = Depends(get_db),
    model_name: str,
) -> Any:
    """모델명으로 검사 모델을 조회합니다."""
    inspection_model = crud.inspection_model.get_by_name(db=db, model_name=model_name)
    if not inspection_model:
        raise HTTPException(status_code=404, detail="Inspection model not found")
    return inspection_model

@router.get("/active/list", response_model=List[schemas.InspectionModelResponse])
def get_active_inspection_models(
    *,
    db: Session = Depends(get_db),
) -> Any:
    """활성화된 검사 모델들을 조회합니다."""
    inspection_models = crud.inspection_model.get_active_models(db=db)
    return inspection_models