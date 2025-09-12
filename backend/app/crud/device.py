from typing import List, Optional
from sqlalchemy.orm import Session
from app.crud.base import CRUDBase
from app.models.device import Device, DeviceType, ConnectionStatus
from app.schemas.device import DeviceCreate, DeviceUpdate

class CRUDDevice(CRUDBase[Device, DeviceCreate, DeviceUpdate]):
    def get_by_port(self, db: Session, *, port: str) -> Optional[Device]:
        """포트로 장비를 조회합니다."""
        return db.query(Device).filter(Device.port == port).first()
    
    def get_by_type(self, db: Session, *, device_type: DeviceType) -> List[Device]:
        """장비 타입으로 조회합니다."""
        return db.query(Device).filter(Device.device_type == device_type).all()
    
    def get_active_devices(self, db: Session) -> List[Device]:
        """활성화된 장비들을 조회합니다."""
        return db.query(Device).filter(Device.is_active == True).all()
    
    def get_connected_devices(self, db: Session) -> List[Device]:
        """연결된 장비들을 조회합니다."""
        return db.query(Device).filter(
            Device.connection_status == ConnectionStatus.CONNECTED
        ).all()

device = CRUDDevice(Device)