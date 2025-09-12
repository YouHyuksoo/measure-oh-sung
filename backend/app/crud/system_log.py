from typing import List, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.crud.base import CRUDBase
from app.models.system_log import SystemLog, LogLevel, LogCategory
from app.schemas.system_log import SystemLogCreate, SystemLogUpdate

class CRUDSystemLog(CRUDBase[SystemLog, SystemLogCreate, SystemLogUpdate]):
    def get_by_level(self, db: Session, *, level: LogLevel, skip: int = 0, limit: int = 100) -> List[SystemLog]:
        """로그 레벨로 조회합니다."""
        return db.query(SystemLog).filter(
            SystemLog.level == level
        ).order_by(desc(SystemLog.created_at)).offset(skip).limit(limit).all()
    
    def get_by_category(self, db: Session, *, category: LogCategory, skip: int = 0, limit: int = 100) -> List[SystemLog]:
        """로그 카테고리로 조회합니다."""
        return db.query(SystemLog).filter(
            SystemLog.category == category
        ).order_by(desc(SystemLog.created_at)).offset(skip).limit(limit).all()
    
    def get_by_session(self, db: Session, *, session_id: str) -> List[SystemLog]:
        """세션 ID로 조회합니다."""
        return db.query(SystemLog).filter(
            SystemLog.session_id == session_id
        ).order_by(SystemLog.created_at).all()
    
    def get_recent_logs(self, db: Session, *, limit: int = 100) -> List[SystemLog]:
        """최근 로그들을 조회합니다."""
        return db.query(SystemLog).order_by(
            desc(SystemLog.created_at)
        ).limit(limit).all()

system_log = CRUDSystemLog(SystemLog)