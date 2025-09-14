from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
import serial
import serial.tools.list_ports
from pydantic import BaseModel
from datetime import datetime
import threading
import asyncio

from app import crud, schemas
from app.db.database import get_db
from app.models import Device
from app.models.device import DeviceType, ConnectionStatus, CommandCategory
from app.schemas.barcode_scanner import (
    BarcodeScannerSettingsCreate, 
    BarcodeScannerSettingsUpdate, 
    BarcodeScannerSettingsResponse,
    BarcodeScannerStatus,
    BarcodeTestResult
)
import time

router = APIRouter()

# GPT-9000 시리즈 전용 모델들
class SerialPortInfo(BaseModel):
    name: str
    vendor: str = ""
    
class ConnectionRequest(BaseModel):
    port: str
    baud: int = 115200
    
class InterfaceConfig(BaseModel):
    type: str  # "USB" | "RS232" | "GPIB"
    baud: int = 115200
    
class InterfaceRequest(BaseModel):
    type: str
    baud: int = 115200
    port: Optional[str] = None
    
class TestIdnResponse(BaseModel):
    ok: bool
    response: str = ""
    code: str = ""
    message: str = ""

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

# 안전시험기 통신 관리 API
@router.get("/safety-tester/ports", response_model=List[SerialPortInfo])
def get_available_ports() -> Any:
    """사용 가능한 시리얼 포트 목록을 조회합니다."""
    try:
        ports = []
        for port_info in serial.tools.list_ports.comports():
            ports.append(SerialPortInfo(
                name=port_info.device,
                vendor=port_info.manufacturer or ""
            ))
        return ports
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"포트 조회 실패: {str(e)}")

@router.post("/safety-tester/connect")
def connect_to_port(connection: ConnectionRequest) -> Any:
    """지정된 포트로 연결합니다."""
    try:
        # 연결 테스트
        with serial.Serial(
            port=connection.port,
            baudrate=connection.baud,
            parity=serial.PARITY_NONE,
            stopbits=serial.STOPBITS_ONE,
            bytesize=serial.EIGHTBITS,
            timeout=2
        ) as ser:
            # 연결 성공
            pass
        
        return {"ok": True, "message": f"포트 {connection.port} 연결 성공"}
    except FileNotFoundError:
        return {"ok": False, "code": "PORT_NOT_EXISTS", "message": f"포트 {connection.port}가 존재하지 않습니다. 장치가 연결되어 있는지 확인하세요."}
    except PermissionError:
        return {"ok": False, "code": "PORT_BUSY", "message": f"포트 {connection.port}가 다른 프로그램에서 사용 중입니다."}
    except serial.SerialException as e:
        if "could not open port" in str(e).lower():
            return {"ok": False, "code": "PORT_NOT_EXISTS", "message": f"포트 {connection.port}를 열 수 없습니다. 장치 연결 상태를 확인하세요."}
        return {"ok": False, "code": "PORT_ERROR", "message": f"포트 연결 실패: {str(e)}"}
    except Exception as e:
        return {"ok": False, "code": "UNKNOWN_ERROR", "message": f"연결 오류: {str(e)}"}

@router.post("/safety-tester/disconnect")
def disconnect_from_port() -> Any:
    """포트 연결을 해제합니다."""
    return {"ok": True, "message": "연결 해제됨"}

@router.get("/safety-tester/interface")
def get_interface_config(db: Session = Depends(get_db)) -> Any:
    """현재 인터페이스 설정을 조회합니다."""
    # 안전시험기 장비 설정 조회
    safety_device = db.query(Device).filter(
        Device.device_type == "SAFETY_TESTER",
        Device.is_active == True
    ).first()

    if safety_device:
        interface_type = "RS232"  # 기본값
        if safety_device.port and safety_device.port.startswith("COM"):
            interface_type = "USB" if "USB" in (safety_device.manufacturer or "") else "RS232"

        return {
            "type": interface_type,
            "baud": safety_device.baud_rate or 115200,
            "port": safety_device.port
        }
    else:
        # 기본값 반환
        return InterfaceConfig(type="RS232", baud=115200)

@router.post("/safety-tester/interface")
def set_interface_config(config: InterfaceRequest, db: Session = Depends(get_db)) -> Any:
    """인터페이스 설정을 변경합니다."""
    valid_bauds = [9600, 19200, 38400, 57600, 115200]
    valid_types = ["USB", "RS232", "GPIB"]

    if config.type not in valid_types:
        return {"ok": False, "code": "INVALID_PARAM", "message": "유효하지 않은 인터페이스 타입"}

    if config.baud not in valid_bauds:
        return {"ok": False, "code": "INVALID_PARAM", "message": "유효하지 않은 보드레이트"}

    try:
        # 기존 안전시험기 장비 찾기 또는 생성
        safety_device = db.query(Device).filter(
            Device.device_type == "SAFETY_TESTER",
            Device.is_active == True
        ).first()

        if not safety_device:
            # 새로운 안전시험기 장비 생성
            safety_device = Device(
                name="GPT-9000 3대안전설비",
                device_type="SAFETY_TESTER",
                manufacturer="GPT",
                model="GPT-9000",
                port=config.port or "COM1",  # 전달받은 포트 또는 기본값
                baud_rate=config.baud,
                is_active=True
            )
            db.add(safety_device)
        else:
            # 기존 장비 설정 업데이트
            safety_device.baud_rate = config.baud
            if config.port:
                safety_device.port = config.port

        db.commit()
        return {"ok": True, "message": f"인터페이스 설정 저장됨: {config.type}, {config.baud}"}

    except Exception as e:
        db.rollback()
        return {"ok": False, "code": "DATABASE_ERROR", "message": f"설정 저장 실패: {str(e)}"}

@router.post("/safety-tester/test-idn", response_model=TestIdnResponse)
def test_device_idn(connection: ConnectionRequest) -> Any:
    """*IDN? 명령으로 장비 연결을 테스트합니다."""
    try:
        with serial.Serial(
            port=connection.port,
            baudrate=connection.baud,
            parity=serial.PARITY_NONE,
            stopbits=serial.STOPBITS_ONE,
            bytesize=serial.EIGHTBITS,
            timeout=3
        ) as ser:
            # *IDN? 명령 전송
            ser.write(b'*IDN?\n')
            ser.flush()
            
            # 응답 수신 (최대 3초 대기)
            response = ser.readline().decode('utf-8').strip()
            
            if response:
                return TestIdnResponse(
                    ok=True,
                    response=response,
                    message="연결 테스트 성공"
                )
            else:
                return TestIdnResponse(
                    ok=False,
                    code="TIMEOUT",
                    message="응답 시간 초과. 케이블 연결 및 보드레이트를 확인하세요."
                )
                
    except FileNotFoundError:
        return TestIdnResponse(
            ok=False,
            code="PORT_NOT_EXISTS",
            message=f"포트 {connection.port}가 존재하지 않습니다. GPT-9000 장비가 연결되어 있고 전원이 켜져 있는지 확인하세요."
        )
    except PermissionError:
        return TestIdnResponse(
            ok=False,
            code="PORT_BUSY",
            message=f"포트 {connection.port}가 다른 프로그램에서 사용 중입니다."
        )
    except serial.SerialException as e:
        if "could not open port" in str(e).lower():
            return TestIdnResponse(
                ok=False,
                code="PORT_NOT_EXISTS",
                message=f"포트 {connection.port}를 열 수 없습니다. 장비 연결 상태와 드라이버를 확인하세요."
            )
        return TestIdnResponse(
            ok=False,
            code="PORT_ERROR",
            message=f"시리얼 포트 오류: {str(e)}"
        )
    except Exception as e:
        return TestIdnResponse(
            ok=False,
            code="UNKNOWN_ERROR",
            message=f"테스트 실패: {str(e)}"
        )


# 글로벌 바코드 상태 관리 (실제 구현에서는 Redis나 DB 사용)
_barcode_state = {
    "is_listening": False,
    "connected_port": "",
    "last_barcode": "",
    "scan_count": 0
}

# 실제 시리얼 포트 연결 객체 저장
_barcode_serial_connection = None

# 바코드 스캐너 설정 관리 API
@router.get("/barcode/settings", response_model=List[BarcodeScannerSettingsResponse])
def get_barcode_scanner_settings(
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db)
):
    """모든 바코드 스캐너 설정 조회"""
    from app.crud.barcode_scanner import get_barcode_scanner_settings
    settings = get_barcode_scanner_settings(db, skip=skip, limit=limit)
    return settings


@router.get("/barcode/settings/active", response_model=Optional[BarcodeScannerSettingsResponse])
def get_active_barcode_scanner_settings(db: Session = Depends(get_db)):
    """활성화된 바코드 스캐너 설정 조회"""
    from app.crud.barcode_scanner import get_active_barcode_scanner_settings
    settings = get_active_barcode_scanner_settings(db)
    return settings


