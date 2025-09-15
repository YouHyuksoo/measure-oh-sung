# Measure Oh Sung

Python 백엔드와 Next.js 프론트엔드로 구성된 프로젝트입니다.

## 프로젝트 구조

```
measure-oh-sung/
├── frontend/                 # Next.js 프론트엔드
│   ├── src/                 # 소스 코드
│   ├── public/              # 정적 파일들
│   ├── node_modules/        # Node.js 의존성
│   ├── package.json         # Node.js 의존성 정의
│   ├── next.config.ts       # Next.js 설정
│   ├── tailwind.config.js   # Tailwind CSS 설정
│   ├── postcss.config.mjs   # PostCSS 설정
│   └── tsconfig.json        # TypeScript 설정
│
├── backend/                 # Python 백엔드
│   ├── app/                # FastAPI 애플리케이션
│   │   ├── api/            # API 라우터들
│   │   ├── core/           # 핵심 설정들
│   │   ├── models/         # 데이터 모델들
│   │   ├── schemas/        # Pydantic 스키마들
│   │   ├── services/       # 비즈니스 로직
│   │   └── utils/          # 유틸리티 함수들
│   ├── tests/              # 테스트 파일들
│   ├── venv/               # Python 가상환경
│   └── requirements.txt    # Python 의존성
├── shared/                  # 공통 리소스 (예정)
├── docs/                    # 문서 (예정)
└── scripts/                 # 유틸리티 스크립트 (예정)
```

## 빠른 시작

### 1. 프로젝트 설정 (최초 1회)

```cmd
setup_project.bat
```

### 2. 개발 서버 실행

```cmd
# 프론트엔드 실행
start_frontend.bat

# 백엔드 실행 (새 터미널에서)
start_backend.bat
```

## 개발 환경 실행

### 프론트엔드 (Next.js)

```bash
# 루트에서 실행
npm run dev

# 또는 frontend 폴더에서 직접 실행
cd frontend
npm run dev

# 또는 배치 파일 사용
start_frontend.bat
```

서버가 http://localhost:3000 에서 실행됩니다.

### 백엔드 (Python FastAPI)

```bash
# 가상환경 활성화 후 실행
venv\Scripts\activate
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 또는 배치 파일 사용
start_backend.bat
```

서버가 http://localhost:8000 에서 실행됩니다.

### 가상환경 활성화

```cmd
# Python 가상환경 활성화
activate_backend.bat
```

### API 문서

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 기술 스택

- **프론트엔드**: Next.js 15, React 19, TypeScript, Tailwind CSS v3
- **백엔드**: Python 3.12, FastAPI, Pydantic
- **데이터베이스**: SQLite (개발용)

## 프로젝트 설정 파일 설명

### 📁 루트 디렉토리 설정 파일들

#### **package.json**

- **목적**: 루트 프로젝트 관리 및 편의 스크립트
- **주요 기능**:
  - `npm run dev` → frontend 개발 서버 실행
  - `npm run build` → frontend 빌드
  - `npm run lint` → ESLint 실행
- **설명**: frontend 폴더의 package.json과 별개로 루트에서 전체 프로젝트를 관리

#### **eslint.config.mjs**

- **목적**: ESLint 설정 (프론트엔드 코드 품질 관리)
- **주요 설정**:
  - `frontend/**/*.{js,jsx,ts,tsx}` 파일만 검사
  - Next.js 및 TypeScript 규칙 적용
  - `frontend/node_modules/`, `frontend/.next/` 등 무시

#### **.gitignore**

- **목적**: Git에서 추적하지 않을 파일들 정의
- **주요 무시 항목**:
  - `frontend/node_modules/` - Node.js 의존성
  - `backend/.venv/` - Python 가상환경
  - `frontend/.next/` - Next.js 빌드 파일
  - `.env*` - 환경변수 파일들

### 📁 Frontend 설정 파일들 (`frontend/`)

#### **package.json**

