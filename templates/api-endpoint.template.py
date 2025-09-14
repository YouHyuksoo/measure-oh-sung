# 타입 안전한 FastAPI 엔드포인트 템플릿
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field, validator
from datetime import datetime

# 실제 프로젝트에서 사용할 import들 (템플릿에서는 주석 처리)
# from app.db.database import get_db
# from app.schemas.base import BaseSchema
# from app.crud.base import CRUDBase
# from app.models.base import Base

# 템플릿용 임시 import
from typing import get_type_hints

# 1. 요청/응답 스키마 정의
class ItemCreateRequest(BaseModel):
    """아이템 생성 요청 스키마"""
    name: str = Field(..., min_length=1, max_length=100, description="아이템 이름")
    description: Optional[str] = Field(None, max_length=500, description="아이템 설명")
    category: str = Field(..., min_length=1, max_length=50, description="카테고리")
    value: float = Field(..., ge=0, description="값 (0 이상)")
    tags: List[str] = Field(default_factory=list, description="태그 목록")
    
    @validator('tags')
    def validate_tags(cls, v):
        if len(v) > 10:
            raise ValueError('태그는 최대 10개까지 가능합니다')
        return [tag.strip() for tag in v if tag.strip()]
    
    @validator('name')
    def validate_name(cls, v):
        if not v.strip():
            raise ValueError('이름은 공백일 수 없습니다')
        return v.strip()

