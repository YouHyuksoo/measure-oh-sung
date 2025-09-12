from typing import Any, List, Dict
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app import crud
from app.db.database import get_db
from app.services.serial_communication import serial_service
from app.services.scpi_commands import scpi_service

router = APIRouter()

class SerialCommandRequest(BaseModel):
    command: str
    delay: float = 0.1

class SerialConfigRequest(BaseModel):
    commands: List[str]

class DeviceTestRequest(BaseModel):
    device_id: int

@router.get("/ports")
def get_available_ports() -> Dict[str, List[str]]:
    """사용 가능한 시리얼 포트 목록을 조회합니다."""
    ports = serial_service.get_available_ports()
    return {"available_ports": ports}

@router.post("/devices/{device_id}/connect")
def connect_device(
    device_id: int,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """장비에 연결합니다."""
    device = crud.device.get(db=db, id=device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    success = serial_service.connect_device(device)
    
    if success:
        # 데이터베이스의 연결 상태 업데이트
        from app.models.device import ConnectionStatus
        device_update = {"connection_status": ConnectionStatus.CONNECTED}
        crud.device.update(db=db, db_obj=device, obj_in=device_update)
        
        return {"success": True, "message": f"Connected to device {device.name}"}
    else:
        device_update = {"connection_status": ConnectionStatus.ERROR}
        crud.device.update(db=db, db_obj=device, obj_in=device_update)
        raise HTTPException(status_code=400, detail="Failed to connect to device")

@router.post("/devices/{device_id}/disconnect")
def disconnect_device(
    device_id: int,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """장비 연결을 해제합니다."""
    device = crud.device.get(db=db, id=device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    success = serial_service.disconnect_device(device_id)
    
    # 데이터베이스의 연결 상태 업데이트
    from app.models.device import ConnectionStatus
    device_update = {"connection_status": ConnectionStatus.DISCONNECTED}
    crud.device.update(db=db, db_obj=device, obj_in=device_update)
    
    return {"success": success, "message": f"Disconnected from device {device.name}"}

@router.get("/devices/{device_id}/status")
def get_device_status(
    device_id: int,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """장비 연결 상태를 조회합니다."""
    device = crud.device.get(db=db, id=device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    is_connected = serial_service.is_connected(device_id)
    
    return {
        "device_id": device_id,
        "device_name": device.name,
        "port": device.port,
        "is_connected": is_connected,
        "db_status": device.connection_status
    }

@router.post("/devices/{device_id}/send-command")
def send_command(
    device_id: int,
    request: SerialCommandRequest,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """SCPI 명령을 전송합니다."""
    device = crud.device.get(db=db, id=device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    if not serial_service.is_connected(device_id):
        raise HTTPException(status_code=400, detail="Device not connected")
    
    # 명령어 유효성 검사
    validation = scpi_service.validate_command(request.command)
    if not validation["valid"]:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid command: {', '.join(validation['issues'])}"
        )
    
    response = serial_service.send_command(device_id, request.command, request.delay)
    
    return {
        "command": request.command,
        "response": response,
        "success": response is not None,
        "device_id": device_id
    }

@router.post("/devices/{device_id}/query-info")
def query_device_info(
    device_id: int,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """장비 정보를 조회합니다."""
    device = crud.device.get(db=db, id=device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    if not serial_service.is_connected(device_id):
        raise HTTPException(status_code=400, detail="Device not connected")
    
    device_info = serial_service.query_device_info(device_id, device.idn_command)
    
    if device_info:
        # 장비 정보를 데이터베이스에 업데이트
        if "manufacturer" in device_info:
            update_data = {
                "manufacturer": device_info.get("manufacturer"),
                "model": device_info.get("model"),
                "firmware_version": device_info.get("firmware_version")
            }
            crud.device.update(db=db, db_obj=device, obj_in=update_data)
        
        return {
            "device_id": device_id,
            "info": device_info,
            "success": True
        }
    else:
        return {
            "device_id": device_id,
            "info": None,
            "success": False,
            "message": "No response from device"
        }

@router.post("/devices/{device_id}/read-measurement")
def read_measurement(
    device_id: int,
    command: str = "MEAS:VOLT:DC?",
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """측정값을 읽습니다."""
    device = crud.device.get(db=db, id=device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    if not serial_service.is_connected(device_id):
        raise HTTPException(status_code=400, detail="Device not connected")
    
    value = serial_service.read_measurement(device_id, command)
    
    return {
        "device_id": device_id,
        "command": command,
        "value": value,
        "success": value is not None,
        "unit": "V" if "VOLT" in command.upper() else "A" if "CURR" in command.upper() else "Ω" if "RES" in command.upper() else ""
    }

@router.post("/devices/{device_id}/configure")
def configure_device(
    device_id: int,
    request: SerialConfigRequest,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """장비를 설정합니다."""
    device = crud.device.get(db=db, id=device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    if not serial_service.is_connected(device_id):
        raise HTTPException(status_code=400, detail="Device not connected")
    
    # 모든 명령어 유효성 검사
    for command in request.commands:
        validation = scpi_service.validate_command(command)
        if not validation["valid"]:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid command '{command}': {', '.join(validation['issues'])}"
            )
    
    success = serial_service.configure_measurement(device_id, request.commands)
    
    return {
        "device_id": device_id,
        "commands": request.commands,
        "success": success,
        "message": f"Configured device with {len(request.commands)} commands" if success else "Configuration failed"
    }

@router.post("/devices/{device_id}/test")
def test_device_connection(
    device_id: int,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """장비 연결을 테스트합니다."""
    device = crud.device.get(db=db, id=device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    test_result = serial_service.test_connection(device)
    
    # 테스트 결과에 따라 데이터베이스 상태 업데이트
    from app.models.device import ConnectionStatus
    if test_result["success"]:
        device_update = {"connection_status": ConnectionStatus.CONNECTED}
        if test_result.get("device_info"):
            device_info = test_result["device_info"]
            device_update.update({
                "manufacturer": device_info.get("manufacturer"),
                "model": device_info.get("model"),
                "firmware_version": device_info.get("firmware_version")
            })
    else:
        device_update = {"connection_status": ConnectionStatus.ERROR}
    
    crud.device.update(db=db, db_obj=device, obj_in=device_update)
    
    return {
        "device_id": device_id,
        "device_name": device.name,
        "test_result": test_result
    }

@router.get("/commands/{device_type}")
def get_device_commands(device_type: str) -> Dict[str, Any]:
    """장비 타입별 사용 가능한 SCPI 명령어를 조회합니다."""
    commands = scpi_service.get_device_commands("", device_type.upper())
    
    return {
        "device_type": device_type,
        "commands": commands
    }

@router.post("/commands/validate")
def validate_command(request: SerialCommandRequest) -> Dict[str, Any]:
    """SCPI 명령어의 유효성을 검사합니다."""
    validation = scpi_service.validate_command(request.command)
    help_info = scpi_service.get_command_help(request.command)
    
    return {
        "command": request.command,
        "validation": validation,
        "help": help_info
    }