- **목적**: Next.js 프로젝트 의존성 관리
- **주요 의존성**: React 19, Next.js 15, TypeScript, Tailwind CSS v3

#### **next.config.ts**

- **목적**: Next.js 설정
- **기능**: 빌드 옵션, 환경변수, 플러그인 설정

#### **tailwind.config.js**

- **목적**: Tailwind CSS 설정
- **주요 설정**:
  - `content`: CSS 클래스가 사용되는 파일 경로
  - `theme`: 커스텀 색상, 폰트 등 테마 설정

#### **postcss.config.mjs**

- **목적**: PostCSS 설정 (CSS 전처리)
- **기능**: Tailwind CSS와 Autoprefixer 플러그인 설정

#### **tsconfig.json**

- **목적**: TypeScript 컴파일러 설정
- **주요 설정**:
  - `@/*` → `./src/*` 경로 별칭
  - Next.js 플러그인 활성화

### 📁 Backend 설정 파일들 (`backend/`)

#### **requirements.txt**

- **목적**: Python 의존성 관리
- **주요 패키지**: FastAPI, Uvicorn, Pydantic, SQLAlchemy

#### **app/main.py**

- **목적**: FastAPI 애플리케이션 진입점
- **기능**: CORS 설정, API 라우터 등록

#### **app/core/config.py**

- **목적**: 애플리케이션 설정 관리
- **주요 설정**: 데이터베이스 URL, CORS 설정, 보안 키

### 📁 Cursor IDE 설정 파일들

#### **.cursorrules**

- **목적**: Cursor AI 어시스턴트를 위한 프로젝트 규칙
- **내용**: 코딩 스타일, 프로젝트 구조, 기술 스택 가이드

#### **.vscode/settings.json**

- **목적**: Cursor/VSCode 프로젝트별 설정
- **주요 설정**:
  - Python 인터프리터 경로
  - TypeScript 설정
  - 코드 포맷팅 규칙
- **참고**: MCP 설정은 사용자 레벨에서 관리 (`C:\Users\hsyou\.cursor\mcp.json`)

### 📁 배치 스크립트 파일들

#### **setup_project.bat**

- **목적**: 프로젝트 초기 설정 자동화
- **기능**: 프론트엔드/백엔드 의존성 설치

#### **start_frontend.bat**

- **목적**: Next.js 개발 서버 시작
- **기능**: `cd frontend && npm run dev`

#### **start_backend.bat**

- **목적**: FastAPI 서버 시작
- **기능**: 가상환경 활성화 + 서버 실행

#### **activate_backend.bat**

- **목적**: Python 가상환경 활성화
- **기능**: 가상환경 활성화 + 명령 프롬프트 유지

#### **install_frontend.bat**

- **목적**: 프론트엔드 의존성 설치
- **기능**: `cd frontend && npm install`

#### **install_backend.bat**

- **목적**: 백엔드 의존성 설치
- **기능**: 가상환경 생성 + 패키지 설치

## 설정 파일 관리 가이드

### 🔧 수정이 필요한 경우

1. **프론트엔드 설정 변경**: `frontend/` 폴더 내 파일들 수정
2. **백엔드 설정 변경**: `backend/` 폴더 내 파일들 수정
3. **전체 프로젝트 설정**: 루트 디렉토리 파일들 수정

### ⚠️ 주의사항

- **`.env` 파일**: 민감한 정보 포함, Git에 커밋하지 않음
- **`node_modules/`**: 자동 생성, Git에 커밋하지 않음
- **`.venv/`**: Python 가상환경, Git에 커밋하지 않음
- **`.next/`**: Next.js 빌드 파일, Git에 커밋하지 않음

### 🚀 새로운 개발자 온보딩

1. **프로젝트 클론**
2. **`setup_project.bat` 실행**
3. **`start_frontend.bat` + `start_backend.bat` 실행**
4. **개발 시작!**

이 설정들을 통해 일관되고 효율적인 개발 환경을 구축할 수 있습니다.
