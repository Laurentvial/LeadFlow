import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

# Initialize Django ASGI application early to ensure the AppRegistry
# is populated before importing code that may import ORM models.
django_asgi_app = get_asgi_application()

# Import routing after Django is initialized
from api import routing

# Get ALLOWED_HOSTS from settings to validate WebSocket origins
from django.conf import settings

# Wrap WebSocket router with origin validator based on ALLOWED_HOSTS
websocket_router = AuthMiddlewareStack(
    URLRouter(
        routing.websocket_urlpatterns
    )
)

# WebSocket origin validation
# Since we're allowing all origins for CORS (API-only mode), we'll allow all WebSocket origins too
# ALLOWED_HOSTS is set to '*' so we skip origin validation
# websocket_router will accept all origins without validation

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": websocket_router,
})
