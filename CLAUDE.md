# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

오빠클라우드 라고 호칭하고 , 한국어로 대답해.
window 환경에서 개발하고 있으므로 cmd 명령으로 사용할것.

## Project Architecture

This is a full-stack application with separate backend and frontend:

- **Backend**: Python FastAPI application in `backend/` directory

  - FastAPI with async/await patterns
  - SQLAlchemy ORM with PostgreSQL (psycopg2-binary for production)
  - Pydantic for data validation and serialization
  - JWT authentication with python-jose
  - Structured as: `app/api/`, `app/models/`, `app/schemas/`, `app/services/`, `app/core/`

- **Frontend**: Next.js 15 with React 19 in `frontend/` directory
  - TypeScript with strict mode
  - Tailwind CSS v3 for styling
  - Modern React with function components and hooks only

## Common Commands

### Development Setup

```bash
# Initial project setup (run once)
setup_project.bat

# Or install dependencies separately:
npm run install:frontend    # Install frontend deps from root
npm run install:backend     # Install backend deps from root
```

### Development Servers

```bash
# Frontend (Next.js) - runs on http://localhost:3000
npm run dev                 # From root directory
# OR
start_frontend.bat

# Backend (FastAPI) - runs on http://localhost:8000
start_backend.bat
# OR manually:
cd backend && .venv\Scripts\activate && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Code Quality

```bash
# Linting (from root)
npm run lint

# Backend virtual environment activation
activate_backend.bat
```

### Testing

- Backend: Uses pytest with pytest-asyncio for async tests
- Frontend: Configuration suggests Jest (check frontend/package.json for test scripts)

## API Documentation

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Code Standards

### Backend (Python/FastAPI)

- Use async/await for all endpoints and database operations
- RESTful API design with `/api/v1/` prefix
- Pydantic models for request/response validation in `app/schemas/`
- SQLAlchemy models in `app/models/` with snake_case table/column names
- Business logic in `app/services/`
- Environment variables for configuration (python-dotenv)

### Frontend (Next.js/React)

- TypeScript strict mode - no `any` types allowed
- Function components with React Hooks only
- Props interfaces defined at component top
- Tailwind CSS classes only (no inline styles)
- Component naming: PascalCase files and exports
- Path alias: `@/*` maps to `./src/*`

### General

- ESLint configuration covers frontend code only
- Git ignores: `frontend/node_modules/`, `backend/.venv/`, `frontend/.next/`, `.env*`
- Korean language support in development (Cursor rules specify Korean responses)

## Database

- PostgreSQL in production (psycopg2-binary)
- SQLAlchemy ORM with Alembic for migrations
- Models follow: PascalCase classes, snake_case tables/columns
