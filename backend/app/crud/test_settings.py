from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import and_
from app.crud.base import CRUDBase
from app.models.test_settings import TestSettings
from app.schemas.test_settings import TestSettingsCreate, TestSettingsUpdate

class CRUDTestSettings(CRUDBase[TestSettings, TestSettingsCreate, TestSettingsUpdate]):
    def get_active(self, db: Session) -> Optional[TestSettings]:
        """활성화된 전역 테스트 설정을 가져옵니다."""
        return db.query(TestSettings).filter(
            TestSettings.is_active == True
        ).first()
    
    def get_active_global(self, db: Session) -> Optional[TestSettings]:
        """활성화된 전역 테스트 설정을 가져옵니다."""
        return db.query(TestSettings).filter(
            and_(
                TestSettings.is_active == True,
                TestSettings.inspection_model_id == None
            )
        ).first()

    def get_by_model(self, db: Session, *, inspection_model_id: int) -> List[TestSettings]:
        """특정 검사 모델의 테스트 설정들을 조회합니다."""
        return db.query(TestSettings).filter(
            TestSettings.inspection_model_id == inspection_model_id
        ).all()

    def get_active_by_model(self, db: Session, *, inspection_model_id: int) -> Optional[TestSettings]:
        """특정 검사 모델의 활성화된 테스트 설정을 조회합니다."""
        return db.query(TestSettings).filter(
            and_(
                TestSettings.inspection_model_id == inspection_model_id,
                TestSettings.is_active == True
            )
        ).first()
    
    def set_active(self, db: Session, *, settings_id: int) -> TestSettings:
        """특정 설정을 활성화하고 같은 범위의 다른 설정들은 비활성화합니다."""
        db_obj = db.query(TestSettings).filter(TestSettings.id == settings_id).first()
        if not db_obj:
            return None

        # 같은 검사 모델 범위의 다른 설정들을 비활성화
        if db_obj.inspection_model_id is None:
            # 전역 설정인 경우
            db.query(TestSettings).filter(
                and_(
                    TestSettings.inspection_model_id == None,
                    TestSettings.id != settings_id
                )
            ).update({"is_active": False})
        else:
            # 특정 모델 설정인 경우
            db.query(TestSettings).filter(
                and_(
                    TestSettings.inspection_model_id == db_obj.inspection_model_id,
                    TestSettings.id != settings_id
                )
            ).update({"is_active": False})

        # 지정된 설정만 활성화
        db_obj.is_active = True
        db.commit()
        db.refresh(db_obj)
        return db_obj

test_settings = CRUDTestSettings(TestSettings)