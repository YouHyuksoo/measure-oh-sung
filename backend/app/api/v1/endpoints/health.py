from fastapi import APIRouter

router = APIRouter()

@router.get("/")
async def health_check():
    return {"status": "healthy", "service": "measure-oh-sung-backend"}

@router.get("/detailed")
async def detailed_health_check():
    return {
        "status": "healthy",
        "service": "measure-oh-sung-backend",
        "version": "0.1.0",
        "database": "connected",  # 실제로는 DB 연결 상태 확인
        "dependencies": "ok"
    }
