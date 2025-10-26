#!/bin/bash
# COM Service Startup Script

set -e

echo "========================================="
echo "COM Service Startup"
echo "========================================="

# Change to COM directory
cd "$(dirname "$0")"

# Check Python version
PYTHON_VERSION=$(python --version 2>&1 | awk '{print $2}')
echo "Python version: $PYTHON_VERSION"

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo ""
    echo "Virtual environment not found. Creating..."
    python -m venv venv
    echo "✓ Virtual environment created"
fi

# Activate virtual environment
echo ""
echo "Activating virtual environment..."
source venv/bin/activate

# Install dependencies if needed
if [ ! -f "venv/.installed" ]; then
    echo ""
    echo "Installing dependencies..."
    pip install -q --upgrade pip
    pip install -q -r requirements.txt
    touch venv/.installed
    echo "✓ Dependencies installed"
fi

# Create data directory if needed
mkdir -p data

# Check if .env exists
if [ ! -f ".env" ]; then
    echo ""
    echo "⚠ Warning: .env file not found. Using defaults."
fi

# Start COM service
echo ""
echo "========================================="
echo "Starting COM Service on port 8083..."
echo "========================================="
echo ""

python -m api.main
