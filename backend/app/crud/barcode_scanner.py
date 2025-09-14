from sqlalchemy.orm import Session
from typing import List, Optional
from ..models.barcode_scanner import BarcodeScannerSettings
from ..schemas.barcode_scanner import BarcodeScannerSettingsCreate, BarcodeScannerSettingsUpdate
from .base import CRUDBase


def get_barcode_scanner_settings(db: Session, skip: int = 0, limit: int = 100) -> List[BarcodeScannerSettings]:
    """모든 바코드 스캐너 설정 조회"""
    return db.query(BarcodeScannerSettings).offset(skip).limit(limit).all()


def get_active_barcode_scanner_settings(db: Session) -> Optional[BarcodeScannerSettings]:
    """활성화된 바코드 스캐너 설정 조회"""
    return db.query(BarcodeScannerSettings).filter(BarcodeScannerSettings.is_active == True).first()


def get_barcode_scanner_settings_by_id(db: Session, settings_id: int) -> Optional[BarcodeScannerSettings]:
    """ID로 바코드 스캐너 설정 조회"""
    return db.query(BarcodeScannerSettings).filter(BarcodeScannerSettings.id == settings_id).first()


def create_barcode_scanner_settings(db: Session, settings: BarcodeScannerSettingsCreate) -> BarcodeScannerSettings:
    """새로운 바코드 스캐너 설정 생성"""
    # 기존 활성 설정을 비활성화
    existing_active = db.query(BarcodeScannerSettings).filter(BarcodeScannerSettings.is_active == True).first()
    if existing_active:
        existing_active.is_active = False
    
    # 새 설정 생성
    db_settings = BarcodeScannerSettings(**settings.dict())
    db.add(db_settings)
    db.commit()
    db.refresh(db_settings)
    return db_settings


# CRUD 객체 생성
barcode_scanner = CRUDBase[BarcodeScannerSettings, BarcodeScannerSettingsCreate, BarcodeScannerSettingsUpdate](BarcodeScannerSettings)


def update_barcode_scanner_settings(db: Session, settings_id: int, settings: BarcodeScannerSettingsUpdate) -> Optional[BarcodeScannerSettings]:
    """바코드 스캐너 설정 업데이트"""
    db_settings = db.query(BarcodeScannerSettings).filter(BarcodeScannerSettings.id == settings_id).first()
    if not db_settings:
        return None
    
    update_data = settings.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_settings, field, value)
    
    db.commit()
    db.refresh(db_settings)
    return db_settings


# CRUD 객체 생성
barcode_scanner = CRUDBase[BarcodeScannerSettings, BarcodeScannerSettingsCreate, BarcodeScannerSettingsUpdate](BarcodeScannerSettings)


def delete_barcode_scanner_settings(db: Session, settings_id: int) -> bool:
    """바코드 스캐너 설정 삭제"""
    db_settings = db.query(BarcodeScannerSettings).filter(BarcodeScannerSettings.id == settings_id).first()
    if not db_settings:
        return False
    
    db.delete(db_settings)
    db.commit()
    return True


def activate_barcode_scanner_settings(db: Session, settings_id: int) -> Optional[BarcodeScannerSettings]:
    """바코드 스캐너 설정 활성화"""
    # 모든 설정을 비활성화
    db.query(BarcodeScannerSettings).update({"is_active": False})
    
    # 선택된 설정을 활성화
    db_settings = db.query(BarcodeScannerSettings).filter(BarcodeScannerSettings.id == settings_id).first()
    if db_settings:
        db_settings.is_active = True
        db.commit()
        db.refresh(db_settings)
    
    return db_settings


# CRUD 객체 생성
barcode_scanner = CRUDBase[BarcodeScannerSettings, BarcodeScannerSettingsCreate, BarcodeScannerSettingsUpdate](BarcodeScannerSettings)
