"""
폴링 설정 테이블 추가 마이그레이션
"""
import sqlite3
import os
from datetime import datetime

def run_migration():
    """폴링 설정 테이블을 생성합니다."""
    
    # 데이터베이스 파일 경로
    db_path = "app.db"
    
    if not os.path.exists(db_path):
        print("❌ 데이터베이스 파일을 찾을 수 없습니다.")
        return False
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("🔄 폴링 설정 테이블 생성 중...")
        
        # 폴링 설정 테이블 생성
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS polling_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                model_id INTEGER NOT NULL,
                polling_interval REAL NOT NULL DEFAULT 0.5,
                polling_duration REAL NOT NULL DEFAULT 30.0,
                is_active BOOLEAN NOT NULL DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (model_id) REFERENCES inspection_models (id) ON DELETE CASCADE
            )
        """)
        
        # 인덱스 생성
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_polling_settings_model_id 
            ON polling_settings (model_id)
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_polling_settings_is_active 
            ON polling_settings (is_active)
        """)
        
        # 기존 검사 모델들에 대한 기본 폴링 설정 생성
        print("🔄 기존 모델들에 대한 기본 폴링 설정 생성 중...")
        
        cursor.execute("SELECT id FROM inspection_models WHERE is_active = 1")
        active_models = cursor.fetchall()
        
        for (model_id,) in active_models:
            # 이미 폴링 설정이 있는지 확인
            cursor.execute("SELECT id FROM polling_settings WHERE model_id = ?", (model_id,))
            existing = cursor.fetchone()
            
            if not existing:
                # 기본 폴링 설정 생성
                cursor.execute("""
                    INSERT INTO polling_settings (model_id, polling_interval, polling_duration, is_active)
                    VALUES (?, 0.5, 30.0, 1)
                """, (model_id,))
                print(f"  ✅ 모델 ID {model_id}에 기본 폴링 설정 생성")
        
        conn.commit()
        print("✅ 폴링 설정 테이블 생성 완료")
        
        # 생성된 설정 확인
        cursor.execute("SELECT COUNT(*) FROM polling_settings")
        count = cursor.fetchone()[0]
        print(f"📊 총 {count}개의 폴링 설정이 생성되었습니다")
        
        return True
        
    except Exception as e:
        print(f"❌ 마이그레이션 실패: {e}")
        return False
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    print("🚀 폴링 설정 마이그레이션 시작")
    success = run_migration()
    if success:
        print("🎉 마이그레이션 완료!")
    else:
        print("💥 마이그레이션 실패!")
