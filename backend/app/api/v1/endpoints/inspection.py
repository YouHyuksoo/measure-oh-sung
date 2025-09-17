"""
통합 검사 서비스 API 엔드포인트
- 연속 검사, 순차 검사, 안전 검사 모든 API를 통합
"""
import asyncio
import json
from typing import Any, Dict

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.services.inspection import inspection_service
from app.websocket.queue import message_queue
from app import schemas
from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime

# ==================== 요청 스키마 ====================
class ContinuousInspectionRequest(BaseModel):
    barcode: str
    inspection_model_id: int

class SequentialInspectionRequest(BaseModel):
    barcode: str
    inspection_model_id: int
    measurement_duration: float = 10.0
    wait_duration: float = 2.0
    interval_sec: float = 0.25

class SafetyInspectionRequest(BaseModel):
    barcode: str
    inspection_model_id: int

# ==================== 검사단계 스키마 ====================
class InspectionStepBase(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    step_name: str
    step_order: int
    lower_limit: float
    upper_limit: float

class InspectionStepCreate(InspectionStepBase):
    inspection_model_id: int

class InspectionStepUpdate(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    step_name: Optional[str] = None
    step_order: Optional[int] = None
    lower_limit: Optional[float] = None
    upper_limit: Optional[float] = None


router = APIRouter()

# ==================== 공통 API ====================

async def sse_generator(request: Request):
    """SSE 스트림 생성기"""
    while True:
        if await request.is_disconnected():
            print("Client disconnected from SSE stream.")
            break

        if not message_queue.empty():
            message = message_queue.get()
            yield f"data: {message}\n\n"
        else:
            await asyncio.sleep(0.1)

@router.get("/stream")
async def stream_inspection_data(request: Request):
    """검사 데이터 실시간 스트림 (SSE)"""
    return StreamingResponse(
        sse_generator(request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Cache-Control"
        }
    )

@router.get("/status")
async def get_inspection_status():
    """검사 상태 조회"""
    try:
        status = await inspection_service.get_status()
        return {"success": True, "data": status}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== 연속 검사 API ====================

@router.post("/continuous/start")
async def start_continuous_inspection(
    request: ContinuousInspectionRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """연속 검사 시작"""
    try:
        background_tasks.add_task(
            inspection_service.start_continuous_inspection,
            db,
            request.barcode,
            request.inspection_model_id
        )
        return {"success": True, "message": "연속 검사가 시작되었습니다."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/continuous/stop")
async def stop_continuous_inspection():
    """연속 검사 중지"""
    try:
        await inspection_service.stop_inspection()
        return {"success": True, "message": "연속 검사가 중지되었습니다."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== 순차 검사 API ====================

@router.post("/sequential/start")
async def start_sequential_inspection(
    request: SequentialInspectionRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """순차 검사 시작"""
    try:
        background_tasks.add_task(
            inspection_service.start_sequential_inspection,
            db,
            request
        )
        return {"success": True, "message": "순차 검사가 시작되었습니다."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== 안전 검사 API ====================

@router.post("/safety/start")
async def start_safety_inspection(
    request: SafetyInspectionRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """안전 검사 시작"""
    try:
        background_tasks.add_task(
            inspection_service.start_safety_inspection,
            db,
            request
        )
        return {"success": True, "message": "안전 검사가 시작되었습니다."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