@router.post("/barcode/settings", response_model=BarcodeScannerSettingsResponse)
def create_barcode_scanner_settings_endpoint(
    settings: BarcodeScannerSettingsCreate,
    db: Session = Depends(get_db)
):
    """새로운 바코드 스캐너 설정 생성"""
    from app.crud.barcode_scanner import create_barcode_scanner_settings
    return create_barcode_scanner_settings(db, settings)


@router.put("/barcode/settings/{settings_id}", response_model=BarcodeScannerSettingsResponse)
def update_barcode_scanner_settings_endpoint(
    settings_id: int,
    settings: BarcodeScannerSettingsUpdate,
    db: Session = Depends(get_db)
):
    """바코드 스캐너 설정 업데이트"""
    from app.crud.barcode_scanner import update_barcode_scanner_settings
    db_settings = update_barcode_scanner_settings(db, settings_id, settings)
    if not db_settings:
        raise HTTPException(status_code=404, detail="바코드 스캐너 설정을 찾을 수 없습니다")
    return db_settings


@router.delete("/barcode/settings/{settings_id}")
def delete_barcode_scanner_settings_endpoint(
    settings_id: int,
    db: Session = Depends(get_db)
):
    """바코드 스캐너 설정 삭제"""
    from app.crud.barcode_scanner import delete_barcode_scanner_settings
    success = delete_barcode_scanner_settings(db, settings_id)
    if not success:
        raise HTTPException(status_code=404, detail="바코드 스캐너 설정을 찾을 수 없습니다")
    return {"message": "바코드 스캐너 설정이 삭제되었습니다"}


@router.post("/barcode/settings/{settings_id}/activate", response_model=BarcodeScannerSettingsResponse)
def activate_barcode_scanner_settings_endpoint(
    settings_id: int,
    db: Session = Depends(get_db)
):
    """바코드 스캐너 설정 활성화"""
    from app.crud.barcode_scanner import activate_barcode_scanner_settings
    db_settings = activate_barcode_scanner_settings(db, settings_id)
    if not db_settings:
        raise HTTPException(status_code=404, detail="바코드 스캐너 설정을 찾을 수 없습니다")
    return db_settings

# 바코드 스캐너 관련 엔드포인트들
@router.get("/barcode/ports")
async def get_barcode_ports():
    """바코드 스캐너용 사용 가능한 시리얼 포트 목록 조회"""
    try:
        ports = serial.tools.list_ports.comports()
        available_ports = []
        
        # 자동 감지된 포트들
        for port in ports:
            available_ports.append({
                "port": port.device,
                "description": port.description,
                "hwid": port.hwid,
                "type": "detected"
            })
        
        # 수동 COM 포트들 (COM1-COM10)
        manual_ports = [f"COM{i}" for i in range(1, 11)]
        for port in manual_ports:
            if not any(p["port"] == port for p in available_ports):
                available_ports.append({
                    "port": port,
                    "description": "수동 선택 포트",
                    "hwid": "",
                    "type": "manual"
                })
        
        return {"ports": available_ports}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"포트 스캔 실패: {str(e)}")


@router.post("/barcode/connect")
async def connect_barcode_scanner(
    settings: BarcodeScannerSettingsCreate,
    db: Session = Depends(get_db)
):
    """바코드 스캐너 연결 및 설정 저장"""
    connection = None
    try:
        # 시리얼 연결 테스트
        connection = serial.Serial(
            port=settings.port,
            baudrate=settings.baudrate,
            bytesize=settings.data_bits,
            stopbits=settings.stop_bits,
            parity=settings.parity,
            timeout=settings.timeout
        )
        
        if connection.is_open:
            # 연결 테스트 성공 - 설정을 데이터베이스에 저장
            try:
                from app.crud.barcode_scanner import create_barcode_scanner_settings
                db_settings = create_barcode_scanner_settings(db, settings)
                
                # 바코드 상태 업데이트
                _barcode_state["connected_port"] = settings.port
                
                return {
                    "success": True,
                    "message": f"바코드 스캐너 포트 {settings.port} 연결 성공 및 설정 저장됨",
                    "settings_id": db_settings.id,
                    "port": settings.port,
                    "settings": {
                        "baudrate": settings.baudrate,
                        "data_bits": settings.data_bits,
                        "stop_bits": settings.stop_bits,
                        "parity": settings.parity,
                        "timeout": settings.timeout
                    }
                }
            except Exception as db_error:
                import traceback
                error_detail = f"데이터베이스 저장 실패: {str(db_error)}\n{traceback.format_exc()}"
                print(f"바코드 스캐너 DB 저장 에러: {error_detail}")
                raise HTTPException(status_code=500, detail=f"데이터베이스 저장 실패: {str(db_error)}")
        else:
            raise HTTPException(status_code=400, detail="포트 연결 실패")
            
    except serial.SerialException as e:
        error_msg = f"포트 {settings.port} 연결 실패"
        if "could not open port" in str(e).lower():
            error_msg += " - 포트가 존재하지 않거나 이미 사용 중입니다"
        elif "access is denied" in str(e).lower():
            error_msg += " - 포트 접근이 거부되었습니다 (권한 부족 또는 다른 프로그램에서 사용 중)"
        else:
            error_msg += f" - {str(e)}"
        raise HTTPException(status_code=400, detail=error_msg)
    
    except Exception as e:
        import traceback
        error_detail = f"연결 실패: {str(e)}\n{traceback.format_exc()}"
        print(f"바코드 스캐너 연결 에러: {error_detail}")
        raise HTTPException(status_code=500, detail=f"연결 실패: {str(e)}")
    
    finally:
        # 연결 테스트 후 포트 닫기
        if connection and connection.is_open:
            connection.close()


@router.post("/barcode/test-read")
async def test_barcode_read(
    port: str = Body(..., embed=True),
    baudrate: int = Body(9600, embed=True),
    data_bits: int = Body(8, embed=True),
    stop_bits: int = Body(1, embed=True),
    parity: str = Body("N", embed=True),
    timeout: int = Body(3, embed=True)
):
    """바코드 스캐너 데이터 읽기 테스트"""
    try:
        # 시리얼 연결 설정
        connection = serial.Serial(
            port=port,
            baudrate=baudrate,
            bytesize=data_bits,
            stopbits=stop_bits,
            parity=parity,
            timeout=timeout
        )
        
        if connection.is_open:
            # 데이터 읽기 시도 (최대 3초 대기)
            connection.write(b'\r\n')  # 일부 스캐너는 명령이 필요
            data = connection.readline()
            
            connection.close()
            
            if data:
                try:
                    decoded_data = data.decode('utf-8').strip()
                    return {
                        "success": True,
                        "message": "바코드 데이터 읽기 테스트 성공",
                        "data": decoded_data,
                        "raw_data": data.hex()
                    }
                except UnicodeDecodeError:
                    return {
                        "success": True,
                        "message": "바이너리 데이터 수신됨",
                        "data": "바이너리 데이터",
                        "raw_data": data.hex()
                    }
            else:
                return {
                    "success": False,
                    "message": "바코드 데이터를 받지 못했습니다. 바코드를 스캔해주세요.",
                    "data": None
                }
        else:
            raise HTTPException(status_code=400, detail="포트 연결 실패")
            
    except serial.SerialException as e:
        error_msg = f"포트 {port} 테스트 실패"
        if "could not open port" in str(e).lower():
            error_msg += " - 포트가 존재하지 않거나 이미 사용 중입니다"
        elif "access is denied" in str(e).lower():
            error_msg += " - 포트 접근이 거부되었습니다"
        else:
            error_msg += f" - {str(e)}"
        raise HTTPException(status_code=400, detail=error_msg)
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"테스트 실패: {str(e)}")


