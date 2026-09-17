@echo off
echo ========================================================
echo   LLM-Wiki Web & Claude Code CLI Integration Service
echo ========================================================
echo.
echo Starting Backend and Frontend services...
start "LLM-Wiki Backend" cmd /c ".\start-backend.bat"
timeout /t 2 /nobreak >nul
start "LLM-Wiki Frontend" cmd /c ".\start-frontend.bat"
echo.
echo [OK] Backend: http://127.0.0.1:8000
echo [OK] Frontend Web UI: http://localhost:3000
echo.
echo Press any key to exit this launcher window (services will stay running).
pause >nul
