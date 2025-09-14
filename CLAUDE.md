# CLAUDE.md

Claude Code 작업 지침서 - Windows 개발 환경 전용

## 🎯 기본 원칙

- **호칭**: 오빠야!
- **언어**: 한국어로 응답
- **환경**: Windows CMD 명령어만 사용
- **경로**: Windows 스타일 백슬래시(`\`) 사용

---

## 📋 핵심 규칙

### 1. 셸 및 환경 규칙

- **필수**: CMD 기준으로만 명령어 작성
- **금지**: Bash, WSL, Git Bash 등 다른 셸 사용 금지
- **경로**: Windows 스타일(`D:\Project\...`) 만 사용
- **금지**: Unix/Linux 스타일 경로(`/bin`, `/usr` 등) 절대 사용 금지

### 2. 가상환경(venv) 규칙

- **Python 실행**: 반드시 `backend\.venv\Scripts\python.exe` 사용
- **실행 방식**: `python -m <모듈>` 패턴 권장
- **금지**: `.venvScriptspython.exe` 같은 축약형 사용 금지

### 3. Alembic 명령 규칙

**허용되는 명령어만 사용:**

```cmd
python -m alembic current        # 상태 확인
python -m alembic heads          # 최신 리비전 확인
python -m alembic upgrade head   # 최신으로 업그레이드
```

**절대 금지:** `alembic downgrade` 명령어

### 4. 실행 전 검증 규칙

명령어 실행 전 반드시 다음 정보 출력:

1. 현재 작업 디렉터리
2. 사용하는 Python 경로 (`.venv\Scripts\python.exe`)
3. 실행하려는 구체적인 명령어

### 5. 보안 및 안전 규칙

**절대 금지:**

- `sudo`, `rm -rf`, `--force` 등 위험 명령
- 데이터베이스 파괴적 동작 (스키마 드롭, 롤백)
- 즉시 실행 (반드시 검증 → 실행 2단계)

### 6. 명령 생성 정책

- 지정된 표준 명령어 사전 외 명령 생성 금지
- 조건 불충족 시: **"허용되지 않은 명령어"** 출력
- 동일 명령어 중복 출력 금지

---

## 🏗️ 프로젝트 구조

### Backend (Python FastAPI)

```
backend/
├── app/
│   ├── api/        # API 엔드포인트
│   ├── models/     # SQLAlchemy 모델
│   ├── schemas/    # Pydantic 모델
│   ├── services/   # 비즈니스 로직
│   └── core/       # 설정 및 유틸리티
└── .venv/          # 가상환경
```

### Frontend (Next.js 15 + React 19)

```
frontend/
├── src/            # 소스코드
├── public/         # 정적 파일
└── node_modules/   # 의존성
```

---

## ⚡ 주요 명령어

### 개발 환경 설정

```cmd
setup_project.bat                    # 초기 프로젝트 설정
npm run install:frontend             # Frontend 의존성 설치
npm run install:backend              # Backend 의존성 설치
```

### 개발 서버 실행

```cmd
# Frontend (포트 3000)
npm run dev
start_frontend.bat

# Backend (포트 8000)
start_backend.bat
activate_backend.bat
```

### 코드 품질

```cmd
npm run lint                         # 린팅 실행
```

---

## 🛠️ 기술 스택

### Backend

- **프레임워크**: FastAPI (async/await 패턴)
- **ORM**: SQLAlchemy + PostgreSQL
- **인증**: JWT (python-jose)
- **검증**: Pydantic
- **테스팅**: pytest + pytest-asyncio

### Frontend

- **프레임워크**: Next.js 15 + React 19
- **언어**: TypeScript (strict mode)
- **스타일링**: Tailwind CSS v3
- **상태관리**: Zustand
- **컴포넌트**: 함수형 컴포넌트 + Hooks만 사용

---

## 📡 API 문서

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

---

## 📋 코딩 표준

### Backend 규칙

- 모든 엔드포인트에서 async/await 사용
- RESTful API 설계 (`/api/v1/` 접두사)
- snake_case (테이블/컬럼명)
- PascalCase (클래스명)

### Frontend 규칙

- TypeScript strict mode (`any` 타입 금지)
- 함수형 컴포넌트 + Hooks만 사용
- Tailwind CSS만 사용 (인라인 스타일 금지)
- PascalCase (컴포넌트 파일명/export명)
- 경로 별칭: `@/*` → `./src/*`

---

## 🗄️ 데이터베이스

- **운영**: PostgreSQL (psycopg2-binary)
- **ORM**: SQLAlchemy + Alembic 마이그레이션
- **네이밍**: PascalCase 클래스, snake_case 테이블/컬럼