@router.post("/barcode/start-listening")
async def start_barcode_listening(db: Session = Depends(get_db)):
    """바코드 스캐너 실시간 감청 시작 (저장된 설정 사용)"""
    global _barcode_serial_connection
    print(f"🚀 [BACKEND] start_barcode_listening API 호출됨")

    try:
        # 데이터베이스에서 활성 설정 조회
        print(f"🔍 [BACKEND] 활성화된 바코드 스캐너 설정 조회 중...")
        from app.crud.barcode_scanner import get_active_barcode_scanner_settings
        active_settings = get_active_barcode_scanner_settings(db)
        if not active_settings:
            print(f"❌ [BACKEND] 활성화된 바코드 스캐너 설정이 없음")
            raise HTTPException(status_code=404, detail="활성화된 바코드 스캐너 설정이 없습니다. 먼저 장비 관리에서 바코드 스캐너를 설정해주세요.")
        
        print(f"✅ [BACKEND] 바코드 스캐너 설정 조회 성공:")
        print(f"   - ID: {active_settings.id}")
        print(f"   - 포트: {active_settings.port}")
        print(f"   - 보드레이트: {active_settings.baudrate}")
        print(f"   - 데이터 비트: {active_settings.data_bits}")
        print(f"   - 패리티: {active_settings.parity}")
        print(f"   - 스톱 비트: {active_settings.stop_bits}")
        print(f"   - 타임아웃: {active_settings.timeout}")
        
        # 기존 연결이 있으면 먼저 해제
        print(f"🔍 [BACKEND] 기존 연결 확인 중...")
        if _barcode_serial_connection and _barcode_serial_connection.is_open:
            print(f"⚠️ [BACKEND] 기존 연결 발견 - 해제 중...")
            _barcode_serial_connection.close()
            _barcode_serial_connection = None
            print(f"✅ [BACKEND] 기존 연결 해제 완료")
        else:
            print(f"ℹ️ [BACKEND] 기존 연결 없음")
        
        # 실제 시리얼 포트 연결 시도
        print(f"🔌 [BACKEND] 시리얼 포트 연결 시도 중...")
        print(f"📡 [BACKEND] 연결 파라미터:")
        print(f"   - 포트: {active_settings.port}")
        print(f"   - 보드레이트: {active_settings.baudrate}")
        print(f"   - 데이터 비트: {active_settings.data_bits}")
        print(f"   - 패리티: {active_settings.parity}")
        print(f"   - 스톱 비트: {active_settings.stop_bits}")
        print(f"   - 타임아웃: {active_settings.timeout}")
        
        try:
            _barcode_serial_connection = serial.Serial(
                port=active_settings.port,
                baudrate=active_settings.baudrate,
                bytesize=active_settings.data_bits,
                parity=active_settings.parity,
                stopbits=active_settings.stop_bits,
                timeout=active_settings.timeout
            )
            
            print(f"✅ [BACKEND] 시리얼 객체 생성 완료")
            
            # 연결 테스트
            print(f"🔍 [BACKEND] 연결 상태 확인 중...")
            print(f"📊 [BACKEND] connection.is_open: {_barcode_serial_connection.is_open}")
            
            if _barcode_serial_connection.is_open:
                print(f"✅ [BACKEND] 시리얼 포트 열기 성공!")
                
                # 바코드 상태 업데이트
                print(f"💾 [BACKEND] 바코드 상태 업데이트 중...")
                _barcode_state["is_listening"] = True
                _barcode_state["connected_port"] = active_settings.port
                print(f"✅ [BACKEND] 바코드 상태 업데이트 완료:")
                print(f"   - is_listening: {_barcode_state['is_listening']}")
                print(f"   - connected_port: {_barcode_state['connected_port']}")
                
                # 바코드 수신 태스크 시작
                print(f"🔄 [BACKEND] 바코드 수신 태스크 시작 중...")
                await start_barcode_task()
                print(f"✅ [BACKEND] 바코드 수신 태스크 시작 완료")
                
                response = {
                    "success": True,
                    "message": f"바코드 스캐너 실시간 감청 시작: {active_settings.port}",
                    "settings": {
                        "port": active_settings.port,
                        "baudrate": active_settings.baudrate,
                        "data_bits": active_settings.data_bits,
                        "stop_bits": active_settings.stop_bits,
                        "parity": active_settings.parity,
                        "timeout": active_settings.timeout
                    }
                }
                print(f"📤 [BACKEND] 성공 응답 전송: {response}")
                return response
            else:
                print(f"❌ [BACKEND] 시리얼 포트 열기 실패!")
                raise Exception("시리얼 포트 연결 실패")
                
        except serial.SerialException as e:
            print(f"❌ [BACKEND] 시리얼 포트 연결 예외 발생!")
            print(f"📋 [BACKEND] SerialException 상세:")
            print(f"   - 에러 타입: {type(e).__name__}")
            print(f"   - 에러 메시지: {str(e)}")
            print(f"   - 에러 코드: {getattr(e, 'errno', 'N/A')}")
            
            # 시리얼 포트 연결 실패
            _barcode_state["is_listening"] = False
            _barcode_state["connected_port"] = ""
            print(f"💾 [BACKEND] 바코드 상태 에러로 업데이트:")
            print(f"   - is_listening: {_barcode_state['is_listening']}")
            print(f"   - connected_port: {_barcode_state['connected_port']}")
            
            raise Exception(f"시리얼 포트 {active_settings.port} 연결 실패: {str(e)}")
            
    except Exception as e:
        print(f"❌ [BACKEND] 바코드 스캐너 감청 시작 실패!")
        print(f"📋 [BACKEND] Exception 상세:")
        print(f"   - 에러 타입: {type(e).__name__}")
        print(f"   - 에러 메시지: {str(e)}")
        
        import traceback
        error_detail = f"바코드 스캐너 감청 시작 실패: {str(e)}\n{traceback.format_exc()}"
        print(f"📋 [BACKEND] 스택 트레이스: {error_detail}")
        
        _barcode_state["is_listening"] = False
        _barcode_state["connected_port"] = ""
        print(f"💾 [BACKEND] 바코드 상태 에러로 업데이트:")
        print(f"   - is_listening: {_barcode_state['is_listening']}")
        print(f"   - connected_port: {_barcode_state['connected_port']}")
        
        raise HTTPException(status_code=500, detail=f"바코드 감청 시작 실패: {str(e)}")


@router.post("/barcode/stop-listening")
async def stop_barcode_listening():
    """바코드 스캐너 실시간 감청 중지"""
    global _barcode_serial_connection
    
    try:
        # 바코드 수신 태스크 중지
        stop_barcode_task()
        
        # 실제 시리얼 포트 연결 해제
        if _barcode_serial_connection and _barcode_serial_connection.is_open:
            _barcode_serial_connection.close()
            _barcode_serial_connection = None
        
        # 바코드 상태 업데이트
        _barcode_state["is_listening"] = False
        _barcode_state["connected_port"] = ""
        
        return {
            "success": True,
            "message": "바코드 스캐너 실시간 감청 중지됨"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"바코드 감청 중지 실패: {str(e)}")


@router.get("/barcode/status", response_model=BarcodeScannerStatus)
async def get_barcode_status(db: Session = Depends(get_db)):
    """바코드 스캐너 상태 조회"""
    global _barcode_serial_connection

    try:
        # 데이터베이스에서 활성 설정 조회
        from app.crud.barcode_scanner import get_active_barcode_scanner_settings
        active_settings = get_active_barcode_scanner_settings(db)
        
        # 실제 시리얼 포트 연결 상태 확인
        actual_is_connected = False
        actual_port = ""
        
        if _barcode_serial_connection and _barcode_serial_connection.is_open:
            try:
                # 포트가 실제로 열려있는지 확인
                actual_is_connected = True
                actual_port = _barcode_serial_connection.port
            except:
                # 포트가 닫혀있거나 오류가 있는 경우
                actual_is_connected = False
                actual_port = ""
                # 연결 객체 정리
                _barcode_serial_connection = None
        
        # 실제 상태와 메모리 상태 동기화
        if not actual_is_connected:
            _barcode_state["is_listening"] = False
            _barcode_state["connected_port"] = ""
        
        # 실제 상태 반환 (연결되지 않았더라도 설정된 포트 정보는 표시)
        configured_port = active_settings.port if active_settings else None
        display_port = actual_port if actual_is_connected else configured_port

        return BarcodeScannerStatus(
            is_connected=actual_is_connected,
            is_listening=_barcode_state["is_listening"],
            connected_port=display_port,
            last_barcode=_barcode_state["last_barcode"] if _barcode_state["last_barcode"] else None,
            scan_count=_barcode_state["scan_count"],
            settings=active_settings
        )
    except Exception as e:
        # 오류 발생 시 상태 초기화
        _barcode_state["is_listening"] = False
        _barcode_state["connected_port"] = ""
        return BarcodeScannerStatus(
            is_connected=False,
            is_listening=False,
            connected_port=None,
            last_barcode=None,
            scan_count=0,
            settings=None
        )


# 전력 측정 설비 관리 API
@router.get("/power-meter/ports", response_model=List[SerialPortInfo])
def get_power_meter_ports() -> Any:
    """전력 측정 설비용 사용 가능한 시리얼 포트 목록을 조회합니다."""
    try:
        ports = []
        for port_info in serial.tools.list_ports.comports():
            ports.append(SerialPortInfo(
                name=port_info.device,
                vendor=port_info.manufacturer or ""
            ))
        return ports
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"포트 조회 실패: {str(e)}")

