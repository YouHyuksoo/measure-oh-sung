"""
API 라우터 - 통합된 명명규칙 적용
"""
from fastapi import APIRouter
from app.api.v1.endpoints import (
    health, 
    measurements, 
    inspection_models, 
    devices, 
    logs,
    serial_communication,
    inspection,
    safety,
    polling_settings
)

api_router = APIRouter()

# ==================== 기본 API ====================
api_router.include_router(health.router, prefix="/health", tags=["health"])

# ==================== 측정 관련 API ====================
api_router.include_router(measurements.router, prefix="/measurements", tags=["measurements"])

# ==================== 검사 관련 API ====================
api_router.include_router(inspection_models.router, prefix="/inspection-models", tags=["inspection-models"])
api_router.include_router(inspection.router, prefix="/inspection", tags=["inspection"])
api_router.include_router(safety.router, prefix="/safety-inspections", tags=["safety-inspections"])
api_router.include_router(polling_settings.router, prefix="/polling-settings", tags=["polling-settings"])

# ==================== 장비 관련 API ====================
api_router.include_router(devices.router, prefix="/devices", tags=["devices"])
api_router.include_router(serial_communication.router, prefix="/serial", tags=["serial-communication"])

# ==================== 시스템 관련 API ====================
api_router.include_router(logs.router, prefix="/system-logs", tags=["system-logs"])