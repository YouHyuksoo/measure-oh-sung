from typing import List, Optional
from sqlalchemy.orm import Session
from app.crud.base import CRUDBase
from app.models.inspection_model import InspectionModel
from app.schemas.inspection_model import InspectionModelCreate, InspectionModelUpdate

class CRUDInspectionModel(CRUDBase[InspectionModel, InspectionModelCreate, InspectionModelUpdate]):
    def get_by_name(self, db: Session, *, model_name: str) -> Optional[InspectionModel]:
        """모델 이름으로 검사 모델을 조회합니다."""
        return db.query(InspectionModel).filter(InspectionModel.model_name == model_name).first()
    
    def get_active_models(self, db: Session) -> List[InspectionModel]:
        """활성화된 검사 모델들을 가져옵니다."""
        return db.query(InspectionModel).filter(InspectionModel.is_active == True).all()

inspection_model = CRUDInspectionModel(InspectionModel)