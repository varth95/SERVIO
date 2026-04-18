@echo off
echo ==========================================
echo   Servio - Starting up...
echo ==========================================

REM Create upload directories
if not exist "foodbridge\uploads\certificates" mkdir "foodbridge\uploads\certificates"
if not exist "foodbridge\uploads\food" mkdir "foodbridge\uploads\food"
if not exist "foodbridge\uploads\verification" mkdir "foodbridge\uploads\verification"

echo Installing dependencies...
pip install -r foodbridge\requirements.txt

echo.
echo Starting Flask server on http://localhost:5000
echo Press Ctrl+C to stop.
echo.

python foodbridge\app.py
pause
