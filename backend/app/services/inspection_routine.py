import asyncio
import uuid
from typing import Dict, Any, Optional, List
from datetime import datetime
from sqlalchemy.orm import Session
from enum import Enum

from app.services.measurement_service import measurement_service
from app.services.serial_communication import serial_service
from app.websocket.connection_manager import manager
from app import crud
from app.models.measurement import MeasurementPhase, MeasurementResult

class InspectionStatus(str, Enum):
    """검사 상태"""
    IDLE = "idle"
    BARCODE_READY = "barcode_ready"
    MEASURING_P1 = "measuring_p1"
    WAITING_P1_TO_P2 = "waiting_p1_to_p2"
    MEASURING_P2 = "measuring_p2"
    WAITING_P2_TO_P3 = "waiting_p2_to_p3"
    MEASURING_P3 = "measuring_p3"
    COMPLETED = "completed"
    ERROR = "error"

class InspectionRoutineService:
    """검사 루틴 관리 서비스"""
    
    def __init__(self):
        self.current_session: Optional[Dict[str, Any]] = None
        self.status = InspectionStatus.IDLE
        self.active_tasks: List[asyncio.Task] = []
        
    async def start_barcode_listening(self, db: Session):
        """바코드 스캔 대기 모드를 시작합니다."""
        self.status = InspectionStatus.BARCODE_READY
        
        # 클라이언트에게 바코드 스캔 준비 상태 알림
        await manager.broadcast_json({
            "type": "inspection_status",
            "status": self.status,
            "message": "Ready for barcode scan",
            "timestamp": datetime.now().isoformat()
        })
        
    async def process_barcode_scan(
        self, 
        barcode: str, 
        inspection_model_id: int,
        db: Session
    ) -> Dict[str, Any]:
        """바코드 스캔을 처리하고 검사 루틴을 시작합니다."""
        
        if self.status != InspectionStatus.BARCODE_READY:
            return {
                "success": False,
                "message": f"Not ready for barcode scan. Current status: {self.status}"
            }
        
        # 검사 모델 확인
        inspection_model = crud.inspection_model.get(db=db, id=inspection_model_id)
        if not inspection_model:
            return {
                "success": False,
                "message": f"Inspection model {inspection_model_id} not found"
            }
        
        # 테스트 설정 확인
        test_settings = crud.test_settings.get_active(db=db)
        if not test_settings:
            return {
                "success": False,
                "message": "No active test settings found"
            }
        
        # 연결된 장비 확인
        connected_devices = crud.device.get_connected_devices(db=db)
        if not connected_devices:
            return {
                "success": False,
                "message": "No connected measurement devices found"
            }
        
        # 새로운 검사 세션 생성
        session_id = f"session_{uuid.uuid4().hex[:8]}"
        
        self.current_session = {
            "session_id": session_id,
            "barcode": barcode,
            "inspection_model": inspection_model,
            "test_settings": test_settings,
            "devices": connected_devices,
            "start_time": datetime.now(),
            "current_phase": None,
            "results": {}
        }
        
        # 측정 서비스에 세션 시작 알림
        await measurement_service.start_measurement_session(
            session_id, barcode, inspection_model_id, db
        )
        
        # 검사 루틴 시작
        task = asyncio.create_task(self._run_inspection_routine(db))
        self.active_tasks.append(task)
        
        return {
            "success": True,
            "message": f"Inspection routine started for barcode {barcode}",
            "session_id": session_id
        }
    
    async def _run_inspection_routine(self, db: Session):
        """3단계 검사 루틴을 실행합니다."""
        try:
            session = self.current_session
            settings = session["test_settings"]
            model = session["inspection_model"]
            device = session["devices"][0]  # 첫 번째 연결된 장비 사용
            
            # P1 측정 단계
            await self._execute_measurement_phase(
                MeasurementPhase.P1,
                settings.p1_measure_duration,
                model.p1_lower_limit,
                model.p1_upper_limit,
                device,
                db
            )
            
            # P1-P2 대기
            await self._wait_between_phases(
                "P1", "P2",
                settings.wait_duration_1_to_2,
                db
            )
            
            # P2 측정 단계
            await self._execute_measurement_phase(
                MeasurementPhase.P2,
                settings.p2_measure_duration,
                model.p2_lower_limit,
                model.p2_upper_limit,
                device,
                db
            )
            
            # P2-P3 대기
            await self._wait_between_phases(
                "P2", "P3",
                settings.wait_duration_2_to_3,
                db
            )
            
            # P3 측정 단계
            await self._execute_measurement_phase(
                MeasurementPhase.P3,
                settings.p3_measure_duration,
                model.p3_lower_limit,
                model.p3_upper_limit,
                device,
                db
            )
            
            # 검사 완료
            await self._complete_inspection(db)
            
        except Exception as e:
            await self._handle_inspection_error(str(e), db)
    
    async def _execute_measurement_phase(
        self,
        phase: MeasurementPhase,
        duration: float,
        lower_limit: float,
        upper_limit: float,
        device: Any,
        db: Session
    ):
        """특정 측정 단계를 실행합니다."""
        
        session = self.current_session
        session["current_phase"] = phase
        self.status = getattr(InspectionStatus, f"MEASURING_{phase}")
        
        # 클라이언트에게 측정 시작 알림
        await manager.broadcast_json({
            "type": "phase_started",
            "session_id": session["session_id"],
            "phase": phase,
            "duration": duration,
            "limits": {
                "lower": lower_limit,
                "upper": upper_limit
            },
            "timestamp": datetime.now().isoformat()
        })
        
        # 측정 서비스에 단계 시작 알림
        await measurement_service.start_phase_measurement(
            session["session_id"], phase, db
        )
        
        # 실시간 측정 데이터 수집
        start_time = datetime.now()
        measurement_count = 0
        
        while (datetime.now() - start_time).total_seconds() < duration:
            try:
                # 장비에서 측정값 읽기
                value = await serial_service.send_command_async(
                    device.id, 
                    "MEAS:VOLT:DC?",  # 기본 전압 측정 명령
                    0.05  # 빠른 측정을 위한 짧은 지연
                )
                
                if value:
                    try:
                        float_value = float(value)
                        measurement_count += 1
                        
                        # 측정 서비스에 데이터 추가
                        await measurement_service.add_measurement_data(
                            session["session_id"], phase, float_value, db
                        )
                        
                        # 실시간 판정
                        is_within_limits = lower_limit <= float_value <= upper_limit
                        
                        # 클라이언트에게 실시간 데이터 전송 (이미 measurement_service에서 처리됨)
                        
                    except ValueError:
                        print(f"Invalid measurement value: {value}")
                
                # 다음 측정까지 짧은 대기
                await asyncio.sleep(0.1)  # 100ms 간격으로 측정
                
            except Exception as e:
                print(f"Error during measurement: {e}")
                await asyncio.sleep(0.1)
        
        # 측정 단계 완료
        saved_measurement = await measurement_service.complete_phase_measurement(
            session["session_id"], phase, lower_limit, upper_limit, db
        )
        
        # 세션에 결과 저장
        session["results"][phase] = {
            "measurement_id": saved_measurement.id,
            "result": saved_measurement.result,
            "measurement_count": measurement_count,
            "duration": duration
        }
        
        print(f"Phase {phase} completed with {measurement_count} measurements")
    
    async def _wait_between_phases(
        self, 
        from_phase: str, 
        to_phase: str, 
        duration: float,
        db: Session
    ):
        """측정 단계 사이의 대기 시간을 처리합니다."""
        
        self.status = getattr(InspectionStatus, f"WAITING_{from_phase}_TO_{to_phase}")
        
        # 클라이언트에게 대기 시작 알림
        await manager.broadcast_json({
            "type": "waiting_between_phases",
            "session_id": self.current_session["session_id"],
            "from_phase": from_phase,
            "to_phase": to_phase,
            "duration": duration,
            "timestamp": datetime.now().isoformat()
        })
        
        # 대기 중 카운트다운
        start_time = datetime.now()
        while (datetime.now() - start_time).total_seconds() < duration:
            remaining = duration - (datetime.now() - start_time).total_seconds()
            
            await manager.broadcast_json({
                "type": "waiting_countdown",
                "session_id": self.current_session["session_id"],
                "remaining_seconds": max(0, remaining),
                "timestamp": datetime.now().isoformat()
            })
            
            await asyncio.sleep(0.5)  # 0.5초마다 카운트다운 업데이트
    
    async def _complete_inspection(self, db: Session):
        """검사 루틴을 완료합니다."""
        
        session = self.current_session
        self.status = InspectionStatus.COMPLETED
        
        # 측정 서비스에서 세션 완료 처리
        overall_result = await measurement_service.complete_measurement_session(
            session["session_id"], db
        )
        
        # 최종 결과 요약
        end_time = datetime.now()
        total_duration = (end_time - session["start_time"]).total_seconds()
        
        results_summary = {
            "session_id": session["session_id"],
            "barcode": session["barcode"],
            "overall_result": overall_result,
            "start_time": session["start_time"].isoformat(),
            "end_time": end_time.isoformat(),
            "total_duration": total_duration,
            "phases": session["results"]
        }
        
        # 클라이언트에게 최종 결과 전송
        await manager.broadcast_json({
            "type": "inspection_completed",
            "results": results_summary,
            "timestamp": datetime.now().isoformat()
        })
        
        # 세션 정리
        self.current_session = None
        self.status = InspectionStatus.IDLE
        
        print(f"Inspection completed for barcode {session['barcode']}: {overall_result}")
    
    async def _handle_inspection_error(self, error_message: str, db: Session):
        """검사 중 오류를 처리합니다."""
        
        self.status = InspectionStatus.ERROR
        
        error_info = {
            "session_id": self.current_session["session_id"] if self.current_session else None,
            "error": error_message,
            "timestamp": datetime.now().isoformat()
        }
        
        # 클라이언트에게 오류 알림
        await manager.broadcast_json({
            "type": "inspection_error",
            "error_info": error_info,
            "timestamp": datetime.now().isoformat()
        })
        
        # 시스템 로그에 오류 기록
        from app.models.system_log import LogLevel, LogCategory
        log_create = {
            "level": LogLevel.ERROR,
            "category": LogCategory.MEASUREMENT,
            "message": f"Inspection routine error: {error_message}",
            "session_id": self.current_session["session_id"] if self.current_session else None
        }
        crud.system_log.create(db=db, obj_in=log_create)
        
        # 세션 정리
        self.current_session = None
        self.status = InspectionStatus.IDLE
        
        print(f"Inspection error: {error_message}")
    
    async def stop_inspection(self, db: Session) -> Dict[str, Any]:
        """현재 진행 중인 검사를 중지합니다."""
        
        if self.status == InspectionStatus.IDLE:
            return {
                "success": False,
                "message": "No inspection routine is running"
            }
        
        # 실행 중인 태스크들 취소
        for task in self.active_tasks:
            if not task.done():
                task.cancel()
        self.active_tasks.clear()
        
        # 클라이언트에게 중지 알림
        await manager.broadcast_json({
            "type": "inspection_stopped",
            "session_id": self.current_session["session_id"] if self.current_session else None,
            "timestamp": datetime.now().isoformat()
        })
        
        # 상태 초기화
        self.current_session = None
        self.status = InspectionStatus.IDLE
        
        return {
            "success": True,
            "message": "Inspection routine stopped"
        }
    
    def get_current_status(self) -> Dict[str, Any]:
        """현재 검사 상태를 반환합니다."""
        
        status_info = {
            "status": self.status,
            "session_id": self.current_session["session_id"] if self.current_session else None,
            "current_phase": self.current_session["current_phase"] if self.current_session else None,
            "barcode": self.current_session["barcode"] if self.current_session else None,
            "timestamp": datetime.now().isoformat()
        }
        
        if self.current_session:
            status_info["session_info"] = {
                "start_time": self.current_session["start_time"].isoformat(),
                "inspection_model_id": self.current_session["inspection_model"].id,
                "connected_devices": len(self.current_session["devices"])
            }
        
        return status_info

# 전역 검사 루틴 서비스 인스턴스
inspection_service = InspectionRoutineService()