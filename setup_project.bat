@echo off
echo ========================================
echo   Measure Oh Sung Project Setup
echo ========================================
echo.

echo [1/4] Installing Frontend Dependencies...
cd frontend
call npm install
if %errorlevel% neq 0 (
    echo Frontend installation failed!
    pause
    exit /b 1
)
cd ..

echo.
echo [2/4] Creating Python Virtual Environment...
cd backend
python -m venv venv --upgrade-deps
if %errorlevel% neq 0 (
    echo Virtual environment creation failed!
    pause
    exit /b 1
)

echo.
echo [3/4] Installing Backend Dependencies...
call venv\Scripts\activate.bat
python -m pip install --upgrade pip
python -m pip install fastapi uvicorn pydantic pydantic-settings
if %errorlevel% neq 0 (
    echo Backend installation failed!
    pause
    exit /b 1
)
cd ..

echo.
echo [4/4] Setup Complete!
echo.
echo ========================================
echo   Project Setup Complete!
echo ========================================
echo.
echo Available commands:
echo   start_frontend.bat  - Start Next.js frontend
echo   start_backend.bat   - Start Python backend
echo   activate_backend.bat - Activate Python virtual environment
echo.
echo Frontend: http://localhost:3000
echo Backend:  http://localhost:8000
echo API Docs: http://localhost:8000/docs
echo.
pause
