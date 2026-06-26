@echo off
echo ==========================================
echo   Viral Clipper - Starting...
echo ==========================================
echo.

cd /d "%~dp0"

:: Kill any process on ports 8000 and 5173 (handles IPv4 and IPv6)
echo Stopping existing servers...
powershell -Command "Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"
powershell -Command "Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"
ping -n 3 127.0.0.1 >nul

:: Create storage directories
if not exist "storage\uploads" mkdir "storage\uploads"
if not exist "storage\outputs" mkdir "storage\outputs"
if not exist "storage\templates" mkdir "storage\templates"
if not exist "storage\temp" mkdir "storage\temp"
if not exist "storage\segments" mkdir "storage\segments"

:: Install dependencies if needed
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
)

echo.
echo Starting backend on port 8000...
start "VC-Backend" /min cmd /k "cd /d %~dp0 && npx tsx packages/server/src/index.ts"

ping -n 5 127.0.0.1 >nul

echo Starting frontend on port 5173...
start "VC-Frontend" /min cmd /k "cd /d %~dp0packages\frontend && npx vite"

ping -n 6 127.0.0.1 >nul

start http://localhost:5173

echo.
echo ==========================================
echo   Viral Clipper is running!
echo   Frontend: http://localhost:5173
echo   Backend:  http://localhost:8000
echo.
echo   Press any key to stop both servers.
echo ==========================================
pause >nul

powershell -Command "Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"
powershell -Command "Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"
echo Stopped.
