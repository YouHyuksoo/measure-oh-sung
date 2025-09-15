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
            "start_time": datetime.now(),
            "current_phase": None,
            "phases": {
                "P1": {"status": "pending", "data": []},
                "P2": {"status": "pending", "data": []},
                "P3": {"status": "pending", "data": []}
            }
        }
        
        self.active_measurements[session_id] = measurement_data
        
        message_queue.put({
            "type": "measurement_session_started",
            "session_id": session_id,
            "barcode": barcode,
            "inspection_model_id": inspection_model_id,
            "timestamp": datetime.now().isoformat()
        })
        
    async def start_phase_measurement(
        self,
        session_id: str,
        phase: MeasurementPhase,
        db: Session
    ):
        """특정 단계의 측정을 시작합니다."""
        
        if session_id not in self.active_measurements:
            raise ValueError(f"No active measurement session: {session_id}")
            
        measurement_data = self.active_measurements[session_id]
        measurement_data["current_phase"] = phase
        measurement_data["phases"][phase]["status"] = "measuring"
        measurement_data["phases"][phase]["start_time"] = datetime.now()
        
        message_queue.put({
            "type": "phase_started",
            "session_id": session_id,
            "phase": phase,
            "timestamp": datetime.now().isoformat()
        })
        
    async def add_measurement_data(
        self,
        session_id: str,
        phase: MeasurementPhase,
        value: float,
        db: Session
    ):
        """실시간 측정 데이터를 추가합니다."""
        
        if session_id not in self.active_measurements:
            return
            
        measurement_data = self.active_measurements[session_id]
        phase_data = measurement_data["phases"][phase]
        
        data_point = {
            "value": value,
            "timestamp": datetime.now().isoformat()
        }
        phase_data["data"].append(data_point)
        
        message_queue.put({
            "type": "measurement_data",
            "session_id": session_id,
            "phase": phase,
            "data": data_point,
            "total_points": len(phase_data["data"]),
            "timestamp": datetime.now().isoformat()
        })
        
    async def complete_phase_measurement(
        self,
        session_id: str,
        phase: MeasurementPhase,
        lower_limit: float,
        upper_limit: float,
        db: Session
    ):
        """특정 단계의 측정을 완료하고 결과를 계산합니다."""
        
        if session_id not in self.active_measurements:
            return
            
        measurement_data = self.active_measurements[session_id]
        phase_data = measurement_data["phases"][phase]
        
        values = [point["value"] for point in phase_data["data"]]
        
        if values:
            min_value = min(values)
            max_value = max(values)
            avg_value = sum(values) / len(values)
            variance = sum((x - avg_value) ** 2 for x in values) / len(values)
            std_deviation = variance ** 0.5
            result = MeasurementResult.PASS
            for value in values:
                if value < lower_limit or value > upper_limit:
                    result = MeasurementResult.FAIL
                    break
        else:
            min_value = max_value = avg_value = std_deviation = 0
            result = MeasurementResult.ERROR
            
        measurement_create = schemas.MeasurementCreate(
            barcode=measurement_data["barcode"],
            session_id=session_id,
            inspection_model_id=measurement_data["inspection_model_id"],
            phase=phase,
            raw_data=values,
            min_value=min_value,
            max_value=max_value,
            avg_value=avg_value,
            std_deviation=std_deviation,
            result=result,
            lower_limit=lower_limit,
            upper_limit=upper_limit,
            start_time=phase_data.get("start_time"),
            end_time=datetime.now(),
            duration=(datetime.now() - phase_data.get("start_time", datetime.now())).total_seconds()
        )
        
        saved_measurement = crud.measurement.create(db=db, obj_in=measurement_create)
        
        phase_data["status"] = "completed"
        phase_data["result"] = result
        phase_data["measurement_id"] = saved_measurement.id
        
        message_queue.put({
            "type": "phase_completed",
            "session_id": session_id,
            "phase": phase,
            "result": result,
            "statistics": {
                "min_value": min_value,
                "max_value": max_value,
                "avg_value": avg_value,
                "std_deviation": std_deviation,
                "total_points": len(values)
            },
            "limits": {
                "lower_limit": lower_limit,
                "upper_limit": upper_limit
            },
            "measurement_id": saved_measurement.id,
            "timestamp": datetime.now().isoformat()
        })
        
        return saved_measurement
        
    async def complete_measurement_session(self, session_id: str, db: Session):
        """측정 세션을 완료합니다."""
        
        if session_id not in self.active_measurements:
            return
            
        measurement_data = self.active_measurements[session_id]
        
        overall_result = MeasurementResult.PASS
        for phase_name, phase_data in measurement_data["phases"].items():
            if phase_data.get("result") != MeasurementResult.PASS:
                overall_result = MeasurementResult.FAIL
                break
                
        message_queue.put({
            "type": "measurement_session_completed",
            "session_id": session_id,
            "overall_result": overall_result,
            "phases_results": {
                phase: data.get("result") 
                for phase, data in measurement_data["phases"].items()
            },
            "timestamp": datetime.now().isoformat()
        })
        
        del self.active_measurements[session_id]
        
        return overall_result
    
    async def create_measurement(self, measurement_data: Dict[str, Any], db: Session):
        """측정 데이터를 데이터베이스에 저장합니다."""
        
        try:
            measurement_create = schemas.MeasurementCreate(
                barcode=measurement_data.get("barcode", ""),
                session_id=measurement_data.get("session_id", ""),
                inspection_model_id=measurement_data.get("inspection_model_id", 0),
                phase=measurement_data.get("phase"),
                raw_data=measurement_data.get("raw_data", []),
                min_value=measurement_data.get("min_value", 0.0),
                max_value=measurement_data.get("max_value", 0.0),
                avg_value=measurement_data.get("avg_value", 0.0),
                std_deviation=measurement_data.get("std_deviation", 0.0),
                result=measurement_data.get("result"),
                lower_limit=measurement_data.get("lower_limit", 0.0),
                upper_limit=measurement_data.get("upper_limit", 0.0),
                start_time=measurement_data.get("start_time"),
                end_time=measurement_data.get("end_time"),
                duration=measurement_data.get("duration", 0.0)
            )
            
            saved_measurement = crud.measurement.create(db=db, obj_in=measurement_create)
            
            message_queue.put({
                "type": "measurement_saved",
                "measurement_id": saved_measurement.id,
                "session_id": measurement_data.get("session_id"),
                "phase": measurement_data.get("phase"),
                "result": measurement_data.get("result"),
                "timestamp": datetime.now().isoformat()
            })
            
            return saved_measurement
            
        except Exception as e:
            logger.error(f"측정 데이터 저장 실패: {e}")
            raise e

# 전역 측정 서비스 인스턴스
measurement_service = MeasurementService()