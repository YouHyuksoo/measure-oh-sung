"""
마이그레이션: 검사단계 테이블 추가 및 기존 모델 구조 변경

이 마이그레이션은:
1. inspection_steps 테이블을 생성
2. 기존 inspection_models 테이블에서 고정된 P1, P2, P3 컬럼을 제거
3. 기존 데이터를 새로운 구조로 마이그레이션
"""

from sqlalchemy import text
from app.db.database import engine

def upgrade():
    """마이그레이션 실행"""
    print("마이그레이션 시작...")
    with engine.connect() as conn:
        # 1. inspection_steps 테이블 생성
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS inspection_steps (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                inspection_model_id INTEGER NOT NULL,
                step_name VARCHAR(100) NOT NULL,
                step_order INTEGER NOT NULL,
                lower_limit FLOAT NOT NULL,
                upper_limit FLOAT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (inspection_model_id) REFERENCES inspection_models (id) ON DELETE CASCADE
            )
        """))
        
        # 2. 기존 데이터를 새로운 구조로 마이그레이션
        # 먼저 기존 모델들의 검사단계 데이터를 생성
        conn.execute(text("""
            INSERT INTO inspection_steps (inspection_model_id, step_name, step_order, lower_limit, upper_limit)
            SELECT 
                id as inspection_model_id,
                'P1 단계' as step_name,
                1 as step_order,
                p1_lower_limit as lower_limit,
                p1_upper_limit as upper_limit
            FROM inspection_models
            WHERE p1_lower_limit IS NOT NULL AND p1_upper_limit IS NOT NULL
        """))
        
        conn.execute(text("""
            INSERT INTO inspection_steps (inspection_model_id, step_name, step_order, lower_limit, upper_limit)
            SELECT 
                id as inspection_model_id,
                'P2 단계' as step_name,
                2 as step_order,
                p2_lower_limit as lower_limit,
                p2_upper_limit as upper_limit
            FROM inspection_models
            WHERE p2_lower_limit IS NOT NULL AND p2_upper_limit IS NOT NULL
        """))
        
        conn.execute(text("""
            INSERT INTO inspection_steps (inspection_model_id, step_name, step_order, lower_limit, upper_limit)
            SELECT 
                id as inspection_model_id,
                'P3 단계' as step_name,
                3 as step_order,
                p3_lower_limit as lower_limit,
                p3_upper_limit as upper_limit
            FROM inspection_models
            WHERE p3_lower_limit IS NOT NULL AND p3_upper_limit IS NOT NULL
        """))
        
        # 3. 기존 컬럼들 제거 (SQLite에서는 ALTER TABLE DROP COLUMN을 지원하지 않으므로 새 테이블 생성)
        conn.execute(text("""
            CREATE TABLE inspection_models_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                model_name VARCHAR(100) UNIQUE NOT NULL,
                description VARCHAR(255),
                is_active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """))
        
        # 4. 기존 데이터를 새 테이블로 복사
        conn.execute(text("""
            INSERT INTO inspection_models_new (id, model_name, description, is_active, created_at, updated_at)
            SELECT id, model_name, description, is_active, created_at, updated_at
            FROM inspection_models
        """))
        
        # 5. 기존 테이블 삭제 및 새 테이블 이름 변경
        conn.execute(text("DROP TABLE inspection_models"))
        conn.execute(text("ALTER TABLE inspection_models_new RENAME TO inspection_models"))
        
        # 6. 인덱스 생성
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_inspection_steps_model_id 
            ON inspection_steps (inspection_model_id)
        """))
        
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_inspection_steps_order 
            ON inspection_steps (inspection_model_id, step_order)
        """))
        
        conn.commit()

def downgrade():
    """마이그레이션 롤백"""
    with engine.connect() as conn:
        # 1. inspection_steps 테이블 삭제
        conn.execute(text("DROP TABLE IF EXISTS inspection_steps"))
        
        # 2. inspection_models 테이블을 원래 구조로 복원
        conn.execute(text("""
            CREATE TABLE inspection_models_old (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                model_name VARCHAR(100) UNIQUE NOT NULL,
                description VARCHAR(255),
                p1_lower_limit FLOAT NOT NULL,
                p1_upper_limit FLOAT NOT NULL,
                p2_lower_limit FLOAT NOT NULL,
                p2_upper_limit FLOAT NOT NULL,
                p3_lower_limit FLOAT NOT NULL,
                p3_upper_limit FLOAT NOT NULL,
                is_active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """))
        
        # 3. 기본값으로 데이터 복사
        conn.execute(text("""
            INSERT INTO inspection_models_old (id, model_name, description, is_active, created_at, updated_at, p1_lower_limit, p1_upper_limit, p2_lower_limit, p2_upper_limit, p3_lower_limit, p3_upper_limit)
            SELECT id, model_name, description, is_active, created_at, updated_at, 0, 100, 0, 100, 0, 100
            FROM inspection_models
        """))
        
        # 4. 테이블 교체
        conn.execute(text("DROP TABLE inspection_models"))
        conn.execute(text("ALTER TABLE inspection_models_old RENAME TO inspection_models"))
        
        conn.commit()

if __name__ == "__main__":
    print("마이그레이션 실행 중...")
    upgrade()
    print("마이그레이션 완료!")
