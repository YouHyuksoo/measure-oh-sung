@echo off
echo 🛡️ 타입 안전성 체크 시작...

echo.
echo 📋 Frontend TypeScript 타입 체크...
cd frontend
npx tsc --noEmit
if %errorlevel% neq 0 (
    echo ❌ Frontend 타입 오류 발견!
    exit /b 1
)
echo ✅ Frontend 타입 체크 통과!

echo.
echo 🐍 Backend Python 타입 체크...
cd ..\backend
python -m mypy app/ --config-file mypy.ini
if %errorlevel% neq 0 (
    echo ❌ Backend 타입 오류 발견!
    exit /b 1
)
echo ✅ Backend 타입 체크 통과!

echo.
echo 🎉 모든 타입 체크 통과! 타입 안전성 보장됨.
