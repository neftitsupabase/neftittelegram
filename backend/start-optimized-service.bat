@echo off
echo Starting OPTIMIZED Twitter Puppeteer Service (LOW EGRESS)...
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if optimized service file exists
if not exist "twitter-puppeteer-service-optimized.js" (
    echo ERROR: twitter-puppeteer-service-optimized.js not found
    echo Please make sure you're in the correct directory
    pause
    exit /b 1
)

REM Install dependencies if node_modules doesn't exist
if not exist "node_modules" (
    echo Installing dependencies...
    npm install
    if %errorlevel% neq 0 (
        echo ERROR: Failed to install dependencies
        pause
        exit /b 1
    )
)

echo.
echo Starting OPTIMIZED service on port 3003...
echo Service will be available at: http://localhost:3003
echo.
echo 🚀 OPTIMIZED FOR LOW EGRESS:
echo   - 70-80% reduction in data usage
echo   - Smart caching system
echo   - Blocked unnecessary resources
echo   - Faster response times
echo.
echo Available endpoints:
echo   POST /verify-retweet
echo   POST /verify-tweet  
echo   POST /verify-follow
echo   GET  /health
echo   POST /reset-browser
echo   POST /clear-cache
echo.
echo Press Ctrl+C to stop the service
echo.

REM Start the optimized service
node twitter-puppeteer-service-optimized.js

pause
