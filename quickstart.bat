@echo off
REM CollabCode Quick Start Script for Windows

echo.
echo 🚀 CollabCode Quick Start
echo ========================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Node.js is not installed. Please install Node.js 16+
    exit /b 1
)

echo ✓ Node.js found
for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo   Version: %NODE_VERSION%

REM Check if Docker is installed
where docker >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Docker is not installed. Please install Docker
    exit /b 1
)

echo ✓ Docker found

REM Check if Docker Compose is installed
where docker-compose >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Docker Compose is not installed. Please install Docker Compose
    exit /b 1
)

echo ✓ Docker Compose found

REM Step 1: Install dependencies
echo.
echo 📦 Installing dependencies...
call npm install

if %ERRORLEVEL% NEQ 0 (
    echo ❌ Failed to install dependencies
    exit /b 1
)

echo ✓ Dependencies installed

REM Step 2: Create .env if it doesn't exist
if not exist ".env" (
    echo.
    echo ⚙️  Creating .env file...
    copy .env.example .env
    echo ✓ .env file created (update with your settings)
)

REM Step 3: Start Docker services
echo.
echo 🐳 Starting Docker services...
call docker-compose up -d

if %ERRORLEVEL% NEQ 0 (
    echo ❌ Failed to start Docker services
    exit /b 1
)

echo ✓ Docker services started

REM Step 4: Show startup instructions
echo.
echo ✅ CollabCode is ready to start!
echo.
echo Next steps:
echo 1. Open PowerShell/Command Prompt Window 1:
echo    npm run dev --workspace=apps/server
echo.
echo 2. Open PowerShell/Command Prompt Window 2:
echo    npm start --workspace=apps/client
echo.
echo 3. Open your browser:
echo    http://localhost:3000
echo.
echo To stop all services:
echo    npm run docker:down
echo.
echo Happy coding! 🎉
echo.
pause