@router.post("/power-meter/connect")
def connect_power_meter(connection: ConnectionRequest) -> Any:
    """전력 측정 설비와 연결합니다."""
    try:
        # 연결 테스트
        with serial.Serial(
            port=connection.port,
            baudrate=connection.baud,
            parity=serial.PARITY_NONE,
            stopbits=serial.STOPBITS_ONE,
            bytesize=serial.EIGHTBITS,
            timeout=2
        ) as ser:
            # 연결 성공
            pass

        return {"ok": True, "message": f"전력 측정 설비 포트 {connection.port} 연결 성공"}
    except FileNotFoundError:
        return {"ok": False, "code": "PORT_NOT_EXISTS", "message": f"포트 {connection.port}가 존재하지 않습니다. 전력 측정 설비가 연결되어 있는지 확인하세요."}
    except PermissionError:
        return {"ok": False, "code": "PORT_BUSY", "message": f"포트 {connection.port}가 다른 프로그램에서 사용 중입니다."}
    except serial.SerialException as e:
        if "could not open port" in str(e).lower():
            return {"ok": False, "code": "PORT_NOT_EXISTS", "message": f"포트 {connection.port}를 열 수 없습니다. 장치 연결 상태를 확인하세요."}
        return {"ok": False, "code": "PORT_ERROR", "message": f"포트 연결 실패: {str(e)}"}
    except Exception as e:
        return {"ok": False, "code": "UNKNOWN_ERROR", "message": f"연결 오류: {str(e)}"}

@router.post("/power-meter/disconnect")
def disconnect_power_meter() -> Any:
    """전력 측정 설비 연결을 해제합니다."""
    return {"ok": True, "message": "전력 측정 설비 연결 해제됨"}

@router.get("/power-meter/interface")
def get_power_meter_interface(db: Session = Depends(get_db)) -> Any:
    """전력 측정 설비 인터페이스 설정을 조회합니다."""
    # 전력측정설비 설정 조회
    power_device = db.query(Device).filter(
        Device.device_type == "POWER_METER",
        Device.is_active == True
    ).first()

    if power_device:
        interface_type = "RS232"  # 기본값
        if power_device.port and power_device.port.startswith("COM"):
            interface_type = "USB" if "USB" in (power_device.manufacturer or "") else "RS232"

        return {
            "type": interface_type,
            "baud": power_device.baud_rate or 9600,
            "port": power_device.port
        }
    else:
        # 기본값 반환
        return InterfaceConfig(type="RS232", baud=9600)

@router.post("/power-meter/interface")
def set_power_meter_interface(config: InterfaceRequest, db: Session = Depends(get_db)) -> Any:
    """전력 측정 설비 인터페이스 설정을 변경합니다."""
    valid_bauds = [9600, 19200, 38400, 57600, 115200]
    valid_types = ["USB", "RS232", "GPIB"]

    if config.type not in valid_types:
        return {"ok": False, "code": "INVALID_PARAM", "message": "유효하지 않은 인터페이스 타입"}

    if config.baud not in valid_bauds:
        return {"ok": False, "code": "INVALID_PARAM", "message": "유효하지 않은 보드레이트"}

    try:
        # 기존 전력측정설비 찾기 또는 생성
        power_device = db.query(Device).filter(
            Device.device_type == "POWER_METER",
            Device.is_active == True
        ).first()

        if not power_device:
            # 새로운 전력측정설비 생성
            power_device = Device(
                name="전력측정설비",
                device_type="POWER_METER",
                manufacturer="Generic",
                model="Power Meter",
                port=config.port or "COM1",  # 전달받은 포트 또는 기본값
                baud_rate=config.baud,
                is_active=True
            )
            db.add(power_device)
        else:
            # 기존 장비 설정 업데이트
            power_device.baud_rate = config.baud
            if config.port:
                power_device.port = config.port

        db.commit()
        return {"ok": True, "message": f"전력측정설비 인터페이스 설정 저장됨: {config.type}, {config.baud}"}

    except Exception as e:
        db.rollback()
        return {"ok": False, "code": "DATABASE_ERROR", "message": f"설정 저장 실패: {str(e)}"}

@router.post("/power-meter/test-idn", response_model=TestIdnResponse)
def test_power_meter_idn(connection: ConnectionRequest) -> Any:
    """전력 측정 설비 *IDN? 명령으로 연결을 테스트합니다."""
    try:
        with serial.Serial(
            port=connection.port,
            baudrate=connection.baud,
            parity=serial.PARITY_NONE,
            stopbits=serial.STOPBITS_ONE,
            bytesize=serial.EIGHTBITS,
            timeout=3
        ) as ser:
            # *IDN? 명령 전송
            ser.write(b'*IDN?\n')
            ser.flush()

            # 응답 수신 (최대 3초 대기)
            response = ser.readline().decode('utf-8').strip()

            if response:
                return TestIdnResponse(
                    ok=True,
                    response=response,
                    message="전력 측정 설비 연결 테스트 성공"
                )
            else:
                return TestIdnResponse(
                    ok=False,
                    code="TIMEOUT",
                    message="응답 시간 초과. 케이블 연결 및 보드레이트를 확인하세요."
                )

    except FileNotFoundError:
        return TestIdnResponse(
            ok=False,
            code="PORT_NOT_EXISTS",
            message=f"포트 {connection.port}가 존재하지 않습니다. 전력 측정 설비가 연결되어 있고 전원이 켜져 있는지 확인하세요."
        )
    except PermissionError:
        return TestIdnResponse(
            ok=False,
            code="PORT_BUSY",
            message=f"포트 {connection.port}가 다른 프로그램에서 사용 중입니다."
        )
    except serial.SerialException as e:
        if "could not open port" in str(e).lower():
            return TestIdnResponse(
                ok=False,
                code="PORT_NOT_EXISTS",
                message=f"포트 {connection.port}를 열 수 없습니다. 장비 연결 상태와 드라이버를 확인하세요."
            )
        return TestIdnResponse(
            ok=False,
            code="PORT_ERROR",
            message=f"시리얼 포트 오류: {str(e)}"
        )
    except Exception as e:
        return TestIdnResponse(
            ok=False,
            code="UNKNOWN_ERROR",
            message=f"테스트 실패: {str(e)}"
        )

# 검사 타이머 설정 관련 엔드포인트들

# 모든 검사 타이머 설정 조회 (모델별 포함)
@router.get("/inspection-timer/all-settings", response_model=List[schemas.InspectionTimerSettingsResponse])
async def get_all_inspection_timer_settings(
    db: Session = Depends(get_db),
    inspection_model_id: Optional[int] = None
):
    """모든 검사 타이머 설정을 조회합니다. 검사 모델 ID로 필터링 가능합니다."""
    try:
        if inspection_model_id is not None:
            # 특정 검사 모델의 설정들만 조회
            settings = crud.inspection_timer_settings.get_by_model(
                db=db, inspection_model_id=inspection_model_id
            )
        else:
            # 모든 설정 조회
            settings = crud.inspection_timer_settings.get_multi(db=db)

        return settings
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"검사 타이머 설정 조회 실패: {str(e)}")


# 검사 타이머 설정 생성
@router.post("/inspection-timer/create", response_model=schemas.InspectionTimerSettingsResponse)
async def create_inspection_timer_settings(
    *,
    db: Session = Depends(get_db),
    settings_in: schemas.InspectionTimerSettingsCreate
):
    """새로운 검사 타이머 설정을 생성합니다."""
    try:
        # 검사 모델 ID가 제공된 경우 해당 모델이 존재하는지 확인
        if settings_in.inspection_model_id is not None:
            inspection_model = crud.inspection_model.get(db=db, id=settings_in.inspection_model_id)
            if not inspection_model:
                raise HTTPException(status_code=404, detail="검사 모델을 찾을 수 없습니다")

        settings = crud.inspection_timer_settings.create(db=db, obj_in=settings_in)
        return settings
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"검사 타이머 설정 생성 실패: {str(e)}")


# 검사 타이머 설정 활성화
@router.post("/inspection-timer/{settings_id}/activate", response_model=schemas.InspectionTimerSettingsResponse)
async def activate_inspection_timer_settings(
    *,
    db: Session = Depends(get_db),
    settings_id: int
):
    """특정 검사 타이머 설정을 활성화합니다."""
    try:
        settings = crud.inspection_timer_settings.set_active(db=db, settings_id=settings_id)
        if not settings:
            raise HTTPException(status_code=404, detail="검사 타이머 설정을 찾을 수 없습니다")

        return settings
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"검사 타이머 설정 활성화 실패: {str(e)}")


