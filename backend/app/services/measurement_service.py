import asyncio
import json
from typing import List, Dict, Any, Optional
from datetime import datetime
from sqlalchemy.orm import Session

from app.websocket.connection_manager import manager
from app import crud, schemas
from app.models.measurement import MeasurementPhase, MeasurementResult

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
        
        # 클라이언트에게 세션 시작 알림
        await manager.broadcast_json_to_session({
            "type": "measurement_session_started",
            "session_id": session_id,
            "barcode": barcode,
            "inspection_model_id": inspection_model_id,
            "timestamp": datetime.now().isoformat()
        }, session_id)
        
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
        
        # 클라이언트에게 단계 시작 알림
        await manager.broadcast_json_to_session({
            "type": "phase_started",
            "session_id": session_id,
            "phase": phase,
            "timestamp": datetime.now().isoformat()
        }, session_id)
        
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
        
        # 데이터 추가
        data_point = {
            "value": value,
            "timestamp": datetime.now().isoformat()
        }
        phase_data["data"].append(data_point)
        
        # 실시간으로 클라이언트에 전송
        await manager.broadcast_json_to_session({
            "type": "measurement_data",
            "session_id": session_id,
            "phase": phase,
            "data": data_point,
            "total_points": len(phase_data["data"]),
            "timestamp": datetime.now().isoformat()
        }, session_id)
        
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
        
        # 측정 데이터 통계 계산
        values = [point["value"] for point in phase_data["data"]]
        
        if values:
            min_value = min(values)
            max_value = max(values)
            avg_value = sum(values) / len(values)
            
            # 표준편차 계산
            variance = sum((x - avg_value) ** 2 for x in values) / len(values)
            std_deviation = variance ** 0.5
            
            # 합불 판정
            result = MeasurementResult.PASS
            for value in values:
                if value < lower_limit or value > upper_limit:
                    result = MeasurementResult.FAIL
                    break
        else:
            min_value = max_value = avg_value = std_deviation = 0
            result = MeasurementResult.ERROR
            
        # 측정 데이터 저장
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
        
        # 단계 완료 상태 업데이트
        phase_data["status"] = "completed"
        phase_data["result"] = result
        phase_data["measurement_id"] = saved_measurement.id
        
        # 클라이언트에게 단계 완료 알림
        await manager.broadcast_json_to_session({
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
        }, session_id)
        
        return saved_measurement
        
    async def complete_measurement_session(self, session_id: str, db: Session):
        """측정 세션을 완료합니다."""
        
        if session_id not in self.active_measurements:
            return
            
        measurement_data = self.active_measurements[session_id]
        
        # 전체 결과 판정
        overall_result = MeasurementResult.PASS
        for phase_name, phase_data in measurement_data["phases"].items():
            if phase_data.get("result") != MeasurementResult.PASS:
                overall_result = MeasurementResult.FAIL
                break
                
        # 클라이언트에게 세션 완료 알림
        await manager.broadcast_json_to_session({
            "type": "measurement_session_completed",
            "session_id": session_id,
            "overall_result": overall_result,
            "phases_results": {
                phase: data.get("result") 
                for phase, data in measurement_data["phases"].items()
            },
            "timestamp": datetime.now().isoformat()
        }, session_id)
        
        # 세션 데이터 정리
        del self.active_measurements[session_id]
        
        return overall_result

# 전역 측정 서비스 인스턴스
measurement_service = MeasurementService()