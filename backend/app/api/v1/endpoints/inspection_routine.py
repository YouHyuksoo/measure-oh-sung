from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.db.database import get_db
from app.services.inspection_routine import inspection_service
from app import crud

router = APIRouter()

class BarcodeRequest(BaseModel):
    barcode: str
    inspection_model_id: int

class InspectionControlRequest(BaseModel):
    action: str  # "start_listening", "stop", "pause", "resume"

@router.get("/status")
async def get_inspection_status() -> Dict[str, Any]:
    """현재 검사 루틴 상태를 조회합니다."""
    status = inspection_service.get_current_status()
    return {
        "inspection_status": status,
        "timestamp": status["timestamp"]
    }

@router.post("/start-listening")
async def start_barcode_listening(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """바코드 스캔 대기 모드를 시작합니다."""
    
    # 활성화된 테스트 설정 확인
    test_settings = crud.test_settings.get_active(db=db)
    if not test_settings:
        raise HTTPException(
            status_code=400, 
            detail="No active test settings found. Please configure test settings first."
        )
    
    # 연결된 장비 확인
    connected_devices = crud.device.get_connected_devices(db=db)
    if not connected_devices:
        raise HTTPException(
            status_code=400,
            detail="No connected measurement devices found. Please connect devices first."
        )
    
    background_tasks.add_task(inspection_service.start_barcode_listening, db)
    
    return {
        "success": True,
        "message": "Started listening for barcode scan",
        "test_settings": {
            "id": test_settings.id,
            "name": test_settings.name,
            "p1_duration": test_settings.p1_measure_duration,
            "p2_duration": test_settings.p2_measure_duration,
            "p3_duration": test_settings.p3_measure_duration
        },
        "connected_devices": [
            {
                "id": device.id,
                "name": device.name,
                "port": device.port,
                "type": device.device_type
            }
            for device in connected_devices
        ]
    }

@router.post("/barcode-scan")
async def process_barcode_scan(
    request: BarcodeRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """바코드 스캔을 처리하고 검사 루틴을 시작합니다."""
    
    # 검사 모델 존재 확인
    inspection_model = crud.inspection_model.get(db=db, id=request.inspection_model_id)
    if not inspection_model:
        raise HTTPException(
            status_code=404,
            detail=f"Inspection model {request.inspection_model_id} not found"
        )
    
    # 검사 루틴 시작 (백그라운드에서 실행)
    result = await inspection_service.process_barcode_scan(
        request.barcode,
        request.inspection_model_id,
        db
    )
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    
    return {
        "success": True,
        "message": result["message"],
        "session_id": result["session_id"],
        "barcode": request.barcode,
        "inspection_model": {
            "id": inspection_model.id,
            "name": inspection_model.model_name,
            "limits": {
                "p1": {"lower": inspection_model.p1_lower_limit, "upper": inspection_model.p1_upper_limit},
                "p2": {"lower": inspection_model.p2_lower_limit, "upper": inspection_model.p2_upper_limit},
                "p3": {"lower": inspection_model.p3_lower_limit, "upper": inspection_model.p3_upper_limit}
            }
        }
    }

@router.post("/stop")
async def stop_inspection(
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """현재 진행 중인 검사 루틴을 중지합니다."""
    
    result = await inspection_service.stop_inspection(db)
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    
    return result

@router.get("/models")
def get_inspection_models(
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """사용 가능한 검사 모델 목록을 조회합니다."""
    
    active_models = crud.inspection_model.get_active_models(db=db)
    
    models_info = []
    for model in active_models:
        models_info.append({
            "id": model.id,
            "name": model.model_name,
            "description": model.description,
            "limits": {
                "p1": {"lower": model.p1_lower_limit, "upper": model.p1_upper_limit},
                "p2": {"lower": model.p2_lower_limit, "upper": model.p2_upper_limit},
                "p3": {"lower": model.p3_lower_limit, "upper": model.p3_upper_limit}
            }
        })
    
    return {
        "models": models_info,
        "total": len(models_info)
    }

@router.get("/test-settings")
def get_current_test_settings(
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """현재 활성화된 테스트 설정을 조회합니다."""
    
    test_settings = crud.test_settings.get_active(db=db)
    
    if not test_settings:
        raise HTTPException(
            status_code=404,
            detail="No active test settings found"
        )
    
    return {
        "settings": {
            "id": test_settings.id,
            "name": test_settings.name,
            "description": test_settings.description,
            "durations": {
                "p1_measure": test_settings.p1_measure_duration,
                "wait_1_to_2": test_settings.wait_duration_1_to_2,
                "p2_measure": test_settings.p2_measure_duration,
                "wait_2_to_3": test_settings.wait_duration_2_to_3,
                "p3_measure": test_settings.p3_measure_duration
            },
            "total_duration": (
                test_settings.p1_measure_duration +
                test_settings.wait_duration_1_to_2 +
                test_settings.p2_measure_duration +
                test_settings.wait_duration_2_to_3 +
                test_settings.p3_measure_duration
            )
        }
    }

@router.get("/connected-devices")
def get_connected_devices(
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """연결된 측정 장비 목록을 조회합니다."""
    
    connected_devices = crud.device.get_connected_devices(db=db)
    
    devices_info = []
    for device in connected_devices:
        devices_info.append({
            "id": device.id,
            "name": device.name,
            "type": device.device_type,
            "manufacturer": device.manufacturer,
            "model": device.model,
            "port": device.port,
            "status": device.connection_status
        })
    
    return {
        "devices": devices_info,
        "total": len(devices_info)
    }

@router.post("/simulate-barcode")
async def simulate_barcode_scan(
    barcode: str,
    inspection_model_id: int,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """바코드 스캔을 시뮬레이션합니다 (테스트용)."""
    
    request = BarcodeRequest(
        barcode=barcode,
        inspection_model_id=inspection_model_id
    )
    
    return await process_barcode_scan(request, None, db)