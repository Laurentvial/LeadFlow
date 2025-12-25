#!/bin/bash
# Script to start backend on remote server
# This script should be run ON THE SERVER after SSH connection

PROJECT_PATH="/var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs"
BACKEND_DIR="$PROJECT_PATH/backend"

echo "Starting backend server..."
echo "Project path: $PROJECT_PATH"

# Navigate to backend directory
cd "$BACKEND_DIR" || {
    echo "Error: Cannot find backend directory at $BACKEND_DIR"
    echo "Checking current directory..."
    pwd
    ls -la
    exit 1
}

# Check Python version
echo "Checking Python..."
python3 --version || python --version

# Check if daphne is installed
echo "Checking daphne installation..."
python3 -m pip list | grep daphne || python -m pip list | grep daphne || {
    echo "Warning: daphne might not be installed"
    echo "Installing daphne..."
    python3 -m pip install daphne || python -m pip install daphne
}

# Check if backend is already running
if pgrep -f "daphne.*backend.asgi" > /dev/null; then
    echo "Backend is already running. Stopping existing instance..."
    pkill -f "daphne.*backend.asgi"
    sleep 2
fi

# Start backend with Daphne in background
echo "Starting Daphne server..."
nohup python3 -m daphne -b 0.0.0.0 -p 8000 backend.asgi:application > /tmp/daphne.log 2>&1 &

# Get PID
DAPHNE_PID=$!
echo "Backend started with PID: $DAPHNE_PID"

# Wait a moment for startup
sleep 3

# Check if it's running
if ps -p $DAPHNE_PID > /dev/null; then
    echo "✅ Backend is running successfully!"
    echo "PID: $DAPHNE_PID"
    echo "Log file: /tmp/daphne.log"
    echo ""
    echo "To view logs: tail -f /tmp/daphne.log"
    echo "To stop backend: kill $DAPHNE_PID"
    echo ""
    echo "Recent logs:"
    tail -n 20 /tmp/daphne.log
else
    echo "❌ Backend failed to start. Check logs:"
    cat /tmp/daphne.log
    exit 1
fi