@router.get("/inspection-timer/settings")
async def get_inspection_timer_settings(
    db: Session = Depends(get_db)
):
    """검사 타이머 설정 조회"""
    try:
        # 현재 활성화된 설정을 조회하거나 기본 설정을 생성
        settings = crud.inspection_timer_settings.get_current_settings(db=db)

        # 프론트엔드 호환성을 위해 기존 형식으로 반환
        return {
            "p1PrepareTime": settings.p1_prepare_time,
            "p1Duration": settings.p1_duration,
            "p2PrepareTime": settings.p2_prepare_time,
            "p2Duration": settings.p2_duration,
            "p3PrepareTime": settings.p3_prepare_time,
            "p3Duration": settings.p3_duration,
            "autoProgress": settings.auto_progress
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"검사 타이머 설정 조회 실패: {str(e)}")


@router.post("/inspection-timer/settings")
async def save_inspection_timer_settings(
    *,
    db: Session = Depends(get_db),
    p1PrepareTime: int = Body(...),
    p1Duration: int = Body(...),
    p2PrepareTime: int = Body(...),
    p2Duration: int = Body(...),
    p3PrepareTime: int = Body(...),
    p3Duration: int = Body(...),
    autoProgress: bool = Body(...)
):
    """검사 타이머 설정 저장"""
    try:
        # 유효성 검사
        if any(duration < 1 for duration in [p1Duration, p2Duration, p3Duration]):
            raise HTTPException(status_code=400, detail="검사 지속시간은 1초 이상이어야 합니다")

        if any(prepare < 0 for prepare in [p1PrepareTime, p2PrepareTime, p3PrepareTime]):
            raise HTTPException(status_code=400, detail="준비시간은 0초 이상이어야 합니다")

        # 현재 활성화된 설정을 가져오거나 기본 설정을 생성
        current_settings = crud.inspection_timer_settings.get_current_settings(db=db)

        # 설정 업데이트
        update_data = schemas.InspectionTimerSettingsUpdate(
            p1_prepare_time=p1PrepareTime,
            p1_duration=p1Duration,
            p2_prepare_time=p2PrepareTime,
            p2_duration=p2Duration,
            p3_prepare_time=p3PrepareTime,
            p3_duration=p3Duration,
            auto_progress=autoProgress
        )

        updated_settings = crud.inspection_timer_settings.update(
            db=db,
            db_obj=current_settings,
            obj_in=update_data
        )

        return {
            "success": True,
            "message": "검사 타이머 설정이 저장되었습니다",
            "settings": {
                "p1PrepareTime": updated_settings.p1_prepare_time,
                "p1Duration": updated_settings.p1_duration,
                "p2PrepareTime": updated_settings.p2_prepare_time,
                "p2Duration": updated_settings.p2_duration,
                "p3PrepareTime": updated_settings.p3_prepare_time,
                "p3Duration": updated_settings.p3_duration,
                "autoProgress": updated_settings.auto_progress
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"검사 타이머 설정 저장 실패: {str(e)}")


# 검사 타이머 설정 수정
@router.put("/inspection-timer/{settings_id}", response_model=schemas.InspectionTimerSettingsResponse)
async def update_inspection_timer_settings(
    *,
    db: Session = Depends(get_db),
    settings_id: int,
    settings_in: schemas.InspectionTimerSettingsUpdate
):
    """검사 타이머 설정을 수정합니다."""
    try:
        settings = crud.inspection_timer_settings.get(db=db, id=settings_id)
        if not settings:
            raise HTTPException(status_code=404, detail="검사 타이머 설정을 찾을 수 없습니다")

        # 검사 모델 ID가 변경된 경우 해당 모델이 존재하는지 확인
        if settings_in.inspection_model_id is not None:
            inspection_model = crud.inspection_model.get(db=db, id=settings_in.inspection_model_id)
            if not inspection_model:
                raise HTTPException(status_code=404, detail="검사 모델을 찾을 수 없습니다")

        updated_settings = crud.inspection_timer_settings.update(
            db=db, db_obj=settings, obj_in=settings_in
        )
        return updated_settings
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"검사 타이머 설정 수정 실패: {str(e)}")


# 검사 타이머 설정 삭제
@router.delete("/inspection-timer/{settings_id}", response_model=schemas.InspectionTimerSettingsResponse)
async def delete_inspection_timer_settings(
    *,
    db: Session = Depends(get_db),
    settings_id: int
):
    """검사 타이머 설정을 삭제합니다."""
    try:
        settings = crud.inspection_timer_settings.get(db=db, id=settings_id)
        if not settings:
            raise HTTPException(status_code=404, detail="검사 타이머 설정을 찾을 수 없습니다")

        deleted_settings = crud.inspection_timer_settings.remove(db=db, id=settings_id)
        return deleted_settings
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"검사 타이머 설정 삭제 실패: {str(e)}")


