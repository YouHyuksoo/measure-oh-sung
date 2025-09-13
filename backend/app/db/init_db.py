"""
데이터베이스 초기화 및 테이블 생성
"""
from sqlalchemy.orm import Session
from app import crud, schemas
from app.core.config import settings
from app.db.database import engine
from app.models import Base


def init_db(db: Session) -> None:
    """
    데이터베이스를 초기화하고 기본 데이터를 생성합니다.
    """
    # 모든 테이블을 생성합니다
    Base.metadata.create_all(bind=engine)
    print("데이터베이스 테이블 생성 완료")

    # 기본 검사 타이머 설정 생성 (조회 없이 바로 생성)
    try:
        default_timer = schemas.InspectionTimerSettingsCreate(
            name="기본 검사 타이머 설정",
            description="시스템 기본 검사 타이머 설정",
            p1_prepare_time=5,
            p1_duration=10,
            p2_prepare_time=5,
            p2_duration=15,
            p3_prepare_time=5,
            p3_duration=20,
            auto_progress=True,
            is_active=True
        )
        timer_settings = crud.inspection_timer_settings.create(db=db, obj_in=default_timer)
        db.commit()
        print("기본 검사 타이머 설정이 생성되었습니다.")
    except Exception as e:
        print(f"타이머 설정 생성 중 오류: {e}")

    # 기본 테스트 설정 생성 (조회 없이 바로 생성)
    try:
        default_test = schemas.TestSettingsCreate(
            name="기본 테스트 설정",
            description="시스템 기본 테스트 설정",
            p1_measure_duration=5.0,
            wait_duration_1_to_2=2.0,
            p2_measure_duration=5.0,
            wait_duration_2_to_3=2.0,
            p3_measure_duration=5.0,
            is_active=True
        )
        crud.test_settings.create(db=db, obj_in=default_test)
        db.commit()
        print("기본 테스트 설정이 생성되었습니다.")
    except Exception as e:
        print(f"테스트 설정 생성 중 오류: {e}")


if __name__ == "__main__":
    from app.db.database import SessionLocal

    db = SessionLocal()
    try:
        init_db(db)
        print("데이터베이스 초기화가 완료되었습니다.")
    finally:
        db.close()