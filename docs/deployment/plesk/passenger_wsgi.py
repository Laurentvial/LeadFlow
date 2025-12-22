"""
Passenger WSGI/ASGI entry point for Plesk deployment.
This file allows Plesk to run the Django application using Passenger.
"""

import os
import sys

# Add the backend directory to Python path
sys.path.insert(0, os.path.dirname(__file__))

# Change to backend directory
backend_dir = os.path.join(os.path.dirname(__file__), 'backend')
os.chdir(backend_dir)
sys.path.insert(0, backend_dir)

# Set Django settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

# For Passenger WSGI (if using WSGI mode)
try:
    from django.core.wsgi import get_wsgi_application
    application = get_wsgi_application()
except Exception as e:
    # If WSGI fails, Passenger might be trying to use ASGI
    # In that case, we'll handle it differently
    import logging
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger(__name__)
    logger.warning(f"WSGI application failed to load: {e}")
    logger.info("If you're using ASGI (Daphne), use the startup script instead")
    raise

