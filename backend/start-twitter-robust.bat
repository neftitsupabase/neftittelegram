@echo off
title NEFTIT Twitter Service - Robust & Perfect Detection
color 0B
echo.
echo ========================================
echo 🚀 NEFTIT TWITTER VERIFICATION SERVICE
echo ========================================
echo 🔧 Robust Edition with Perfect Detection
echo 🎯 Retweet + X Post Detection
echo ========================================
echo.

REM Check Node.js installation
echo 🔍 Checking Node.js installation...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ ERROR: Node.js is not installed or not in PATH
    echo 💡 Please install Node.js from: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo ✅ Node.js found: 
node --version
echo.

REM Check .env file
echo 🔍 Checking environment configuration...
if not exist "..\.env" (
    echo ❌ ERROR: .env file not found in parent directory
    echo 💡 Please create .env file with Discord bot token
    echo.
    pause
    exit /b 1
)

echo ✅ .env file found
echo.

REM Install dependencies if needed
echo 🔍 Checking dependencies...
if not exist "node_modules" (
    echo 📦 Installing dependencies...
    npm install
    if %errorlevel% neq 0 (
        echo ❌ ERROR: Failed to install dependencies
        echo 💡 Please run: npm install
        echo.
        pause
        exit /b 1
    )
    echo ✅ Dependencies installed successfully
) else (
    echo ✅ Dependencies already installed
)
echo.

REM Configuration info
echo 🔧 Service Configuration:
echo    📍 Port: 3002
echo    🔄 Auto-restart: Enabled
echo    📊 Health monitoring: Enabled  
echo    🐦 Retweet Target: https://x.com/neftitxyz/status/1937138311593656686
echo    🔑 Keywords: join neftit, neftit, NEFTIT
echo    💾 Caching: 10 minutes
echo    🛡️ Anti-detection: Advanced
echo.

REM Show available endpoints
echo 📋 Available Endpoints:
echo    POST /verify-retweet
echo    POST /verify-tweet
echo    POST /verify-twitter-batch
echo    GET  /health
echo    POST /clear-cache
echo.

REM Start service with auto-restart loop
:start_service
echo ========================================
echo 🚀 Starting Twitter Verification Service
echo ========================================
echo 📅 Start Time: %date% %time%
echo 📍 Service URL: http://localhost:3002
echo 🔍 Health Check: http://localhost:3002/health
echo.
echo ℹ️  Press Ctrl+C to stop the service
echo 🔄 Service will auto-restart if it crashes
echo ========================================
echo.

REM Start the robust service
node twitter-verification-service-robust.js

REM If we get here, the service stopped
echo.
echo ⚠️  Twitter service stopped unexpectedly!
echo 📊 Exit Code: %errorlevel%
echo 📅 Stop Time: %date% %time%
echo.

REM Check if it was intentional (Ctrl+C gives exit code 3221225786)
if %errorlevel%==3221225786 (
    echo ✅ Service stopped by user (Ctrl+C)
    echo 👋 Goodbye!
    goto end
)

REM Auto-restart for crashes
echo 🔄 Auto-restart in 5 seconds...
echo 💡 Press Ctrl+C now to prevent restart
echo.
timeout /t 5 /nobreak >nul

echo 🔄 Restarting Twitter service...
echo.
goto start_service

:end
echo.
echo ========================================
echo 👋 Twitter Service Shutdown Complete
echo ========================================
pause

