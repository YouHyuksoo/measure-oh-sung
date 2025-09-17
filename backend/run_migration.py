#!/usr/bin/env python3
"""
데이터베이스 마이그레이션 실행 스크립트
"""

import sys
import os
from pathlib import Path

# 프로젝트 루트를 Python 경로에 추가
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from migrations.migration_001_add_inspection_steps import upgrade, downgrade

def main():
    if len(sys.argv) > 1 and sys.argv[1] == "downgrade":
        print("마이그레이션 롤백 실행 중...")
        downgrade()
        print("롤백 완료!")
    else:
        print("마이그레이션 실행 중...")
        upgrade()
        print("마이그레이션 완료!")

if __name__ == "__main__":
    main()
