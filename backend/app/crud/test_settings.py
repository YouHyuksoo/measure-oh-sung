from typing import Optional
from sqlalchemy.orm import Session
from app.crud.base import CRUDBase
from app.models.test_settings import TestSettings
from app.schemas.test_settings import TestSettingsCreate, TestSettingsUpdate

class CRUDTestSettings(CRUDBase[TestSettings, TestSettingsCreate, TestSettingsUpdate]):
    def get_active(self, db: Session) -> Optional[TestSettings]:
        """활성화된 테스트 설정을 가져옵니다."""
        return db.query(TestSettings).filter(TestSettings.is_active == True).first()
    
    def set_active(self, db: Session, *, settings_id: int) -> TestSettings:
        """특정 설정을 활성화하고 다른 설정들은 비활성화합니다."""
        # 모든 설정을 비활성화
        db.query(TestSettings).update({"is_active": False})
        
        # 지정된 설정만 활성화
        db_obj = db.query(TestSettings).filter(TestSettings.id == settings_id).first()
        if db_obj:
            db_obj.is_active = True
            db.commit()
            db.refresh(db_obj)
        return db_obj

test_settings = CRUDTestSettings(TestSettings)