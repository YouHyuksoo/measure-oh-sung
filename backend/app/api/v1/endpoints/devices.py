from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import crud, schemas
from app.db.database import get_db
from app.models.device import DeviceType, ConnectionStatus

router = APIRouter()

@router.get("/", response_model=List[schemas.DeviceResponse])
def read_devices(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """모든 장비를 조회합니다."""
    devices = crud.device.get_multi(db, skip=skip, limit=limit)
    return devices

@router.post("/", response_model=schemas.DeviceResponse)
def create_device(
    *,
    db: Session = Depends(get_db),
    device_in: schemas.DeviceCreate,
) -> Any:
    """새로운 장비를 등록합니다."""
    # 포트 중복 체크
    existing_device = crud.device.get_by_port(db=db, port=device_in.port)
    if existing_device:
        raise HTTPException(status_code=400, detail="Port already in use")
    
    device = crud.device.create(db=db, obj_in=device_in)
    return device

@router.get("/{id}", response_model=schemas.DeviceResponse)
def read_device(
    *,
    db: Session = Depends(get_db),
    id: int,
) -> Any:
    """특정 ID의 장비를 조회합니다."""
    device = crud.device.get(db=db, id=id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    return device

@router.put("/{id}", response_model=schemas.DeviceResponse)
def update_device(
    *,
    db: Session = Depends(get_db),
    id: int,
    device_in: schemas.DeviceUpdate,
) -> Any:
    """장비 정보를 업데이트합니다."""
    device = crud.device.get(db=db, id=id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    # 포트 중복 체크 (다른 장비가 사용하고 있는지)
    if device_in.port:
        existing_device = crud.device.get_by_port(db=db, port=device_in.port)
        if existing_device and existing_device.id != id:
            raise HTTPException(status_code=400, detail="Port already in use")
    
    device = crud.device.update(db=db, db_obj=device, obj_in=device_in)
    return device

@router.delete("/{id}", response_model=schemas.DeviceResponse)
def delete_device(
    *,
    db: Session = Depends(get_db),
    id: int,
) -> Any:
    """장비를 삭제합니다."""
    device = crud.device.get(db=db, id=id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    device = crud.device.remove(db=db, id=id)
    return device

@router.get("/type/{device_type}", response_model=List[schemas.DeviceResponse])
def read_devices_by_type(
    *,
    db: Session = Depends(get_db),
    device_type: DeviceType,
) -> Any:
    """장비 타입별로 조회합니다."""
    devices = crud.device.get_by_type(db=db, device_type=device_type)
    return devices

@router.get("/active/list", response_model=List[schemas.DeviceResponse])
def get_active_devices(
    *,
    db: Session = Depends(get_db),
) -> Any:
    """활성화된 장비들을 조회합니다."""
    devices = crud.device.get_active_devices(db=db)
    return devices

@router.get("/connected/list", response_model=List[schemas.DeviceResponse])
def get_connected_devices(
    *,
    db: Session = Depends(get_db),
) -> Any:
    """연결된 장비들을 조회합니다."""
    devices = crud.device.get_connected_devices(db=db)
    return devices