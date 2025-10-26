@echo off
REM COM Service Startup Script for Windows

echo =========================================
echo COM Service Startup
echo =========================================

REM Change to COM directory
cd /d "%~dp0"

REM Check Python version
python --version
if %ERRORLEVEL% NEQ 0 (
    echo Error: Python not found
    exit /b 1
)

REM Check if virtual environment exists
if not exist "venv\" (
    echo.
    echo Virtual environment not found. Creating...
    python -m venv venv
    echo Virtual environment created
)

REM Activate virtual environment
echo.
echo Activating virtual environment...
call venv\Scripts\activate.bat

REM Install dependencies if needed
if not exist "venv\.installed" (
    echo.
    echo Installing dependencies...
    python -m pip install -q --upgrade pip
    pip install -q -r requirements.txt
    type nul > venv\.installed
    echo Dependencies installed
)

REM Create data directory if needed
if not exist "data\" mkdir data

REM Check if .env exists
if not exist ".env" (
    echo.
    echo Warning: .env file not found. Using defaults.
)

REM Start COM service
echo.
echo =========================================
echo Starting COM Service on port 8083...
echo =========================================
echo.

py -m api.main
