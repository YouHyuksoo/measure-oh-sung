from fastapi import APIRouter
from app.api.v1.endpoints import (
    health, 
    measurements, 
    test_settings, 
    inspection_models, 
    devices, 
    system_logs,
    serial_communication,
    inspection_routine
)

api_router = APIRouter()

api_router.include_router(health.router, prefix="/health", tags=["health"])
api_router.include_router(measurements.router, prefix="/measurements", tags=["measurements"])
api_router.include_router(test_settings.router, prefix="/test-settings", tags=["test-settings"])
api_router.include_router(inspection_models.router, prefix="/inspection-models", tags=["inspection-models"])
api_router.include_router(devices.router, prefix="/devices", tags=["devices"])
api_router.include_router(system_logs.router, prefix="/system-logs", tags=["system-logs"])
api_router.include_router(serial_communication.router, prefix="/serial", tags=["serial-communication"])
api_router.include_router(inspection_routine.router, prefix="/inspection", tags=["inspection-routine"])
