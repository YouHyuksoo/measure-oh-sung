"""
검사 오케스트레이션 서비스
- 전력측정과 안전검사를 조율하는 상위 서비스
- 각각의 전용 서비스를 호출하여 통합 검사 수행
"""
import asyncio
import logging
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from enum import Enum
from datetime import datetime

from app.services.power_meter import power_meter_service
from app.services.safety import safety_inspection_service
from app.services.measurement import measurement_service
from app import crud
from app.websocket.queue import message_queue
import json

logger = logging.getLogger(__name__)

class InspectionStatus(str, Enum):
    """검사 상태 열거형"""
    IDLE = "IDLE"
    RUNNING_POWER = "RUNNING_POWER"
    RUNNING_SAFETY = "RUNNING_SAFETY"
    RUNNING_BOTH = "RUNNING_BOTH"
    COMPLETED = "COMPLETED"
    ERROR = "ERROR"

class InspectionService:
    """검사 오케스트레이션 서비스"""
    
    def __init__(self):
        self.status = InspectionStatus.IDLE
        self.current_session_id = None
        self.current_barcode = None
        self.current_model_id = None
        self.power_results = None
        self.safety_results = None
    
    async def _send_message(self, message_type: str, data: Dict[str, Any]):
        """웹소켓으로 메시지 전송"""
        message = {
            "type": message_type,
            "timestamp": datetime.now().isoformat(),
            "data": data
        }
        await message_queue.put(json.dumps(message))
    
    async def start_continuous_inspection(
        self, 
        db: Session, 
        barcode: str, 
        inspection_model_id: int
    ):
        """연속 전력측정 검사 시작"""
        try:
            if self.status != InspectionStatus.IDLE:
                raise Exception("이미 검사가 진행 중입니다.")
            
            logger.info(f"🚀 [INSPECTION] 연속 전력측정 검사 시작: {barcode}")
            
            # 상태 설정
            self.status = InspectionStatus.RUNNING_POWER
            self.current_session_id = f"POWER_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            self.current_barcode = barcode
            self.current_model_id = inspection_model_id
            
            # 검사 모델 및 폴링 설정 조회
            inspection_model = crud.inspection.inspection_model.get(db, id=inspection_model_id)
            if not inspection_model:
                raise ValueError(f"검사 모델을 찾을 수 없습니다: {inspection_model_id}")
            
            polling_settings = crud.inspection.polling_settings.get_by_model_id(db, model_id=inspection_model_id)
            if not polling_settings:
                raise ValueError("폴링 설정이 없습니다")
            
            # 검사 시작 알림
            await self._send_message("inspection_started", {
                "session_id": self.current_session_id,
                "barcode": barcode,
                "model_name": inspection_model.model_name,
                "inspection_type": "POWER_MEASUREMENT",
                "polling_interval": polling_settings.polling_interval,
                "polling_duration": polling_settings.polling_duration
            })
            
            # 전력측정 서비스 호출
            measurements = await power_meter_service.start_continuous_measurement(
                duration=polling_settings.polling_duration,
                interval=polling_settings.polling_interval
            )
            
            # 측정 결과 처리
            self.power_results = power_meter_service.get_measurement_statistics(measurements)
            
            # 검사단계별 결과 계산
            step_results = self._calculate_step_results(inspection_model.inspection_steps, measurements)
            
            # 완료 알림
            await self._send_message("inspection_completed", {
                "session_id": self.current_session_id,
                "barcode": barcode,
                "inspection_type": "POWER_MEASUREMENT",
                "power_results": self.power_results,
                "step_results": step_results
            })
            
            self.status = InspectionStatus.COMPLETED
            logger.info(f"✅ [INSPECTION] 연속 전력측정 검사 완료: {barcode}")
            
        except Exception as e:
            logger.error(f"❌ [INSPECTION] 연속 전력측정 검사 실패: {e}")
            self.status = InspectionStatus.ERROR
            await self._send_message("inspection_error", {"error": str(e)})
            raise
    
    async def start_safety_inspection(
        self, 
        db: Session, 
        barcode: str, 
        inspection_model_id: int
    ):
        """안전검사 시작"""
        try:
            if self.status != InspectionStatus.IDLE:
                raise Exception("이미 검사가 진행 중입니다.")
            
            logger.info(f"🚀 [INSPECTION] 안전검사 시작: {barcode}")
            
            # 상태 설정
            self.status = InspectionStatus.RUNNING_SAFETY
            self.current_session_id = f"SAFETY_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            self.current_barcode = barcode
            self.current_model_id = inspection_model_id
            
            # 안전검사 서비스 호출
            self.safety_results = await safety_inspection_service.start_safety_inspection(
                db, barcode, inspection_model_id
            )
            
            self.status = InspectionStatus.COMPLETED
            logger.info(f"✅ [INSPECTION] 안전검사 완료: {barcode}")
            
        except Exception as e:
            logger.error(f"❌ [INSPECTION] 안전검사 실패: {e}")
            self.status = InspectionStatus.ERROR
            await self._send_message("inspection_error", {"error": str(e)})
            raise
    
    async def start_combined_inspection(
        self, 
        db: Session, 
        barcode: str, 
        inspection_model_id: int
    ):
        """전력측정 + 안전검사 통합 검사"""
        try:
            if self.status != InspectionStatus.IDLE:
                raise Exception("이미 검사가 진행 중입니다.")
            
            logger.info(f"🚀 [INSPECTION] 통합 검사 시작: {barcode}")
            
            # 상태 설정
            self.status = InspectionStatus.RUNNING_BOTH
            self.current_session_id = f"COMBINED_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            self.current_barcode = barcode
            self.current_model_id = inspection_model_id
            
            # 통합 검사 시작 알림
            await self._send_message("inspection_started", {
                "session_id": self.current_session_id,
                "barcode": barcode,
                "inspection_type": "COMBINED",
                "steps": ["POWER_MEASUREMENT", "SAFETY_INSPECTION"]
            })
            
            # 1단계: 전력측정
            await self._send_message("inspection_step_started", {
                "step": "POWER_MEASUREMENT",
                "message": "전력측정 시작"
            })
            
            inspection_model = crud.inspection.inspection_model.get(db, id=inspection_model_id)
            polling_settings = crud.inspection.polling_settings.get_by_model_id(db, model_id=inspection_model_id)
            
            measurements = await power_meter_service.start_continuous_measurement(
                duration=polling_settings.polling_duration,
                interval=polling_settings.polling_interval
            )
            self.power_results = power_meter_service.get_measurement_statistics(measurements)
            
            await self._send_message("inspection_step_completed", {
                "step": "POWER_MEASUREMENT",
                "results": self.power_results
            })
            
            # 2단계: 안전검사
            await self._send_message("inspection_step_started", {
                "step": "SAFETY_INSPECTION",
                "message": "안전검사 시작"
            })
            
            self.safety_results = await safety_inspection_service.start_safety_inspection(
                db, barcode, inspection_model_id
            )
            
            await self._send_message("inspection_step_completed", {
                "step": "SAFETY_INSPECTION",
                "results": self.safety_results
            })
            
            # 최종 결과 통합
            final_results = self._combine_results()
            
            # 완료 알림
            await self._send_message("inspection_completed", {
                "session_id": self.current_session_id,
                "barcode": barcode,
                "inspection_type": "COMBINED",
                "power_results": self.power_results,
                "safety_results": self.safety_results,
                "final_results": final_results
            })
            
            self.status = InspectionStatus.COMPLETED
            logger.info(f"✅ [INSPECTION] 통합 검사 완료: {barcode}")
            
        except Exception as e:
            logger.error(f"❌ [INSPECTION] 통합 검사 실패: {e}")
            self.status = InspectionStatus.ERROR
            await self._send_message("inspection_error", {"error": str(e)})
            raise
    
    def _calculate_step_results(self, inspection_steps, measurements):
        """검사단계별 결과 계산"""
        if not measurements:
            return []
        
        step_results = []
        for step in inspection_steps:
            # 측정값에서 해당 단계의 기준값과 비교
            # 여기서는 간단히 전력값으로 판정
            avg_power = sum(m["power"] for m in measurements) / len(measurements)
            is_pass = step.lower_limit <= avg_power <= step.upper_limit
            
            step_results.append({
                "step_name": step.step_name,
                "step_order": step.step_order,
                "lower_limit": step.lower_limit,
                "upper_limit": step.upper_limit,
                "measured_value": avg_power,
                "result": "PASS" if is_pass else "FAIL"
            })
        
        return step_results
    
    def _combine_results(self):
        """전력측정과 안전검사 결과 통합"""
        return {
            "overall_result": "PASS" if (
                self.power_results and 
                self.safety_results and 
                self.safety_results.get("overall_result") == "PASS"
            ) else "FAIL",
            "power_measurement": self.power_results,
            "safety_inspection": self.safety_results,
            "combined_at": datetime.now().isoformat()
        }
    
    async def stop_inspection(self):
        """검사 중지"""
        try:
            if self.status in [InspectionStatus.RUNNING_POWER, InspectionStatus.RUNNING_BOTH]:
                # 전력측정 중지 (현재는 연속 측정이므로 완료까지 대기)
                pass
            
            if self.status in [InspectionStatus.RUNNING_SAFETY, InspectionStatus.RUNNING_BOTH]:
                await safety_inspection_service.stop_inspection()
            
            self.status = InspectionStatus.IDLE
            logger.info("🛑 [INSPECTION] 검사 중지")
            
            await self._send_message("inspection_stopped", {
                "session_id": self.current_session_id
            })
            
        except Exception as e:
            logger.error(f"❌ [INSPECTION] 검사 중지 실패: {e}")
    
    async def get_status(self) -> Dict[str, Any]:
        """검사 상태 조회"""
        return {
            "status": self.status.value,
            "session_id": self.current_session_id,
            "barcode": self.current_barcode,
            "model_id": self.current_model_id,
            "power_results": self.power_results,
            "safety_results": self.safety_results
        }

# 전역 인스턴스
inspection_service = InspectionService()