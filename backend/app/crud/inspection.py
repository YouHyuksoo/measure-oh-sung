"""
검사 관련 모든 CRUD 통합
- InspectionModel: 검사 모델 CRUD
- InspectionStep: 검사 단계 CRUD
- PollingSettings: 폴링 설정 CRUD
"""
from typing import List, Optional
from sqlalchemy.orm import Session
from app.crud.base import CRUDBase
from app.models.inspection import InspectionModel, InspectionStep, PollingSettings
from app.schemas.inspection import (
    InspectionModelCreate, InspectionModelUpdate,
    InspectionStepCreate, InspectionStepUpdate,
    PollingSettingsCreate, PollingSettingsUpdate
)

# ==================== 검사 모델 CRUD ====================
class CRUDInspectionModel(CRUDBase[InspectionModel, InspectionModelCreate, InspectionModelUpdate]):
    def get_by_name(self, db: Session, *, model_name: str) -> Optional[InspectionModel]:
        """모델 이름으로 검사 모델을 조회합니다."""
        return db.query(InspectionModel).filter(InspectionModel.model_name == model_name).first()
    
    def get_active_models(self, db: Session) -> List[InspectionModel]:
        """활성화된 검사 모델들을 가져옵니다."""
        return db.query(InspectionModel).filter(InspectionModel.is_active == True).all()
    
    def create_with_steps(self, db: Session, *, obj_in: InspectionModelCreate) -> InspectionModel:
        """검사단계와 함께 모델을 생성합니다."""
        # 모델 생성 (검사단계 제외)
        model_data = obj_in.model_dump(exclude={'inspection_steps'})
        model = InspectionModel(**model_data)
        db.add(model)
        db.flush()  # ID를 얻기 위해 flush
        
        # 검사단계들 생성
        if obj_in.inspection_steps:
            inspection_step.create_steps_for_model(
                db=db, 
                model_id=model.id, 
                steps_data=obj_in.inspection_steps
            )
        
        db.refresh(model)
        return model
    
    def update_with_steps(self, db: Session, *, db_obj: InspectionModel, obj_in: InspectionModelUpdate) -> InspectionModel:
        """검사단계와 함께 모델을 업데이트합니다."""
        # 모델 정보 업데이트
        update_data = obj_in.model_dump(exclude={'inspection_steps'}, exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_obj, field, value)
        
        # 검사단계 업데이트
        if obj_in.inspection_steps is not None:
            inspection_step.update_steps_for_model(
                db=db,
                model_id=db_obj.id,
                steps_data=obj_in.inspection_steps
            )
        
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

# ==================== 검사단계 CRUD ====================
class CRUDInspectionStep(CRUDBase[InspectionStep, InspectionStepCreate, InspectionStepUpdate]):
    def get_by_model_id(self, db: Session, *, model_id: int) -> List[InspectionStep]:
        """모델 ID로 검사단계들을 조회합니다."""
        return db.query(InspectionStep).filter(InspectionStep.inspection_model_id == model_id).order_by(InspectionStep.step_order).all()
    
    def create_steps_for_model(self, db: Session, *, model_id: int, steps_data: List[dict]) -> List[InspectionStep]:
        """모델에 대한 검사단계들을 생성합니다."""
        created_steps = []
        for step_data in steps_data:
            step_create = InspectionStepCreate(
                inspection_model_id=model_id,
                step_name=step_data["step_name"],
                step_order=step_data["step_order"],
                lower_limit=step_data["lower_limit"],
                upper_limit=step_data["upper_limit"]
            )
            step = self.create(db=db, obj_in=step_create)
            created_steps.append(step)
        return created_steps
    
    def update_steps_for_model(self, db: Session, *, model_id: int, steps_data: List[dict]) -> List[InspectionStep]:
        """모델의 검사단계들을 업데이트합니다."""
        # 기존 단계들 삭제
        existing_steps = self.get_by_model_id(db=db, model_id=model_id)
        for step in existing_steps:
            self.remove(db=db, id=step.id)
        
        # 새로운 단계들 생성
        return self.create_steps_for_model(db=db, model_id=model_id, steps_data=steps_data)

# ==================== 폴링 설정 CRUD ====================
class CRUDPollingSettings(CRUDBase[PollingSettings, PollingSettingsCreate, PollingSettingsUpdate]):
    """폴링 설정 CRUD"""
    
    def get_by_model_id(self, db: Session, *, model_id: int) -> Optional[PollingSettings]:
        """모델 ID로 폴링 설정 조회"""
        return db.query(PollingSettings).filter(PollingSettings.inspection_model_id == model_id).first()
    
    def get_active_by_model_id(self, db: Session, *, model_id: int) -> Optional[PollingSettings]:
        """활성화된 모델의 폴링 설정 조회"""
        return db.query(PollingSettings).filter(
            PollingSettings.inspection_model_id == model_id,
            PollingSettings.is_active == True
        ).first()
    
    def create_or_update_for_model(
        self, 
        db: Session, 
        *, 
        model_id: int, 
        polling_interval: float,
        polling_duration: float,
        is_active: bool = True
    ) -> PollingSettings:
        """모델별 폴링 설정 생성 또는 업데이트"""
        existing = self.get_by_model_id(db, model_id=model_id)
        
        if existing:
            # 기존 설정 업데이트
            existing.polling_interval = polling_interval
            existing.polling_duration = polling_duration
            existing.is_active = is_active
            db.commit()
            db.refresh(existing)
            return existing
        else:
            # 새 설정 생성
            polling_settings = PollingSettings(
                inspection_model_id=model_id,
                polling_interval=polling_interval,
                polling_duration=polling_duration,
                is_active=is_active
            )
            db.add(polling_settings)
            db.commit()
            db.refresh(polling_settings)
            return polling_settings

# ==================== CRUD 인스턴스 ====================
inspection_model = CRUDInspectionModel(InspectionModel)
inspection_step = CRUDInspectionStep(InspectionStep)
polling_settings = CRUDPollingSettings(PollingSettings)
