# 타입 안전한 Python 서비스 템플릿
from typing import Optional, List, Dict, Any, Union, TypeVar, Generic
from dataclasses import dataclass
from enum import Enum
from datetime import datetime
import logging

from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

# 1. 타입 변수 정의
T = TypeVar('T')
ModelType = TypeVar('ModelType')
CreateSchemaType = TypeVar('CreateSchemaType', bound=BaseModel)
UpdateSchemaType = TypeVar('UpdateSchemaType', bound=BaseModel)

# 2. 열거형 정의
class ServiceStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    ERROR = "error"

class OperationResult(str, Enum):
    SUCCESS = "success"
    FAILURE = "failure"
    PARTIAL = "partial"

# 3. 데이터 클래스 정의
@dataclass
class ServiceConfig:
    name: str
    timeout: int = 30
    retry_count: int = 3
    enabled: bool = True

# 4. Pydantic 스키마 정의
class ServiceRequest(BaseModel):
    operation: str = Field(..., description="수행할 작업")
    parameters: Dict[str, Any] = Field(default_factory=dict)
    timeout: Optional[int] = Field(None, ge=1, le=300)

class ServiceResponse(BaseModel):
    success: bool
    data: Optional[Dict[str, Any]] = None
    message: Optional[str] = None
    error_code: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.now)

# 5. 제네릭 서비스 클래스
class BaseService(Generic[ModelType, CreateSchemaType, UpdateSchemaType]):
    """타입 안전한 기본 서비스 클래스"""
    
    def __init__(
        self, 
        model: type[ModelType],
        config: ServiceConfig,
        logger: Optional[logging.Logger] = None
    ):
        self.model = model
        self.config = config
        self.logger = logger or logging.getLogger(__name__)
        self._status = ServiceStatus.ACTIVE
    
    @property
    def status(self) -> ServiceStatus:
        """서비스 상태 반환"""
        return self._status
    
    def set_status(self, status: ServiceStatus) -> None:
        """서비스 상태 설정"""
        self._status = status
        self.logger.info(f"Service status changed to: {status}")
    
    async def execute_operation(
        self, 
        request: ServiceRequest,
        db: Session
    ) -> ServiceResponse:
        """작업 실행 (타입 안전)"""
        try:
            self.logger.info(f"Executing operation: {request.operation}")
            
            # 타입 안전한 작업 실행
            result = await self._perform_operation(request, db)
            
            return ServiceResponse(
                success=True,
                data=result,
                message="작업이 성공적으로 완료되었습니다"
            )
            
        except Exception as e:
            self.logger.error(f"Operation failed: {str(e)}")
            return ServiceResponse(
                success=False,
                message=f"작업 실행 중 오류 발생: {str(e)}",
                error_code="OPERATION_FAILED"
            )
    
    async def _perform_operation(
        self, 
        request: ServiceRequest, 
        db: Session
    ) -> Dict[str, Any]:
        """구체적인 작업 수행 (하위 클래스에서 구현)"""
        raise NotImplementedError("하위 클래스에서 구현해야 합니다")
    
    def validate_request(self, request: ServiceRequest) -> bool:
        """요청 유효성 검사"""
        if not request.operation:
            return False
        
        if request.timeout and (request.timeout < 1 or request.timeout > 300):
            return False
        
        return True

# 6. 구체적인 서비스 구현 예시
class DataService(BaseService[ModelType, CreateSchemaType, UpdateSchemaType]):
    """데이터 처리 서비스"""
    
    async def create_item(
        self, 
        item_data: CreateSchemaType, 
        db: Session
    ) -> Optional[ModelType]:
        """아이템 생성 (타입 안전)"""
        try:
            # 타입 안전한 데이터 변환
            item_dict = item_data.dict() if hasattr(item_data, 'dict') else item_data
            
            # 데이터베이스에 저장
            db_item = self.model(**item_dict)
            db.add(db_item)
            db.commit()
            db.refresh(db_item)
            
            self.logger.info(f"Item created successfully: {db_item.id}")
            return db_item
            
        except Exception as e:
            self.logger.error(f"Failed to create item: {str(e)}")
            db.rollback()
            return None
    
    async def get_items(
        self, 
        db: Session, 
        skip: int = 0, 
        limit: int = 100
    ) -> List[ModelType]:
        """아이템 목록 조회 (타입 안전)"""
        try:
            items = db.query(self.model).offset(skip).limit(limit).all()
            self.logger.info(f"Retrieved {len(items)} items")
            return items
            
        except Exception as e:
            self.logger.error(f"Failed to retrieve items: {str(e)}")
            return []
    
    async def update_item(
        self, 
        item_id: int, 
        update_data: UpdateSchemaType, 
        db: Session
    ) -> Optional[ModelType]:
        """아이템 업데이트 (타입 안전)"""
        try:
            item = db.query(self.model).filter(self.model.id == item_id).first()
            if not item:
                self.logger.warning(f"Item not found: {item_id}")
                return None
            
            # 타입 안전한 업데이트
            update_dict = update_data.dict(exclude_unset=True) if hasattr(update_data, 'dict') else update_data
            
            for field, value in update_dict.items():
                if hasattr(item, field):
                    setattr(item, field, value)
            
            db.commit()
            db.refresh(item)
            
            self.logger.info(f"Item updated successfully: {item_id}")
            return item
            
        except Exception as e:
            self.logger.error(f"Failed to update item {item_id}: {str(e)}")
            db.rollback()
            return None
    
    async def delete_item(self, item_id: int, db: Session) -> bool:
        """아이템 삭제 (타입 안전)"""
        try:
            item = db.query(self.model).filter(self.model.id == item_id).first()
            if not item:
                self.logger.warning(f"Item not found: {item_id}")
                return False
            
            db.delete(item)
            db.commit()
            
            self.logger.info(f"Item deleted successfully: {item_id}")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to delete item {item_id}: {str(e)}")
            db.rollback()
            return False

# 7. 사용 예시
def create_service_example():
    """서비스 생성 및 사용 예시"""
    
    # 설정 생성
    config = ServiceConfig(
        name="example_service",
        timeout=60,
        retry_count=5
    )
    
    # 서비스 생성 (타입 안전)
    # service = DataService(YourModel, config)
    
    # 요청 생성
    request = ServiceRequest(
        operation="create_item",
        parameters={"name": "test", "value": 123},
        timeout=30
    )
    
    # 타입 안전한 사용
    # response = await service.execute_operation(request, db_session)
    
    return config, request
