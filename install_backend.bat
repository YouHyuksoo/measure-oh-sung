@echo off
echo Installing Python Backend Dependencies...
cd backend
python -m venv venv --upgrade-deps
call venv\Scripts\activate.bat
python -m pip install --upgrade pip
python -m pip install fastapi uvicorn pydantic pydantic-settings
echo.
echo Backend dependencies installed successfully!
echo Run 'start_backend.bat' to start the server.
pause
