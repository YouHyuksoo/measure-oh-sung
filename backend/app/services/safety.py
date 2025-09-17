"""
안전검사 관련 서비스 - 3대안전 검사 전용
- 절연저항, 접지저항, 내전압 검사
- 전력측정과 분리된 순수 안전검사 서비스
"""
import asyncio
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime
from sqlalchemy.orm import Session

from app import crud
from app.models.safety import SafetyInspectionResult, SafetyTestResult, SafetyInspectionStatus
from app.schemas.safety import SafetyInspectionResultCreate
from app.websocket.queue import message_queue
import json

logger = logging.getLogger(__name__)

class SafetyInspectionService:
    """3대안전 검사 전용 서비스"""
    
    def __init__(self):
        self.is_running = False
        self.current_session_id = None
        self.current_barcode = None
        self.current_model_id = None
    
    async def _send_message(self, message_type: str, data: Dict[str, Any]):
        """웹소켓으로 메시지 전송"""
        message = {
            "type": message_type,
            "timestamp": datetime.now().isoformat(),
            "data": data
        }
        await message_queue.put(json.dumps(message))
    
    async def start_safety_inspection(
        self, 
        db: Session, 
        barcode: str, 
        inspection_model_id: int
    ) -> Dict[str, Any]:
        """3대안전 검사 시작"""
        try:
            if self.is_running:
                raise Exception("이미 안전검사가 진행 중입니다.")
            
            logger.info(f"🚀 [SAFETY] 안전검사 시작: {barcode}")
            
            # 상태 설정
            self.is_running = True
            self.current_session_id = f"SAFETY_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            self.current_barcode = barcode
            self.current_model_id = inspection_model_id
            
            # 검사 시작 알림
            await self._send_message("safety_inspection_started", {
                "session_id": self.current_session_id,
                "barcode": barcode,
                "model_id": inspection_model_id
            })
            
            # 3대안전 검사 실행
            results = await self._execute_safety_tests()
            
            # 결과 저장
            await self._save_safety_results(db, results)
            
            # 완료 알림
            await self._send_message("safety_inspection_completed", {
                "session_id": self.current_session_id,
                "barcode": barcode,
                "results": results
            })
            
            logger.info(f"✅ [SAFETY] 안전검사 완료: {barcode}")
            return results
            
        except Exception as e:
            logger.error(f"❌ [SAFETY] 안전검사 실패: {e}")
            await self._send_message("safety_inspection_error", {"error": str(e)})
            raise
        finally:
            self.is_running = False
            self.current_session_id = None
            self.current_barcode = None
            self.current_model_id = None
    
    async def _execute_safety_tests(self) -> Dict[str, Any]:
        """3대안전 검사 실행"""
        logger.info("🔍 [SAFETY] 3대안전 검사 실행 시작")
        
        results = {
            "dielectric": await self._test_dielectric_strength(),
            "insulation": await self._test_insulation_resistance(),
            "ground": await self._test_ground_resistance()
        }
        
        # 전체 결과 판정
        overall_result = self._determine_overall_result(results)
        
        return {
            "overall_result": overall_result,
            "status": SafetyInspectionStatus.COMPLETED,
            "results": results,
            "test_time": datetime.now().isoformat()
        }
    
    async def _test_dielectric_strength(self) -> Dict[str, Any]:
        """내전압 검사"""
        logger.info("⚡ [SAFETY] 내전압 검사 시작")
        
        try:
            # 실제 안전검사 장비와 통신하여 내전압 측정
            # 여기서는 시뮬레이션 데이터
            await asyncio.sleep(2)  # 검사 시간 시뮬레이션
            
            test_voltage = 1000.0  # V
            leakage_current = 0.061  # mA
            limit = 1.0  # mA
            
            result = SafetyTestResult.PASS if leakage_current <= limit else SafetyTestResult.FAIL
            
            return {
                "value": leakage_current,
                "unit": "mA",
                "result": result,
                "test_voltage": test_voltage,
                "limit": limit
            }
            
        except Exception as e:
            logger.error(f"❌ [SAFETY] 내전압 검사 실패: {e}")
            return {
                "value": 0.0,
                "unit": "mA",
                "result": SafetyTestResult.FAIL,
                "error": str(e)
            }
    
    async def _test_insulation_resistance(self) -> Dict[str, Any]:
        """절연저항 검사"""
        logger.info("🔌 [SAFETY] 절연저항 검사 시작")
        
        try:
            # 실제 안전검사 장비와 통신하여 절연저항 측정
            await asyncio.sleep(2)  # 검사 시간 시뮬레이션
            
            resistance = 0.051  # MΩ
            limit = 1.0  # MΩ
            
            result = SafetyTestResult.PASS if resistance >= limit else SafetyTestResult.FAIL
            
            return {
                "value": resistance,
                "unit": "MΩ",
                "result": result,
                "limit": limit
            }
            
        except Exception as e:
            logger.error(f"❌ [SAFETY] 절연저항 검사 실패: {e}")
            return {
                "value": 0.0,
                "unit": "MΩ",
                "result": SafetyTestResult.FAIL,
                "error": str(e)
            }
    
    async def _test_ground_resistance(self) -> Dict[str, Any]:
        """접지저항 검사"""
        logger.info("🌍 [SAFETY] 접지저항 검사 시작")
        
        try:
            # 실제 안전검사 장비와 통신하여 접지저항 측정
            await asyncio.sleep(2)  # 검사 시간 시뮬레이션
            
            resistance = 8.16  # Ω
            limit = 10.0  # Ω
            
            result = SafetyTestResult.PASS if resistance <= limit else SafetyTestResult.FAIL
            
            return {
                "value": resistance,
                "unit": "Ω",
                "result": result,
                "limit": limit
            }
            
        except Exception as e:
            logger.error(f"❌ [SAFETY] 접지저항 검사 실패: {e}")
            return {
                "value": 0.0,
                "unit": "Ω",
                "result": SafetyTestResult.FAIL,
                "error": str(e)
            }
    
    def _determine_overall_result(self, results: Dict[str, Any]) -> SafetyTestResult:
        """전체 결과 판정"""
        for test_name, test_result in results.items():
            if test_result.get("result") == SafetyTestResult.FAIL:
                return SafetyTestResult.FAIL
        return SafetyTestResult.PASS
    
    async def _save_safety_results(self, db: Session, results: Dict[str, Any]):
        """안전검사 결과 저장"""
        try:
            safety_result = SafetyInspectionResultCreate(
                session_id=self.current_session_id,
                barcode=self.current_barcode,
                inspection_model_id=self.current_model_id,
                status=results["status"],
                overall_result=results["overall_result"],
                results=results["results"],
                start_time=datetime.now(),
                end_time=datetime.now()
            )
            
            crud.safety.safety_inspection.create(db, obj_in=safety_result)
            logger.info("💾 [SAFETY] 안전검사 결과 저장 완료")
            
        except Exception as e:
            logger.error(f"❌ [SAFETY] 결과 저장 실패: {e}")
    
    async def get_status(self) -> Dict[str, Any]:
        """안전검사 상태 조회"""
        return {
            "is_running": self.is_running,
            "session_id": self.current_session_id,
            "barcode": self.current_barcode,
            "model_id": self.current_model_id
        }
    
    async def stop_inspection(self):
        """안전검사 중지"""
        if self.is_running:
            self.is_running = False
            logger.info("🛑 [SAFETY] 안전검사 중지")
            await self._send_message("safety_inspection_stopped", {
                "session_id": self.current_session_id
            })

# 전역 인스턴스
safety_inspection_service = SafetyInspectionService()
