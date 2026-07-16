@echo off
echo ===================================================
echo Starting Railway Defect Web Application (Local SQLite DB)
echo ===================================================

echo Starting Backend Server...
start "Railway Backend" cmd /k "cd backend && call .\venv\Scripts\activate && uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

echo Starting Frontend Server...
start "Railway Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ===================================================
echo BOTH SERVERS ARE STARTING!
echo Frontend: http://localhost:5173
echo Backend API: http://localhost:8000
echo.
echo LOGIN CREDENTIALS:
echo Username: admin
echo Password: admin123
echo ===================================================
pause
