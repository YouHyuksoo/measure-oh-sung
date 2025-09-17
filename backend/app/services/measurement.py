"""
측정 관련 서비스
- MeasurementService: 측정 데이터 처리 및 실시간 스트리밍
"""
import json
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
from sqlalchemy.orm import Session

from app.websocket.queue import message_queue
from app import crud, schemas
from app.models.measurement import MeasurementPhase, MeasurementResult

logger = logging.getLogger(__name__)

class MeasurementService:
    """측정 데이터 처리 및 실시간 스트리밍 서비스"""
    
    def __init__(self):
        self.active_measurements: Dict[str, Dict] = {}  # session_id -> measurement_data
        
    async def start_measurement_session(
        self, 
        session_id: str, 
        barcode: str,
        inspection_model_id: int,
        db: Session
    ):
        """새로운 측정 세션을 시작합니다."""
        
        measurement_data = {
            "session_id": session_id,
            "barcode": barcode,
            "inspection_model_id": inspection_model_id,
            "phases": {"CONTINUOUS": {"status": "pending", "data": []}},
            "start_time": datetime.now(),
            "raw_data": []
        }
        
        self.active_measurements[session_id] = measurement_data
        
        logger.info(f"📊 [MEASUREMENT] 측정 세션 시작: {session_id}")
        
        # 웹소켓으로 측정 시작 알림
        await self._send_message("measurement_session_started", {
            "session_id": session_id,
            "barcode": barcode,
            "inspection_model_id": inspection_model_id
        })
        
        return measurement_data
    
    async def add_measurement_data(
        self, 
        session_id: str, 
        phase: str, 
        data: Dict[str, Any]
    ):
        """측정 데이터를 추가합니다."""
        
        if session_id not in self.active_measurements:
            logger.warning(f"⚠️ [MEASUREMENT] 활성 측정 세션을 찾을 수 없습니다: {session_id}")
            return
        
        measurement_data = self.active_measurements[session_id]
        
        # 원시 데이터 추가
        measurement_data["raw_data"].append({
            "timestamp": datetime.now().isoformat(),
            "phase": phase,
            "data": data
        })
        
        # 단계별 데이터 추가
        if phase in measurement_data["phases"]:
            measurement_data["phases"][phase]["data"].append(data)
            measurement_data["phases"][phase]["status"] = "running"
        
        logger.debug(f"📊 [MEASUREMENT] 데이터 추가: {session_id} - {phase}")
    
    async def complete_measurement_session(
        self, 
        session_id: str, 
        db: Session
    ) -> Optional[Dict[str, Any]]:
        """측정 세션을 완료하고 결과를 저장합니다."""
        
        if session_id not in self.active_measurements:
            logger.warning(f"⚠️ [MEASUREMENT] 활성 측정 세션을 찾을 수 없습니다: {session_id}")
            return None
        
        measurement_data = self.active_measurements[session_id]
        
        try:
            # 측정 완료 시간 설정
            measurement_data["end_time"] = datetime.now()
            
            # 통계 계산
            statistics = self._calculate_statistics(measurement_data)
            
            # 데이터베이스에 저장
            measurement_record = await self._save_measurement_to_db(db, measurement_data, statistics)
            
            # 웹소켓으로 완료 알림
            await self._send_message("measurement_session_completed", {
                "session_id": session_id,
                "statistics": statistics,
                "measurement_id": measurement_record.id if measurement_record else None
            })
            
            # 활성 측정에서 제거
            del self.active_measurements[session_id]
            
            logger.info(f"✅ [MEASUREMENT] 측정 세션 완료: {session_id}")
            
            return {
                "session_id": session_id,
                "statistics": statistics,
                "measurement_id": measurement_record.id if measurement_record else None
            }
            
        except Exception as e:
            logger.error(f"❌ [MEASUREMENT] 측정 세션 완료 실패: {e}")
            return None
    
    def _calculate_statistics(self, measurement_data: Dict[str, Any]) -> Dict[str, Any]:
        """측정 데이터의 통계를 계산합니다."""
        
        raw_data = measurement_data.get("raw_data", [])
        if not raw_data:
            return {
                "total_measurements": 0,
                "duration": 0,
                "phases": {}
            }
        
        # 전체 측정 수
        total_measurements = len(raw_data)
        
        # 측정 시간 계산
        start_time = measurement_data.get("start_time")
        end_time = measurement_data.get("end_time", datetime.now())
        duration = (end_time - start_time).total_seconds() if start_time else 0
        
        # 단계별 통계
        phase_statistics = {}
        for phase, phase_data in measurement_data.get("phases", {}).items():
            phase_measurements = phase_data.get("data", [])
            if phase_measurements:
                # 수치 데이터 추출 (예: power 값)
                values = [m.get("power", 0) for m in phase_measurements if isinstance(m.get("power"), (int, float))]
                
                if values:
                    phase_statistics[phase] = {
                        "count": len(values),
                        "min": min(values),
                        "max": max(values),
                        "avg": sum(values) / len(values),
                        "status": phase_data.get("status", "unknown")
                    }
                else:
                    phase_statistics[phase] = {
                        "count": 0,
                        "min": 0,
                        "max": 0,
                        "avg": 0,
                        "status": phase_data.get("status", "unknown")
                    }
            else:
                phase_statistics[phase] = {
                    "count": 0,
                    "min": 0,
                    "max": 0,
                    "avg": 0,
                    "status": "pending"
                }
        
        return {
            "total_measurements": total_measurements,
            "duration": duration,
            "phases": phase_statistics
        }
    
    async def _save_measurement_to_db(
        self, 
        db: Session, 
        measurement_data: Dict[str, Any], 
        statistics: Dict[str, Any]
    ):
        """측정 데이터를 데이터베이스에 저장합니다."""
        
        try:
            # Measurement 모델 생성
            measurement_create = schemas.MeasurementCreate(
                barcode=measurement_data["barcode"],
                session_id=measurement_data["session_id"],
                inspection_model_id=measurement_data["inspection_model_id"],
                phase=MeasurementPhase.CONTINUOUS,
                raw_data=measurement_data["raw_data"],
                min_value=statistics.get("phases", {}).get("CONTINUOUS", {}).get("min", 0),
                max_value=statistics.get("phases", {}).get("CONTINUOUS", {}).get("max", 0),
                avg_value=statistics.get("phases", {}).get("CONTINUOUS", {}).get("avg", 0),
                result=MeasurementResult.PASS,  # 기본값, 실제로는 검사 로직에서 결정
                start_time=measurement_data.get("start_time"),
                end_time=measurement_data.get("end_time"),
                duration=statistics.get("duration", 0)
            )
            
            # 데이터베이스에 저장
            measurement = crud.measurement.create(db, obj_in=measurement_create)
            
            logger.info(f"💾 [MEASUREMENT] 데이터베이스 저장 완료: {measurement.id}")
            
            return measurement
            
        except Exception as e:
            logger.error(f"❌ [MEASUREMENT] 데이터베이스 저장 실패: {e}")
            return None
    
    async def _send_message(self, message_type: str, data: Dict[str, Any]):
        """웹소켓으로 메시지 전송"""
        message = {
            "type": message_type,
            "timestamp": datetime.now().isoformat(),
            "data": data
        }
        await message_queue.put(json.dumps(message))
    
    def get_active_sessions(self) -> List[str]:
        """활성 측정 세션 목록을 반환합니다."""
        return list(self.active_measurements.keys())
    
    def get_session_data(self, session_id: str) -> Optional[Dict[str, Any]]:
        """특정 세션의 측정 데이터를 반환합니다."""
        return self.active_measurements.get(session_id)

# 전역 인스턴스
measurement_service = MeasurementService()
