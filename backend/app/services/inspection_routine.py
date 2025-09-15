import asyncio
import uuid
from typing import Dict, Any, Optional, List
from datetime import datetime
from sqlalchemy.orm import Session
from enum import Enum
import logging

from app.services.measurement_service import measurement_service
from app.services.serial_communication import serial_service
from app.services.wt310_power_meter import wt310_sequential_inspection
from app import crud
from app.models.measurement import MeasurementPhase, MeasurementResult
from app.schemas.inspection_routine import SequentialInspectionRequest
from app.websocket.queue import message_queue

logger = logging.getLogger(__name__)

class InspectionStatus(str, Enum):
    IDLE = "idle"
    # ... (rest of the enum)

class InspectionRoutineService:
    """검사 루틴 관리 서비스"""
    
    def __init__(self):
        self.current_session: Optional[Dict[str, Any]] = None
        self.status = InspectionStatus.IDLE
        self.active_tasks: List[asyncio.Task] = []

    # ... (other methods like process_barcode_scan, _run_inspection_routine etc. are not used by the sequential flow, so I'll omit them for brevity)

    async def start_sequential_inspection(
        self,
        request: SequentialInspectionRequest,
        db: Session
    ):
        """바코드 스캔 트리거로 P1 → P2 → P3 순차 검사 실행 (비동기 래퍼)"""
        logger.info(">>> [TRACE] start_sequential_inspection: 시작")
        try:
            print(">>> [TRACE] DB에서 검사 모델 조회...")
            inspection_model = crud.inspection_model.get(db, id=request.inspection_model_id)
            if not inspection_model:
                raise ValueError(f"Inspection model {request.inspection_model_id} not found")
            logger.info(f">>> [TRACE] 검사 모델 '{inspection_model.model_name}' 확인.")

            print(">>> [TRACE] DB에서 테스트 설정 조회...")
            test_settings = crud.test_settings.get_active_by_model(db, inspection_model_id=request.inspection_model_id)
            if not test_settings:
                test_settings = crud.test_settings.get_active_global(db)

            if test_settings:
                logger.info(f">>> [TRACE] 테스트 설정 '{test_settings.name}' 사용.")
                measurement_duration = test_settings.p1_measure_duration
                wait_duration = test_settings.wait_duration_1_to_2
                interval_sec = test_settings.data_collection_interval
                measurement_method = test_settings.measurement_method
            else:
                print(">>> [TRACE] 활성 테스트 설정 없음. 요청 기본값 사용.")
                measurement_duration = request.measurement_duration
                wait_duration = request.wait_duration
                interval_sec = request.interval_sec
                measurement_method = "polling"

            print(">>> [TRACE] DB에서 전력계 장비 조회...")
            power_meter_device = crud.device.get_power_meter(db)
            
            print(">>> [TRACE] 전력계 연결 상태 확인...")
            if not power_meter_device or not serial_service.is_connected(power_meter_device.id):
                logger.error(">>> [TRACE] 전력계가 연결되지 않음! (device: {power_meter_device}, is_connected: {serial_service.is_connected(power_meter_device.id) if power_meter_device else 'N/A'})")
                raise ValueError("Power meter not connected")
            print(">>> [TRACE] 전력계 연결 확인 완료.")

            print(">>> [TRACE] 시리얼 연결 객체 가져오기...")
            serial_connection = serial_service.get_connection(power_meter_device.id)
            if not serial_connection:
                logger.error(">>> [TRACE] 시리얼 연결 객체를 가져올 수 없음!")
                raise ValueError("Serial connection not available")
            logger.info(f">>> [TRACE] 시리얼 연결 객체 확보 완료: {serial_connection}")

            session_id = str(uuid.uuid4())
            self.current_session = {
                "session_id": session_id,
                "barcode": request.barcode,
                "inspection_model": inspection_model,
                "start_time": datetime.now(),
            }
            logger.info(f">>> [TRACE] 검사 세션 생성: {session_id}")

            message_queue.put({
                "type": "inspection_started",
                "timestamp": datetime.now().isoformat(),
                "data": {
                    "session_id": session_id,
                    "barcode": request.barcode,
                    "inspection_model_id": request.inspection_model_id,
                }
            })

            measurement_results = {}

            def add_message_log(message_type: str, content: str, direction: str = "OUT"):
                message_queue.put({"type": "message_log", "data": {"timestamp": datetime.now().isoformat(), "type": message_type, "content": content, "direction": direction}})

            def on_phase_start(phase: str):
                message_queue.put({
                    "type": "phase_update", 
                    "timestamp": datetime.now().isoformat(), 
                    "data": {
                        "phase": phase, 
                        "status": f"MEASURING_{phase}",
                        "message": f"{phase} 단계 측정 시작"
                    }
                })
                logger.info(f"🔵 [PHASE] {phase} 단계 시작 알림 전송")

            def on_phase_data(phase: str, elapsed: float, value: float):
                message_queue.put({
                    "type": "measurement_update", 
                    "timestamp": datetime.now().isoformat(), 
                    "data": {
                        "barcode": request.barcode,
                        "phase": phase, 
                        "elapsed": elapsed, 
                        "value": value,
                        "unit": "W",
                        "result": "PENDING",
                        "timestamp": datetime.now().isoformat()
                    }
                })

            def on_phase_complete(phase: str, timestamps: list, values: list):
                results = {
                    "timestamps": timestamps, "values": values,
                    "valid_values": [v for v in values if v is not None],
                    "count": len([v for v in values if v is not None]),
                    "avg": sum([v for v in values if v is not None]) / len([v for v in values if v is not None]) if any(v is not None for v in values) else 0,
                    "min": min([v for v in values if v is not None]) if any(v is not None for v in values) else 0,
                    "max": max([v for v in values if v is not None]) if any(v is not None for v in values) else 0,
                }
                measurement_results[phase] = results
                message_queue.put({
                    "type": "phase_complete", 
                    "timestamp": datetime.now().isoformat(), 
                    "data": {
                        "phase": phase, 
                        "results": results,
                        "message": f"{phase} 단계 측정 완료"
                    }
                })
                logger.info(f"🟢 [PHASE] {phase} 단계 완료 알림 전송 - 유효 데이터: {results['count']}개")

            print(">>> [TRACE] 백그라운드 스레드에서 동기 함수 wt310_sequential_inspection 실행 시작...")
            await asyncio.to_thread(
                wt310_sequential_inspection,
                ser=serial_connection, phases=["P1", "P2", "P3"],
                measurement_duration=measurement_duration, wait_duration=wait_duration,
                interval_sec=interval_sec, measurement_method=measurement_method,
                ascii_format=True, on_phase_start=on_phase_start,
                on_phase_data=on_phase_data, on_phase_complete=on_phase_complete,
                on_message_log=add_message_log
            )
            print(">>> [TRACE] wt310_sequential_inspection 실행 완료.")

            final_results = self._calculate_final_results(measurement_results, inspection_model)

            print(">>> [TRACE] DB에 결과 저장 시작...")
            await self._save_measurement_results(
                session_id=session_id, barcode=request.barcode, inspection_model=inspection_model,
                measurement_results=measurement_results, final_results=final_results, db=db
            )
            print(">>> [TRACE] DB에 결과 저장 완료.")

            message_queue.put({
                "type": "inspection_complete",
                "timestamp": datetime.now().isoformat(),
                "data": {"session_id": session_id, "results": final_results}
            })

        except Exception as e:
            logger.error(f">>> [TRACE] start_sequential_inspection에서 예외 발생: {e}")
            message_queue.put({"type": "inspection_error", "timestamp": datetime.now().isoformat(), "data": {"error": str(e)}})
        finally:
            print(">>> [TRACE] start_sequential_inspection: 종료")
            self.current_session = None
            self.status = InspectionStatus.IDLE

    def _calculate_final_results(self, measurement_results: Dict[str, Any], inspection_model) -> Dict[str, Any]:
        # ... (This function is synchronous and correct)
        results = {
            "overall_pass": True,
            "phases": {},
            "summary": {
                "total_phases": len(measurement_results),
                "passed_phases": 0,
                "failed_phases": 0
            }
        }
        
        for phase, data in measurement_results.items():
            if phase == "P1":
                lower_limit = inspection_model.p1_lower_limit
                upper_limit = inspection_model.p1_upper_limit
            elif phase == "P2":
                lower_limit = inspection_model.p2_lower_limit
                upper_limit = inspection_model.p2_upper_limit
            elif phase == "P3":
                lower_limit = inspection_model.p3_lower_limit
                upper_limit = inspection_model.p3_upper_limit
            else:
                continue
            
            valid_values = data["valid_values"]
            phase_pass = all(lower_limit <= value <= upper_limit for value in valid_values) if valid_values else False
            
            results["phases"][phase] = {
                "pass": phase_pass,
                "count": data["count"],
                "avg": data["avg"],
                "min": data["min"],
                "max": data["max"],
                "lower_limit": lower_limit,
                "upper_limit": upper_limit,
            }
            
            if phase_pass:
                results["summary"]["passed_phases"] += 1
            else:
                results["summary"]["failed_phases"] += 1
                results["overall_pass"] = False
        
        return results

    async def _save_measurement_results(
        self,
        session_id: str,
        barcode: str,
        inspection_model,
        measurement_results: Dict[str, Any],
        final_results: Dict[str, Any],
        db: Session
    ):
        """측정 결과를 데이터베이스에 저장"""
        try:
            # This is a simplified saving logic. In a real app, you might save summary and raw data differently.
            for phase, data in measurement_results.items():
                await measurement_service.create_measurement({
                    "barcode": barcode,
                    "phase": phase,
                    "value": data["avg"], # Saving average value as representative
                    "unit": "W",
                    "result": "PASS" if final_results["phases"][phase]["pass"] else "FAIL",
                    "timestamp": datetime.now(),
                    "session_id": session_id
                }, db)
            logger.info(f"측정 결과 저장 완료 - 세션: {session_id}")
        except Exception as e:
            logger.error(f"측정 결과 저장 실패: {e}")
            # We don't re-raise here to not kill the whole process if saving fails

# 전역 검사 루틴 서비스 인스턴스
inspection_service = InspectionRoutineService()
