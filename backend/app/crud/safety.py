"""
안전검사 관련 CRUD
- SafetyInspectionResult: 3대안전 검사 결과 CRUD
"""
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc, and_, or_
from datetime import datetime, timedelta

from app.models.safety import SafetyInspectionResult
from app.schemas.safety import SafetyInspectionResultCreate, SafetyInspectionResultUpdate

class SafetyInspectionCRUD:
    """3대안전 검사 결과 CRUD 클래스"""
    
    def create(self, db: Session, obj_in: SafetyInspectionResultCreate) -> SafetyInspectionResult:
        """3대안전 검사 결과 생성"""
        db_obj = SafetyInspectionResult(**obj_in.dict())
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj
    
    def get(self, db: Session, id: int) -> Optional[SafetyInspectionResult]:
        """ID로 3대안전 검사 결과 조회"""
        return db.query(SafetyInspectionResult).filter(SafetyInspectionResult.id == id).first()
    
    def get_by_barcode(self, db: Session, barcode: str) -> List[SafetyInspectionResult]:
        """바코드로 3대안전 검사 결과 조회"""
        return db.query(SafetyInspectionResult).filter(
            SafetyInspectionResult.barcode == barcode
        ).order_by(desc(SafetyInspectionResult.created_at)).all()
    
    def get_by_session(self, db: Session, session_id: str) -> Optional[SafetyInspectionResult]:
        """세션 ID로 3대안전 검사 결과 조회"""
        return db.query(SafetyInspectionResult).filter(
            SafetyInspectionResult.session_id == session_id
        ).first()
    
    def get_multi(
        self, 
        db: Session, 
        skip: int = 0, 
        limit: int = 100,
        barcode: Optional[str] = None,
        overall_result: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> List[SafetyInspectionResult]:
        """3대안전 검사 결과 목록 조회"""
        query = db.query(SafetyInspectionResult)
        
        # 필터 조건 적용
        if barcode:
            query = query.filter(SafetyInspectionResult.barcode.ilike(f"%{barcode}%"))
        
        if overall_result:
            query = query.filter(SafetyInspectionResult.overall_result == overall_result)
        
        if start_date:
            query = query.filter(SafetyInspectionResult.created_at >= start_date)
        
        if end_date:
            query = query.filter(SafetyInspectionResult.created_at <= end_date)
        
        return query.order_by(desc(SafetyInspectionResult.created_at)).offset(skip).limit(limit).all()
    
    def get_stats(self, db: Session, days: int = 30) -> dict:
        """3대안전 검사 통계 조회"""
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        
        # 전체 통계
        total = db.query(SafetyInspectionResult).count()
        
        # 기간 내 통계
        period_query = db.query(SafetyInspectionResult).filter(
            SafetyInspectionResult.created_at >= start_date,
            SafetyInspectionResult.created_at <= end_date
        )
        
        period_total = period_query.count()
        pass_count = period_query.filter(SafetyInspectionResult.overall_result == "PASS").count()
        fail_count = period_query.filter(SafetyInspectionResult.overall_result == "FAIL").count()
        pending_count = period_query.filter(SafetyInspectionResult.overall_result == "PENDING").count()
        
        # 오늘 통계
        today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = datetime.now().replace(hour=23, minute=59, second=59, microsecond=999999)
        
        today_query = db.query(SafetyInspectionResult).filter(
            SafetyInspectionResult.created_at >= today_start,
            SafetyInspectionResult.created_at <= today_end
        )
        
        today_total = today_query.count()
        today_pass = today_query.filter(SafetyInspectionResult.overall_result == "PASS").count()
        today_fail = today_query.filter(SafetyInspectionResult.overall_result == "FAIL").count()
        today_pending = today_query.filter(SafetyInspectionResult.overall_result == "PENDING").count()
        
        return {
            "total": total,
            "period": {
                "total": period_total,
                "pass": pass_count,
                "fail": fail_count,
                "pending": pending_count,
                "pass_rate": round((pass_count / period_total * 100) if period_total > 0 else 0, 2)
            },
            "today": {
                "total": today_total,
                "pass": today_pass,
                "fail": today_fail,
                "pending": today_pending,
                "pass_rate": round((today_pass / today_total * 100) if today_total > 0 else 0, 2)
            }
        }
    
    def update(
        self, 
        db: Session, 
        db_obj: SafetyInspectionResult, 
        obj_in: SafetyInspectionResultUpdate
    ) -> SafetyInspectionResult:
        """3대안전 검사 결과 업데이트"""
        update_data = obj_in.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_obj, field, value)
        
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj
    
    def delete(self, db: Session, id: int) -> Optional[SafetyInspectionResult]:
        """3대안전 검사 결과 삭제"""
        obj = db.query(SafetyInspectionResult).get(id)
        if obj:
            db.delete(obj)
            db.commit()
        return obj

# 전역 인스턴스
safety_inspection = SafetyInspectionCRUD()
