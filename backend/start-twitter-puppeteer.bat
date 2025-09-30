@echo off
echo Starting Twitter Puppeteer Verification Service...
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if package.json exists
if not exist "twitter-puppeteer-package.json" (
    echo ERROR: twitter-puppeteer-package.json not found
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
echo Starting service on port 3003...
echo Service will be available at: http://localhost:3003
echo.
echo Available endpoints:
echo   POST /verify-retweet
echo   POST /verify-tweet  
echo   POST /verify-follow
echo   GET  /health
echo   POST /reset-browser
echo.
echo Press Ctrl+C to stop the service
echo.

REM Start the service
npm start

pause
