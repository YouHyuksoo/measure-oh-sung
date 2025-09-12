@echo off
echo ========================================
echo   Activating Python Virtual Environment
echo ========================================
echo.

cd backend

if not exist "venv\Scripts\activate.bat" (
    echo Error: Virtual environment not found!
    echo Please run 'install_backend.bat' first.
    echo.
    pause
    exit /b 1
)

echo Activating virtual environment...
call venv\Scripts\activate.bat

echo.
echo ✓ Virtual environment activated successfully!
echo.
echo Current directory: %CD%
echo Python path: %VIRTUAL_ENV%\Scripts\python.exe
echo.
echo Available commands:
echo   python --version
echo   pip list
echo   python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
echo   pip install -r requirements.txt
echo   deactivate
echo.
echo Type 'deactivate' to exit the virtual environment.
echo ========================================
echo.

cmd /k
