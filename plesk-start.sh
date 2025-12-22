#!/bin/bash
# Startup script for LeadFlow on Plesk
# This script starts the Django ASGI application using Daphne

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR/backend"

# Set Python path
export PYTHONPATH="$SCRIPT_DIR/backend:$PYTHONPATH"

# Activate virtual environment if it exists
if [ -f "../env/bin/activate" ]; then
    source ../env/bin/activate
fi

# Set Django settings module
export DJANGO_SETTINGS_MODULE=backend.settings

# Get port from environment variable or use default
PORT=${PORT:-8000}

# Start Daphne ASGI server
exec daphne -b 127.0.0.1 -p "$PORT" backend.asgi:application

