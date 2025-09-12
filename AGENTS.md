# Measure Oh Sung Project - Agent Instructions

## 오빠 라는 호칭, 한국어로 대답할것

## 프로젝트 개요

Python FastAPI 백엔드와 Next.js 프론트엔드로 구성된 풀스택 웹 애플리케이션입니다.

## 기술 스택

- **프론트엔드**: Next.js 15, React 19, TypeScript, Tailwind CSS v3
- **백엔드**: Python 3.12, FastAPI, Pydantic, SQLAlchemy
- **데이터베이스**: SQLite (개발), PostgreSQL (프로덕션)

## 프로젝트 구조

```
measure-oh-sung/
├── frontend/          # Next.js 프론트엔드
├── backend/           # Python FastAPI 백엔드
│   ├── app/          # FastAPI 애플리케이션
│   │   ├── api/      # API 라우터들
│   │   ├── core/     # 핵심 설정
│   │   ├── models/   # 데이터 모델
│   │   ├── schemas/  # Pydantic 스키마
│   │   ├── services/ # 비즈니스 로직
│   │   └── utils/    # 유틸리티
│   └── .venv/        # Python 가상환경
└── shared/           # 공통 리소스
```

## 코딩 규칙

### Python (백엔드)

- Python 3.12+ 문법 사용
- FastAPI와 Pydantic 모델 사용
- 타입 힌트 필수 사용
- PEP 8 스타일 가이드 준수
- 비동기 함수는 `async/await` 사용
- API 엔드포인트는 RESTful 설계 원칙 준수
- 에러 처리는 HTTPException 사용
- 데이터베이스 모델은 SQLAlchemy ORM 사용

### TypeScript/React (프론트엔드)

- TypeScript 엄격 모드 사용
- 함수형 컴포넌트와 React Hooks 사용
- Tailwind CSS로 스타일링
- Next.js App Router 사용
- API 호출은 fetch 또는 axios 사용
- 컴포넌트는 재사용 가능하게 설계
- Props 타입 정의 필수

### 파일 명명 규칙

- Python: snake_case (예: `user_service.py`)
- TypeScript/React: PascalCase (예: `UserProfile.tsx`)
- 컴포넌트 파일: PascalCase
- 유틸리티 파일: camelCase
- 상수 파일: UPPER_SNAKE_CASE

## API 설계 규칙

- RESTful API 설계 원칙 준수
- HTTP 상태 코드 적절히 사용
- API 버전 관리 (`/api/v1/`)
- 요청/응답 스키마는 Pydantic 모델 사용
- 에러 응답은 일관된 형식 사용
- CORS 설정으로 프론트엔드와 통신

## 개발 워크플로우

- Python 가상환경 사용 (.venv)
- Node.js 패키지는 package.json으로 관리
- 환경변수는 .env 파일 사용
- 개발 서버는 hot reload 활성화
- 코드 포맷팅은 저장 시 자동 적용

## 보안 규칙

- 환경변수로 민감한 정보 관리
- JWT 토큰으로 인증
- 입력 데이터 검증 (Pydantic)
- SQL 인젝션 방지 (SQLAlchemy ORM)
- CORS 설정으로 허용된 도메인만 접근

## 테스트 규칙

- 단위 테스트 작성 필수
- API 테스트는 pytest 사용
- 프론트엔드 테스트는 Jest 사용
- 테스트 커버리지 80% 이상 유지

## 코드 품질

- ESLint와 Prettier 설정 준수
- TypeScript strict 모드 사용
- 코드 중복 최소화
- 함수는 단일 책임 원칙 준수
- 매직 넘버 대신 상수 사용

이 규칙들을 따라 일관되고 유지보수 가능한 코드를 작성해주세요.
