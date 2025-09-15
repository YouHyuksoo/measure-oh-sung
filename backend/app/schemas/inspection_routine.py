from pydantic import BaseModel

class SequentialInspectionRequest(BaseModel):
    barcode: str
    inspection_model_id: int
    measurement_duration: float = 10.0
    wait_duration: float = 2.0
    interval_sec: float = 0.25