class ItemUpdateRequest(BaseModel):
    """아이템 업데이트 요청 스키마"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    category: Optional[str] = Field(None, min_length=1, max_length=50)
    value: Optional[float] = Field(None, ge=0)
    tags: Optional[List[str]] = Field(None)
    
    @validator('tags')
    def validate_tags(cls, v):
        if v is not None and len(v) > 10:
            raise ValueError('태그는 최대 10개까지 가능합니다')
        return [tag.strip() for tag in v] if v else v

class ItemResponse(BaseModel):
    """아이템 응답 스키마"""
    id: int
    name: str
    description: Optional[str]
    category: str
    value: float
    tags: List[str]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class ItemListResponse(BaseModel):
    """아이템 목록 응답 스키마"""
    items: List[ItemResponse]
    total: int
    page: int
    size: int
    has_next: bool
    has_prev: bool

class ErrorResponse(BaseModel):
    """에러 응답 스키마"""
    error: str
    message: str
    error_code: Optional[str] = None
    details: Optional[Dict[str, Any]] = None

# 2. 라우터 생성
router = APIRouter(prefix="/items", tags=["items"])

# 3. 타입 안전한 CRUD 서비스
class ItemService:
    """아이템 서비스 (타입 안전)"""
    
    def __init__(self, db: Session):
        self.db = db
        # 실제 모델로 교체 필요
        # self.crud = CRUDBase(YourModel)
    
    async def create_item(self, item_data: ItemCreateRequest) -> ItemResponse:
        """아이템 생성 (타입 안전)"""
        try:
            # 데이터베이스에 저장
            # db_item = self.crud.create(self.db, obj_in=item_data)
            
            # 임시 응답 (실제 구현 시 교체)
            db_item = type('Item', (), {
                'id': 1,
                'name': item_data.name,
                'description': item_data.description,
                'category': item_data.category,
                'value': item_data.value,
                'tags': item_data.tags,
                'created_at': datetime.now(),
                'updated_at': datetime.now()
            })()
            
            return ItemResponse.from_orm(db_item)
            
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"아이템 생성 중 오류 발생: {str(e)}"
            )
    
    async def get_items(
        self, 
        skip: int = 0, 
        limit: int = 100,
        category: Optional[str] = None,
        search: Optional[str] = None
    ) -> ItemListResponse:
        """아이템 목록 조회 (타입 안전)"""
        try:
            # 데이터베이스에서 조회
            # items = self.crud.get_multi(self.db, skip=skip, limit=limit)
            # total = self.crud.count(self.db)
            
            # 임시 데이터 (실제 구현 시 교체)
            items = []
            total = 0
            
            # 페이지네이션 계산
            has_next = (skip + limit) < total
            has_prev = skip > 0
            page = (skip // limit) + 1
            
            return ItemListResponse(
                items=[ItemResponse.from_orm(item) for item in items],
                total=total,
                page=page,
                size=limit,
                has_next=has_next,
                has_prev=has_prev
            )
            
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"아이템 목록 조회 중 오류 발생: {str(e)}"
            )
    
    async def get_item(self, item_id: int) -> ItemResponse:
        """아이템 상세 조회 (타입 안전)"""
        try:
            # item = self.crud.get(self.db, id=item_id)
            # if not item:
            #     raise HTTPException(
            #         status_code=status.HTTP_404_NOT_FOUND,
            #         detail="아이템을 찾을 수 없습니다"
            #     )
            
            # 임시 응답 (실제 구현 시 교체)
            item = type('Item', (), {
                'id': item_id,
                'name': 'Sample Item',
                'description': 'Sample Description',
                'category': 'Sample Category',
                'value': 100.0,
                'tags': ['tag1', 'tag2'],
                'created_at': datetime.now(),
                'updated_at': datetime.now()
            })()
            
            return ItemResponse.from_orm(item)
            
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"아이템 조회 중 오류 발생: {str(e)}"
            )
    
    async def update_item(
        self, 
        item_id: int, 
        update_data: ItemUpdateRequest
    ) -> ItemResponse:
        """아이템 업데이트 (타입 안전)"""
        try:
            # item = self.crud.get(self.db, id=item_id)
            # if not item:
            #     raise HTTPException(
            #         status_code=status.HTTP_404_NOT_FOUND,
            #         detail="아이템을 찾을 수 없습니다"
            #     )
            
            # updated_item = self.crud.update(
            #     self.db, 
            #     db_obj=item, 
            #     obj_in=update_data
            # )
            
            # 임시 응답 (실제 구현 시 교체)
            updated_item = type('Item', (), {
                'id': item_id,
                'name': update_data.name or 'Updated Item',
                'description': update_data.description,
                'category': update_data.category or 'Updated Category',
                'value': update_data.value or 200.0,
                'tags': update_data.tags or ['updated'],
                'created_at': datetime.now(),
                'updated_at': datetime.now()
            })()
            
            return ItemResponse.from_orm(updated_item)
            
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"아이템 업데이트 중 오류 발생: {str(e)}"
            )
    
    async def delete_item(self, item_id: int) -> bool:
        """아이템 삭제 (타입 안전)"""
        try:
            # item = self.crud.get(self.db, id=item_id)
            # if not item:
            #     raise HTTPException(
            #         status_code=status.HTTP_404_NOT_FOUND,
            #         detail="아이템을 찾을 수 없습니다"
            #     )
            
            # self.crud.remove(self.db, id=item_id)
            return True
            
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"아이템 삭제 중 오류 발생: {str(e)}"
            )

# 4. 의존성 주입
def get_item_service(db: Session = Depends(None)) -> ItemService:  # get_db로 교체 필요
    """아이템 서비스 의존성 주입"""
    return ItemService(db)

# 5. API 엔드포인트들
@router.post(
    "/",
    response_model=ItemResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        400: {"model": ErrorResponse, "description": "잘못된 요청"},
        500: {"model": ErrorResponse, "description": "서버 오류"}
    }
)
async def create_item(
    item_data: ItemCreateRequest,
    service: ItemService = Depends(get_item_service)
) -> ItemResponse:
    """새 아이템 생성 (타입 안전)"""
    return await service.create_item(item_data)

@router.get(
    "/",
    response_model=ItemListResponse,
    responses={
        500: {"model": ErrorResponse, "description": "서버 오류"}
    }
)
async def get_items(
    skip: int = 0,
    limit: int = 100,
    category: Optional[str] = None,
    search: Optional[str] = None,
    service: ItemService = Depends(get_item_service)
) -> ItemListResponse:
    """아이템 목록 조회 (타입 안전)"""
    return await service.get_items(skip, limit, category, search)

@router.get(
    "/{item_id}",
    response_model=ItemResponse,
    responses={
        404: {"model": ErrorResponse, "description": "아이템을 찾을 수 없음"},
        500: {"model": ErrorResponse, "description": "서버 오류"}
    }
)
async def get_item(
    item_id: int,
    service: ItemService = Depends(get_item_service)
) -> ItemResponse:
    """아이템 상세 조회 (타입 안전)"""
    return await service.get_item(item_id)

@router.put(
    "/{item_id}",
    response_model=ItemResponse,
    responses={
        404: {"model": ErrorResponse, "description": "아이템을 찾을 수 없음"},
        400: {"model": ErrorResponse, "description": "잘못된 요청"},
        500: {"model": ErrorResponse, "description": "서버 오류"}
    }
)
async def update_item(
    item_id: int,
    update_data: ItemUpdateRequest,
    service: ItemService = Depends(get_item_service)
) -> ItemResponse:
    """아이템 업데이트 (타입 안전)"""
    return await service.update_item(item_id, update_data)

@router.delete(
    "/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={
        404: {"model": ErrorResponse, "description": "아이템을 찾을 수 없음"},
        500: {"model": ErrorResponse, "description": "서버 오류"}
    }
)
async def delete_item(
    item_id: int,
    service: ItemService = Depends(get_item_service)
) -> None:
    """아이템 삭제 (타입 안전)"""
    await service.delete_item(item_id)
