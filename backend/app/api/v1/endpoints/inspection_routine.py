import asyncio
import json
from typing import Any, Dict

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    HTTPException,
    Request,
)
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app import crud
from app.db.database import get_db
from app.schemas.inspection_routine import SequentialInspectionRequest
from app.services.inspection_routine import inspection_service
from app.websocket.queue import message_queue

router = APIRouter()


async def sse_generator(request: Request):
    """SSE 스트림을 위한 비동기 제너레이터"""
    while True:
        if await request.is_disconnected():
            print("Client disconnected from SSE stream.")
            break

        if not message_queue.empty():
            message = message_queue.get()
            try:
                yield f"data: {json.dumps(message)}\n\n"
                message_queue.task_done()
            except Exception as e:
                print(f"Error sending SSE message: {e}")
        
        await asyncio.sleep(0.05)


@router.get("/stream")
async def stream_events(request: Request):
    """실시간 검사 이벤트를 SSE로 스트리밍합니다."""
    headers = {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no", # Nginx 프록시 사용 시 버퍼링 방지
    }
    return StreamingResponse(sse_generator(request), headers=headers)


@router.post("/sequential-inspection")
async def start_sequential_inspection(
    request: SequentialInspectionRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """바코드 스캔 트리거로 P1 → P2 → P3 순차 검사를 시작합니다."""
    
    try:
        # 검사 모델 존재 확인
        inspection_model = crud.inspection_model.get(db, id=request.inspection_model_id)
        if not inspection_model:
            raise HTTPException(
                status_code=404,
                detail=f"Inspection model {request.inspection_model_id} not found",
            )
        
        # 전력계 연결 확인
        power_meter_device = crud.device.get_power_meter(db)
        if not power_meter_device:
            raise HTTPException(
                status_code=400, detail="Power meter device not found"
            )
        
        # 순차 검사 실행 (백그라운드에서)
        background_tasks.add_task(
            inspection_service.start_sequential_inspection, request, db
        )
        
        return {
            "success": True,
            "message": "Sequential inspection started",
            "barcode": request.barcode,
            "inspection_model_id": request.inspection_model_id,
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to start sequential inspection: {str(e)}",
        )
