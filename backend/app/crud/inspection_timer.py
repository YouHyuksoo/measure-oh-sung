from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.crud.base import CRUDBase
from app.models.inspection_timer import InspectionTimerSettings
from app.schemas.inspection_timer import InspectionTimerSettingsCreate, InspectionTimerSettingsUpdate


class CRUDInspectionTimerSettings(CRUDBase[InspectionTimerSettings, InspectionTimerSettingsCreate, InspectionTimerSettingsUpdate]):
    """검사 타이머 설정 CRUD"""

    def get_active(self, db: Session) -> Optional[InspectionTimerSettings]:
        """현재 활성화된 전역 타이머 설정을 조회합니다."""
        return db.query(self.model).filter(
            self.model.is_active == True
        ).first()

    def get_by_model(self, db: Session, *, inspection_model_id: int) -> List[InspectionTimerSettings]:
        """특정 검사 모델의 타이머 설정들을 조회합니다."""
        return db.query(self.model).filter(
            self.model.inspection_model_id == inspection_model_id
        ).all()

    def get_active_by_model(self, db: Session, *, inspection_model_id: int) -> Optional[InspectionTimerSettings]:
        """특정 검사 모델의 활성화된 타이머 설정을 조회합니다."""
        return db.query(self.model).filter(
            and_(
                self.model.inspection_model_id == inspection_model_id,
                self.model.is_active == True
            )
        ).first()

    def set_active(self, db: Session, *, settings_id: int) -> Optional[InspectionTimerSettings]:
        """특정 타이머 설정을 활성화하고 같은 범위의 다른 설정들은 비활성화합니다."""
        settings = self.get(db=db, id=settings_id)
        if not settings:
            return None

        # 같은 검사 모델 범위의 다른 설정들을 비활성화
        if settings.inspection_model_id is None:
            # 전역 설정인 경우
            db.query(self.model).filter(
                and_(
                    self.model.inspection_model_id == None,
                    self.model.id != settings_id
                )
            ).update({self.model.is_active: False})
        else:
            # 특정 모델 설정인 경우
            db.query(self.model).filter(
                and_(
                    self.model.inspection_model_id == settings.inspection_model_id,
                    self.model.id != settings_id
                )
            ).update({self.model.is_active: False})

        # 특정 설정을 활성화
        settings.is_active = True
        db.add(settings)
        db.commit()
        db.refresh(settings)

        return settings

    def set_active_for_model(self, db: Session, *, inspection_model_id: int, settings_id: int) -> Optional[InspectionTimerSettings]:
        """특정 검사 모델의 타이머 설정을 활성화합니다."""
        settings = self.get(db=db, id=settings_id)
        if not settings or settings.inspection_model_id != inspection_model_id:
            return None

        # 같은 검사 모델의 다른 설정들을 비활성화
        db.query(self.model).filter(
            and_(
                self.model.inspection_model_id == inspection_model_id,
                self.model.id != settings_id
            )
        ).update({self.model.is_active: False})

        # 특정 설정을 활성화
        settings.is_active = True
        db.add(settings)
        db.commit()
        db.refresh(settings)

        return settings

    def create_default_if_not_exists(self, db: Session) -> InspectionTimerSettings:
        """기본 설정이 없으면 생성합니다."""
        existing = self.get_active(db=db)
        if existing:
            return existing

        # 기본 설정 생성
        default_settings = InspectionTimerSettingsCreate(
            name="기본 검사 타이머 설정",
            description="시스템 기본 검사 타이머 설정",
            p1_prepare_time=5,
            p1_duration=10,
            p2_prepare_time=5,
            p2_duration=15,
            p3_prepare_time=5,
            p3_duration=20,
            auto_progress=True
        )

        settings = self.create(db=db, obj_in=default_settings)
        settings.is_active = True
        db.add(settings)
        db.commit()
        db.refresh(settings)

        return settings

    def get_current_settings(self, db: Session) -> InspectionTimerSettings:
        """현재 설정을 가져오거나 기본 설정을 생성합니다."""
        settings = self.get_active(db=db)
        if not settings:
            settings = self.create_default_if_not_exists(db=db)
        return settings


inspection_timer_settings = CRUDInspectionTimerSettings(InspectionTimerSettings)