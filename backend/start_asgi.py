#!/usr/bin/env python
"""
Script to start Django with ASGI support for WebSockets
Usage: python start_asgi.py
"""
import os
import sys
import django
from django.core.management import execute_from_command_line

if __name__ == '__main__':
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
    django.setup()
    
    # Try to use daphne if available, otherwise use uvicorn
    try:
        import daphne
        print("Starting server with Daphne (ASGI)...")
        os.system('daphne -b 0.0.0.0 -p 8000 backend.asgi:application')
    except ImportError:
        try:
            import uvicorn
            print("Starting server with Uvicorn (ASGI)...")
            os.system('uvicorn backend.asgi:application --host 0.0.0.0 --port 8000')
        except ImportError:
            print("ERROR: Neither daphne nor uvicorn is installed!")
            print("Install one of them:")
            print("  pip install daphne")
            print("  or")
            print("  pip install uvicorn")
            sys.exit(1)

