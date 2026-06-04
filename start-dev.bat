@echo off
cd /d "%~dp0"
echo ============================================
echo   Sianmaker dev servers
echo ============================================
echo.
echo [1/2] Backend  (Flask :5000)
start "sianmaker-backend" cmd /k "python server.py"
echo [2/2] Frontend (live-server :3000)
start "sianmaker-frontend" cmd /k "npx live-server . --port=3000 --no-browser --quiet"
echo.
echo Opening browser in 4 seconds...
timeout /t 4 >nul
start "" "http://localhost:3000/step1-form.html"
echo.
echo The two black windows ARE the servers - do NOT close them.
echo Close those windows to stop the servers.
echo You can close THIS window now.
pause