# Device Command 관리 API
@router.get("/{device_id}/commands", response_model=List[schemas.DeviceCommandResponse])
def get_device_commands(
    *,
    db: Session = Depends(get_db),
    device_id: int,
    category: Optional[CommandCategory] = None,
) -> Any:
    """특정 장비의 명령어 목록을 조회합니다."""
    device = crud.device.get(db=db, id=device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    commands = crud.device_command.get_by_device(db=db, device_id=device_id, category=category)
    return commands

@router.post("/{device_id}/commands", response_model=schemas.DeviceCommandResponse)
def create_device_command(
    *,
    db: Session = Depends(get_db),
    device_id: int,
    command_in: schemas.DeviceCommandCreate,
) -> Any:
    """장비에 새로운 명령어를 추가합니다."""
    device = crud.device.get(db=db, id=device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    # device_id 설정
    command_in.device_id = device_id
    command = crud.device_command.create(db=db, obj_in=command_in)
    return command

@router.get("/commands/{command_id}", response_model=schemas.DeviceCommandResponse)
def get_device_command(
    *,
    db: Session = Depends(get_db),
    command_id: int,
) -> Any:
    """특정 명령어를 조회합니다."""
    command = crud.device_command.get(db=db, id=command_id)
    if not command:
        raise HTTPException(status_code=404, detail="Command not found")
    return command

@router.put("/commands/{command_id}", response_model=schemas.DeviceCommandResponse)
def update_device_command(
    *,
    db: Session = Depends(get_db),
    command_id: int,
    command_in: schemas.DeviceCommandUpdate,
) -> Any:
    """명령어 정보를 업데이트합니다."""
    command = crud.device_command.get(db=db, id=command_id)
    if not command:
        raise HTTPException(status_code=404, detail="Command not found")

    command = crud.device_command.update(db=db, db_obj=command, obj_in=command_in)
    return command

@router.delete("/commands/{command_id}", response_model=schemas.DeviceCommandResponse)
def delete_device_command(
    *,
    db: Session = Depends(get_db),
    command_id: int,
) -> Any:
    """명령어를 삭제합니다."""
    command = crud.device_command.get(db=db, id=command_id)
    if not command:
        raise HTTPException(status_code=404, detail="Command not found")

    command = crud.device_command.remove(db=db, id=command_id)
    return command

@router.post("/commands/{command_id}/execute", response_model=schemas.CommandExecutionResponse)
def execute_device_command(
    *,
    db: Session = Depends(get_db),
    command_id: int,
    execution_request: schemas.CommandExecutionRequest,
) -> Any:
    """장비 명령어를 실행합니다."""
    start_time = time.time()

    command = crud.device_command.get(db=db, id=command_id)
    if not command:
        raise HTTPException(status_code=404, detail="Command not found")

    device = crud.device.get(db=db, id=command.device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    if not command.is_active:
        raise HTTPException(status_code=400, detail="Command is not active")

    try:
        # 매개변수 처리
        final_command = command.command
        if execution_request.parameters and command.parameters:
            for param_name, param_value in execution_request.parameters.items():
                if param_name in command.parameters:
                    final_command = final_command.replace(f"{{{param_name}}}", str(param_value))

        # 시리얼 통신으로 명령어 실행
        with serial.Serial(
            port=device.port,
            baudrate=device.baud_rate,
            bytesize=device.data_bits,
            stopbits=device.stop_bits,
            parity=device.parity,
            timeout=command.timeout
        ) as ser:
            # 명령어 전송
            command_bytes = final_command.encode('utf-8')
            if not final_command.endswith('\n'):
                command_bytes += b'\n'

            ser.write(command_bytes)
            ser.flush()

            response_data = None
            if command.has_response:
                # 응답 수신 대기
                response = ser.readline().decode('utf-8').strip()
                response_data = response

            execution_time = time.time() - start_time

            return schemas.CommandExecutionResponse(
                success=True,
                response_data=response_data,
                execution_time=execution_time,
                timestamp=datetime.now()
            )

    except serial.SerialException as e:
        execution_time = time.time() - start_time
        return schemas.CommandExecutionResponse(
            success=False,
            error_message=f"Serial communication error: {str(e)}",
            execution_time=execution_time,
            timestamp=datetime.now()
        )
    except Exception as e:
        execution_time = time.time() - start_time
        return schemas.CommandExecutionResponse(
            success=False,
            error_message=f"Command execution failed: {str(e)}",
            execution_time=execution_time,
            timestamp=datetime.now()
        )

@router.post("/{device_id}/commands/batch-create")
def create_default_commands(
    *,
    db: Session = Depends(get_db),
    device_id: int,
    device_type: DeviceType = Body(..., embed=True),
) -> Any:
    """장비 타입에 따른 기본 명령어 세트를 생성합니다."""
    device = crud.device.get(db=db, id=device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    # 기본 명령어 템플릿
    default_commands = {
        DeviceType.SAFETY_TESTER: [
            # IEEE 488.2 일반 명령어
            {
                "name": "장비 식별",
                "category": CommandCategory.IDENTIFICATION,
                "command": "*IDN?",
                "description": "장비 식별 정보 조회 (IEEE 488.2)",
                "has_response": True,
                "response_pattern": "GPT-9801,MODEL-PE200,FW1.1.0,SN000001,RMT",
                "order_sequence": 1
            },
            {
                "name": "시스템 클리어",
                "category": CommandCategory.CONTROL,
                "command": "*CLS",
                "description": "시스템 상태 클리어",
                "has_response": False,
                "order_sequence": 2
            },
            # 시스템 명령어
            {
                "name": "시스템 오류 조회",
                "category": CommandCategory.STATUS,
                "command": "SYSTem:ERRor?",
                "description": "시스템 오류 상태 조회",
                "has_response": True,
                "response_pattern": "0,\"No error\"",
                "order_sequence": 3
            },
            {
                "name": "LCD 밝기 설정",
                "category": CommandCategory.CONFIGURATION,
                "command": "SYSTem:LCD:BRIGhtness {brightness}",
                "description": "LCD 화면 밝기 설정",
                "has_response": False,
                "parameters": {"brightness": {"type": "int", "min": 1, "max": 100, "default": 50}},
                "parameter_description": "brightness: 밝기 (1-100)",
                "order_sequence": 4
            },
            {
                "name": "부저 통과음 설정",
                "category": CommandCategory.CONFIGURATION,
                "command": "SYSTem:BUZZer:PSOUND {enable}",
                "description": "검사 통과 시 부저음 설정",
                "has_response": False,
                "parameters": {"enable": {"type": "boolean", "default": True}},
                "parameter_description": "enable: 부저 사용 여부 (ON/OFF)",
                "order_sequence": 5
            },
            # 기능 명령어
            {
                "name": "테스트 기능 설정",
                "category": CommandCategory.CONTROL,
                "command": "FUNCtion:TEST {test_type}",
                "description": "테스트 기능 선택",
                "has_response": False,
                "parameters": {"test_type": {"type": "string", "options": ["ACW", "DCW", "IR", "GB"], "default": "ACW"}},
                "parameter_description": "test_type: 테스트 종류 (ACW/DCW/IR/GB)",
                "order_sequence": 6
            },
            {
                "name": "측정값 조회",
                "category": CommandCategory.MEASUREMENT,
                "command": "MEASure?",
                "description": "현재 측정값 조회",
                "has_response": True,
                "response_pattern": ">ACW, PASS, 1.500kV, 0.050mA, T=005.0S, R=001.0S",
                "order_sequence": 7
            },
            {
                "name": "지정 채널 측정값 조회",
                "category": CommandCategory.MEASUREMENT,
                "command": "MEASure{channel}?",
                "description": "지정 채널 측정값 조회",
                "has_response": True,
                "response_pattern": ">ACW, PASS, 1.500kV, 0.050mA, T=005.0S",
                "parameters": {"channel": {"type": "int", "min": 1, "max": 99, "default": 1}},
                "parameter_description": "channel: 측정 채널 번호 (1-99)",
                "order_sequence": 8
            },
            {
                "name": "수동/자동 모드 전환",
                "category": CommandCategory.CONTROL,
                "command": "MAIN:FUNCtion {mode}",
                "description": "수동/자동 모드 전환",
                "has_response": False,
                "parameters": {"mode": {"type": "string", "options": ["MANU", "AUTO"], "default": "MANU"}},
                "parameter_description": "mode: 동작 모드 (MANU/AUTO)",
                "order_sequence": 9
            },
            # ACW(AC 내전압) 테스트 명령어
            {
                "name": "ACW 전압 설정",
                "category": CommandCategory.CONFIGURATION,
                "command": "MANU:ACW:VOLTage {voltage}",
                "description": "AC 내전압 테스트 전압 설정 (0.05-5kV)",
                "has_response": False,
                "parameters": {"voltage": {"type": "float", "min": 0.05, "max": 5.0, "default": 1.5}},
                "parameter_description": "voltage: AC 테스트 전압 (kV)",
                "order_sequence": 10
            },
            {
                "name": "ACW 상한 전류 설정",
                "category": CommandCategory.CONFIGURATION,
                "command": "MANU:ACW:CHISet {current}",
                "description": "AC 내전압 테스트 상한 전류 설정",
                "has_response": False,
                "parameters": {"current": {"type": "float", "min": 0.001, "max": 40.0, "default": 1.0}},
                "parameter_description": "current: 상한 전류 (mA)",
                "order_sequence": 11
            },
            {
                "name": "ACW 테스트 시간 설정",
                "category": CommandCategory.CONFIGURATION,
                "command": "MANU:ACW:TTIMe {time}",
                "description": "AC 내전압 테스트 지속 시간 설정",
                "has_response": False,
                "parameters": {"time": {"type": "float", "min": 0.3, "max": 999.9, "default": 5.0}},
                "parameter_description": "time: 테스트 시간 (초)",
                "order_sequence": 12
            },
            {
                "name": "ACW 주파수 설정",
                "category": CommandCategory.CONFIGURATION,
                "command": "MANU:ACW:FREQuency {freq}",
                "description": "AC 내전압 테스트 주파수 설정",
                "has_response": False,
                "parameters": {"freq": {"type": "int", "options": [50, 60], "default": 60}},
                "parameter_description": "freq: 테스트 주파수 (50/60Hz)",
                "order_sequence": 13
            },
            # DCW(DC 내전압) 테스트 명령어
            {
                "name": "DCW 전압 설정",
                "category": CommandCategory.CONFIGURATION,
                "command": "MANU:DCW:VOLTage {voltage}",
                "description": "DC 내전압 테스트 전압 설정 (0.05-6kV)",
                "has_response": False,
                "parameters": {"voltage": {"type": "float", "min": 0.05, "max": 6.0, "default": 1.5}},
                "parameter_description": "voltage: DC 테스트 전압 (kV)",
                "order_sequence": 14
            },
            {
                "name": "DCW 상한 전류 설정",
                "category": CommandCategory.CONFIGURATION,
                "command": "MANU:DCW:CHISet {current}",
                "description": "DC 내전압 테스트 상한 전류 설정",
                "has_response": False,
                "parameters": {"current": {"type": "float", "min": 0.001, "max": 5.0, "default": 1.0}},
                "parameter_description": "current: 상한 전류 (mA)",
                "order_sequence": 15
            },
            {
                "name": "DCW 테스트 시간 설정",
                "category": CommandCategory.CONFIGURATION,
                "command": "MANU:DCW:TTIMe {time}",
                "description": "DC 내전압 테스트 지속 시간 설정",
                "has_response": False,
                "parameters": {"time": {"type": "float", "min": 0.3, "max": 999.9, "default": 5.0}},
                "parameter_description": "time: 테스트 시간 (초)",
                "order_sequence": 16
            },
            # IR(절연저항) 테스트 명령어
            {
                "name": "IR 전압 설정",
                "category": CommandCategory.CONFIGURATION,
                "command": "MANU:IR:VOLTage {voltage}",
                "description": "절연저항 테스트 전압 설정 (0.05-1kV)",
                "has_response": False,
                "parameters": {"voltage": {"type": "float", "min": 0.05, "max": 1.0, "default": 0.5}},
                "parameter_description": "voltage: IR 테스트 전압 (kV)",
                "order_sequence": 17
            },
            {
                "name": "IR 상한 저항 설정",
                "category": CommandCategory.CONFIGURATION,
                "command": "MANU:IR:RHISet {resistance}",
                "description": "절연저항 상한값 설정",
                "has_response": False,
                "parameters": {"resistance": {"type": "float", "min": 1, "max": 9999, "default": 100}},
                "parameter_description": "resistance: 상한 저항값 (MΩ)",
                "order_sequence": 18
            },
            {
                "name": "IR 테스트 시간 설정",
                "category": CommandCategory.CONFIGURATION,
                "command": "MANU:IR:TTIMe {time}",
                "description": "절연저항 테스트 지속 시간 설정",
                "has_response": False,
                "parameters": {"time": {"type": "float", "min": 0.3, "max": 999.9, "default": 5.0}},
                "parameter_description": "time: 테스트 시간 (초)",
                "order_sequence": 19
            },
            # GB(접지연속성) 테스트 명령어
            {
                "name": "GB 전류 설정",
                "category": CommandCategory.CONFIGURATION,
                "command": "MANU:GB:CURRent {current}",
                "description": "접지연속성 테스트 전류 설정",
                "has_response": False,
                "parameters": {"current": {"type": "float", "min": 1, "max": 30, "default": 10}},
                "parameter_description": "current: 테스트 전류 (A)",
                "order_sequence": 20
            },
            {
                "name": "GB 상한 저항 설정",
                "category": CommandCategory.CONFIGURATION,
                "command": "MANU:GB:RHISet {resistance}",
                "description": "접지연속성 상한 저항값 설정",
                "has_response": False,
                "parameters": {"resistance": {"type": "float", "min": 0.01, "max": 99.99, "default": 1.0}},
                "parameter_description": "resistance: 상한 저항값 (Ω)",
                "order_sequence": 21
            },
            {
                "name": "GB 테스트 시간 설정",
                "category": CommandCategory.CONFIGURATION,
                "command": "MANU:GB:TTIMe {time}",
                "description": "접지연속성 테스트 지속 시간 설정",
                "has_response": False,
                "parameters": {"time": {"type": "float", "min": 0.3, "max": 999.9, "default": 3.0}},
                "parameter_description": "time: 테스트 시간 (초)",
                "order_sequence": 22
            },
            # 수동 테스트 유틸리티
            {
                "name": "아크 모드 설정",
                "category": CommandCategory.CONFIGURATION,
                "command": "MANU:UTILity:ARCMode {mode}",
                "description": "아크 감지 모드 설정",
                "has_response": False,
                "parameters": {"mode": {"type": "string", "options": ["ON", "OFF"], "default": "ON"}},
                "parameter_description": "mode: 아크 감지 모드 (ON/OFF)",
                "order_sequence": 23
            },
            {
                "name": "통과 홀드 설정",
                "category": CommandCategory.CONFIGURATION,
                "command": "MANU:UTILity:PASShold {enable}",
                "description": "테스트 통과 시 결과 홀드 설정",
                "has_response": False,
                "parameters": {"enable": {"type": "boolean", "default": True}},
                "parameter_description": "enable: 통과 홀드 여부 (ON/OFF)",
                "order_sequence": 24
            },
            {
                "name": "스텝 설정",
                "category": CommandCategory.CONFIGURATION,
                "command": "MANU:STEP {step}",
                "description": "수동 테스트 스텝 설정",
                "has_response": False,
                "parameters": {"step": {"type": "int", "min": 1, "max": 99, "default": 1}},
                "parameter_description": "step: 테스트 스텝 번호 (1-99)",
                "order_sequence": 25
            },
            {
                "name": "런타임 설정",
                "category": CommandCategory.CONFIGURATION,
                "command": "MANU:RTIMe {time}",
                "description": "램프업 시간 설정",
                "has_response": False,
                "parameters": {"time": {"type": "float", "min": 0.1, "max": 99.9, "default": 1.0}},
                "parameter_description": "time: 램프업 시간 (초)",
                "order_sequence": 26
            },
            # 자동 테스트 명령어
            {
                "name": "자동 테스트 페이지 표시",
                "category": CommandCategory.CONTROL,
                "command": "AUTO{page}:PAGE:SHOW",
                "description": "자동 테스트 페이지 표시",
                "has_response": False,
                "parameters": {"page": {"type": "int", "min": 1, "max": 99, "default": 1}},
                "parameter_description": "page: 페이지 번호 (1-99)",
                "order_sequence": 27
            },
            {
                "name": "자동 테스트 추가",
                "category": CommandCategory.CONTROL,
                "command": "AUTO:EDIT:ADD {test_type}",
                "description": "자동 테스트에 테스트 항목 추가",
                "has_response": False,
                "parameters": {"test_type": {"type": "string", "options": ["ACW", "DCW", "IR", "GB"], "default": "ACW"}},
                "parameter_description": "test_type: 추가할 테스트 종류",
                "order_sequence": 28
            },
            # 실제 시험 실행 루틴 명령어들
            {
                "name": "시험 시작 (INIT)",
                "category": CommandCategory.CONTROL,
                "command": "INIT",
                "description": "설정된 조건으로 시험 실행 시작",
                "has_response": True,
                "response_pattern": "OK",
                "order_sequence": 29
            },
            {
                "name": "시험 중단 (ABORT)",
                "category": CommandCategory.CONTROL,
                "command": "ABORT",
                "description": "진행 중인 시험 강제 중단",
                "has_response": True,
                "response_pattern": "OK",
                "order_sequence": 30
            },
            {
                "name": "시험 진행 상태 조회",
                "category": CommandCategory.STATUS,
                "command": "STAT?",
                "description": "현재 시험 진행 상태 조회 (READY/TESTING/COMPLETE)",
                "has_response": True,
                "response_pattern": "READY",
                "order_sequence": 31
            },
            {
                "name": "ACW 시험 실행 및 결과",
                "category": CommandCategory.MEASUREMENT,
                "command": "MANU:ACW:TEST",
                "description": "ACW 시험 실행 (설정값으로 자동 실행)",
                "has_response": True,
                "response_pattern": ">ACW, PASS, 1.500kV, 0.050mA, T=005.0S, R=001.0S",
                "order_sequence": 32
            },
            {
                "name": "DCW 시험 실행 및 결과",
                "category": CommandCategory.MEASUREMENT,
                "command": "MANU:DCW:TEST",
                "description": "DCW 시험 실행 (설정값으로 자동 실행)",
                "has_response": True,
                "response_pattern": ">DCW, PASS, 1.500kV, 0.020mA, T=005.0S",
                "order_sequence": 33
            },
            {
                "name": "IR 시험 실행 및 결과",
                "category": CommandCategory.MEASUREMENT,
                "command": "MANU:IR:TEST",
                "description": "절연저항 시험 실행 (설정값으로 자동 실행)",
                "has_response": True,
                "response_pattern": ">IR, PASS, 0.500kV, 999M ohm, T=005.0S",
                "order_sequence": 34
            },
            {
                "name": "GB 시험 실행 및 결과",
                "category": CommandCategory.MEASUREMENT,
                "command": "MANU:GB:TEST",
                "description": "접지연속성 시험 실행 (설정값으로 자동 실행)",
                "has_response": True,
                "response_pattern": ">GB, PASS, 10.0A, 0.05 ohm, T=003.0S",
                "order_sequence": 35
            },
            {
                "name": "3대안전 순환 시험",
                "category": CommandCategory.MEASUREMENT,
                "command": "SEQUENCE:ACW:DCW:IR:GB",
                "description": "ACW→DCW→IR→GB 순서로 자동 순환 시험",
                "has_response": True,
                "response_pattern": "SEQUENCE_COMPLETE",
                "order_sequence": 36
            }
        ],
        DeviceType.POWER_METER: [
            # WT310 전력측정기 기본 명령어들
            {
                "name": "장비 식별",
                "category": CommandCategory.IDENTIFICATION,
                "command": "*IDN?",
                "description": "장비 식별 정보 조회",
                "has_response": True,
                "response_pattern": "YOKOGAWA,WT310,91GB12345,F3.05-//EN/1.00/1.00",
                "order_sequence": 1
            },
            {
                "name": "리셋",
                "category": CommandCategory.CONTROL,
                "command": "*RST",
                "description": "장비 초기화",
                "has_response": False,
                "order_sequence": 2
            },
            {
                "name": "에러 조회",
                "category": CommandCategory.STATUS,
                "command": ":STATus:ERRor?",
                "description": "에러 상태 조회",
                "has_response": True,
                "response_pattern": "0,\"No Error\"",
                "order_sequence": 3
            },
            # 출력 항목 설정 (NUMeric:NORMal:ITEMx)
            {
                "name": "출력항목1 설정 - 전압",
                "category": CommandCategory.CONFIGURATION,
                "command": ":NUMeric:NORMal:ITEM1 U,1",
                "description": "출력 항목 1을 전압(U)으로 설정",
                "has_response": False,
                "order_sequence": 4
            },
            {
                "name": "출력항목2 설정 - 전류",
                "category": CommandCategory.CONFIGURATION,
                "command": ":NUMeric:NORMal:ITEM2 I,1",
                "description": "출력 항목 2를 전류(I)로 설정",
                "has_response": False,
                "order_sequence": 5
            },
            {
                "name": "출력항목3 설정 - 전력",
                "category": CommandCategory.CONFIGURATION,
                "command": ":NUMeric:NORMal:ITEM3 P,1",
                "description": "출력 항목 3을 유효전력(P)으로 설정",
                "has_response": False,
                "order_sequence": 6
            },
            {
                "name": "출력항목4 설정 - 주파수",
                "category": CommandCategory.CONFIGURATION,
                "command": ":NUMeric:NORMal:ITEM4 FREQ,1",
                "description": "출력 항목 4를 주파수(FREQ)로 설정",
                "has_response": False,
                "order_sequence": 7
            },
            {
                "name": "출력항목5 설정 - 무효전력",
                "category": CommandCategory.CONFIGURATION,
                "command": ":NUMeric:NORMal:ITEM5 Q,1",
                "description": "출력 항목 5를 무효전력(Q)으로 설정",
                "has_response": False,
                "order_sequence": 8
            },
            {
                "name": "출력항목6 설정 - 피상전력",
                "category": CommandCategory.CONFIGURATION,
                "command": ":NUMeric:NORMal:ITEM6 S,1",
                "description": "출력 항목 6을 피상전력(S)으로 설정",
                "has_response": False,
                "order_sequence": 9
            },
            {
                "name": "출력항목7 설정 - 역률",
                "category": CommandCategory.CONFIGURATION,
                "command": ":NUMeric:NORMal:ITEM7 LAMBDA,1",
                "description": "출력 항목 7을 역률(λ)으로 설정",
                "has_response": False,
                "order_sequence": 10
            },
            {
                "name": "출력항목8 설정 - 전력량",
                "category": CommandCategory.CONFIGURATION,
                "command": ":NUMeric:NORMal:ITEM8 WP,1",
                "description": "출력 항목 8을 전력량(Wh)으로 설정",
                "has_response": False,
                "order_sequence": 11
            },
            # 실시간 측정값 조회
            {
                "name": "실시간 측정값 조회",
                "category": CommandCategory.MEASUREMENT,
                "command": ":NUMeric:NORMal:VALue?",
                "description": "설정된 출력 항목들의 실시간 측정값 조회",
                "has_response": True,
                "response_pattern": "220.5,0.45,99.2,60.0,15.3,101.2,0.98,1.25",
                "order_sequence": 12
            },
            {
                "name": "개별 측정값 조회",
                "category": CommandCategory.MEASUREMENT,
                "command": ":NUMeric:NORMal:ITEM{item}:VALue?",
                "description": "특정 항목의 측정값만 조회",
                "has_response": True,
                "response_pattern": "220.5",
                "parameters": {"item": {"type": "int", "min": 1, "max": 8, "default": 1}},
                "parameter_description": "item: 항목 번호 (1-8)",
                "order_sequence": 13
            },
            # 적산(Integration) 기능
            {
                "name": "적산 모드 시작",
                "category": CommandCategory.CONTROL,
                "command": ":INTegrate:STARt",
                "description": "전력량 적산 시작",
                "has_response": False,
                "order_sequence": 14
            },
            {
                "name": "적산 모드 정지",
                "category": CommandCategory.CONTROL,
                "command": ":INTegrate:STOP",
                "description": "전력량 적산 정지",
                "has_response": False,
                "order_sequence": 15
            },
            {
                "name": "적산 값 리셋",
                "category": CommandCategory.CONTROL,
                "command": ":INTegrate:RESet",
                "description": "적산값 초기화",
                "has_response": False,
                "order_sequence": 16
            },
            {
                "name": "적산 값 조회",
                "category": CommandCategory.MEASUREMENT,
                "command": ":INTegrate:VALue?",
                "description": "전력량 적산값 조회 (Wh, VAh, Varh)",
                "has_response": True,
                "response_pattern": "1234.56,1256.78,345.21",
                "order_sequence": 17
            },
            {
                "name": "적산 시간 조회",
                "category": CommandCategory.MEASUREMENT,
                "command": ":INTegrate:TIMer?",
                "description": "적산 경과시간 조회",
                "has_response": True,
                "response_pattern": "3661",
                "order_sequence": 18
            },
            # 범위 설정
            {
                "name": "전압 범위 설정",
                "category": CommandCategory.CONFIGURATION,
                "command": ":INPut1:VOLTage:RANGe {range}",
                "description": "전압 측정 범위 설정",
                "has_response": False,
                "parameters": {"range": {"type": "string", "options": ["AUTO", "15", "30", "60", "150", "300", "600"], "default": "AUTO"}},
                "parameter_description": "range: 전압범위 (AUTO/15V/30V/60V/150V/300V/600V)",
                "order_sequence": 19
            },
            {
                "name": "전류 범위 설정",
                "category": CommandCategory.CONFIGURATION,
                "command": ":INPut1:CURRent:RANGe {range}",
                "description": "전류 측정 범위 설정",
                "has_response": False,
                "parameters": {"range": {"type": "string", "options": ["AUTO", "0.5", "1", "2", "5", "10", "20"], "default": "AUTO"}},
                "parameter_description": "range: 전류범위 (AUTO/0.5A/1A/2A/5A/10A/20A)",
                "order_sequence": 20
            },
            # 업데이트 주기 설정
            {
                "name": "업데이트 주기 설정",
                "category": CommandCategory.CONFIGURATION,
                "command": ":RATE {rate}",
                "description": "측정값 업데이트 주기 설정",
                "has_response": False,
                "parameters": {"rate": {"type": "string", "options": ["50MS", "100MS", "200MS", "500MS", "1S", "2S", "5S"], "default": "200MS"}},
                "parameter_description": "rate: 업데이트 주기 (50MS~5S)",
                "order_sequence": 21
            }
        ]
    }

    commands_to_create = default_commands.get(device_type, [])
    if not commands_to_create:
        raise HTTPException(status_code=400, detail=f"No default commands available for device type: {device_type}")

    created_commands = []
    for cmd_data in commands_to_create:
        cmd_data["device_id"] = device_id
        command_in = schemas.DeviceCommandCreate(**cmd_data)
        command = crud.device_command.create(db=db, obj_in=command_in)
        created_commands.append(command)

    return {
        "message": f"Created {len(created_commands)} default commands for {device_type}",
        "commands": created_commands
    }


# 실시간 바코드 데이터 수신을 위한 비동기 태스크
async def barcode_listening_task():
    """바코드 스캐너에서 실시간 데이터를 수신하는 비동기 태스크"""
    global _barcode_serial_connection, _barcode_state
    
    while True:
        try:
            if _barcode_serial_connection and _barcode_serial_connection.is_open:
                # 바코드 데이터 읽기 시도
                if _barcode_serial_connection.in_waiting > 0:
                    data = _barcode_serial_connection.readline()
                    if data:
                        try:
                            # 바코드 데이터 디코딩
                            barcode_data = data.decode('utf-8').strip()
                            if barcode_data:
                                # 상태 업데이트
                                _barcode_state["last_barcode"] = barcode_data
                                _barcode_state["scan_count"] += 1
                                
                                print(f"바코드 수신: {barcode_data}")
                                
                                # WebSocket을 통해 프론트엔드에 실시간 전송
                                from app.api.v1.endpoints.websocket import broadcast_barcode_data
                                await broadcast_barcode_data(barcode_data)
                                
                        except UnicodeDecodeError:
                            # 바이너리 데이터인 경우
                            print(f"바이너리 바코드 데이터 수신: {data.hex()}")
                            _barcode_state["last_barcode"] = f"Binary: {data.hex()}"
                            _barcode_state["scan_count"] += 1
                            
                            # 바이너리 데이터도 WebSocket으로 전송
                            from app.api.v1.endpoints.websocket import broadcast_barcode_data
                            await broadcast_barcode_data(f"Binary: {data.hex()}")
            else:
                # 연결이 끊어진 경우 태스크 종료
                break
                
        except Exception as e:
            print(f"바코드 수신 오류: {e}")
            break
        
        # 짧은 대기 시간
        await asyncio.sleep(0.1)


# 바코드 수신 태스크 관리
_barcode_task = None

async def start_barcode_task():
    """바코드 수신 태스크 시작"""
    global _barcode_task
    if _barcode_task is None or _barcode_task.done():
        _barcode_task = asyncio.create_task(barcode_listening_task())
        print("바코드 수신 태스크 시작됨")

def stop_barcode_task():
    """바코드 수신 태스크 중지"""
    global _barcode_task
    if _barcode_task and not _barcode_task.done():
        _barcode_task.cancel()
        _barcode_task = None
        print("바코드 수신 태스크 중지됨")