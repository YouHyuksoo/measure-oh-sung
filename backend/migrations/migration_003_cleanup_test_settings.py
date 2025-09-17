"""
test_settings 테이블에서 P1, P2, P3 관련 컬럼 제거 마이그레이션
"""
import sqlite3
import os
from datetime import datetime

def run_migration():
    """test_settings 테이블에서 사용하지 않는 컬럼들을 제거합니다."""
    
    # 데이터베이스 파일 경로
    db_path = "backend/measure_oh_sung.db"
    
    if not os.path.exists(db_path):
        print("❌ 데이터베이스 파일을 찾을 수 없습니다.")
        return False
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("🔄 test_settings 테이블 정리 중...")
        
        # 기존 테이블 백업
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS test_settings_backup AS 
            SELECT * FROM test_settings
        """)
        print("✅ 기존 데이터 백업 완료")
        
        # 새로운 테이블 생성 (정리된 버전)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS test_settings_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name VARCHAR(100) NOT NULL,
                description VARCHAR(255),
                is_active BOOLEAN DEFAULT 0,
                inspection_model_id INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (inspection_model_id) REFERENCES inspection_models (id)
            )
        """)
        
        # 기존 데이터를 새 테이블로 복사 (필요한 컬럼만)
        cursor.execute("""
            INSERT INTO test_settings_new (id, name, description, is_active, inspection_model_id, created_at, updated_at)
            SELECT id, name, description, is_active, inspection_model_id, created_at, updated_at
            FROM test_settings
        """)
        
        # 기존 테이블 삭제
        cursor.execute("DROP TABLE test_settings")
        
        # 새 테이블을 원래 이름으로 변경
        cursor.execute("ALTER TABLE test_settings_new RENAME TO test_settings")
        
        # 인덱스 재생성
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_test_settings_is_active 
            ON test_settings (is_active)
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_test_settings_model_id 
            ON test_settings (inspection_model_id)
        """)
        
        conn.commit()
        print("✅ test_settings 테이블 정리 완료")
        
        # 정리된 데이터 확인
        cursor.execute("SELECT COUNT(*) FROM test_settings")
        count = cursor.fetchone()[0]
        print(f"📊 총 {count}개의 테스트 설정이 유지되었습니다")
        
        # 백업 테이블 삭제 (선택사항)
        cursor.execute("DROP TABLE test_settings_backup")
        print("🗑️ 백업 테이블 삭제 완료")
        
        return True
        
    except Exception as e:
        print(f"❌ 마이그레이션 실패: {e}")
        return False
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    print("🚀 test_settings 정리 마이그레이션 시작")
    success = run_migration()
    if success:
        print("🎉 마이그레이션 완료!")
    else:
        print("💥 마이그레이션 실패!")
