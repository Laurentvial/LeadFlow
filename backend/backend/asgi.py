import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from channels.security.websocket import AllowedHostsOriginValidator

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

# Initialize Django ASGI application early to ensure the AppRegistry
# is populated before importing code that may import ORM models.
django_asgi_app = get_asgi_application()

# Import routing after Django is initialized
from api import routing

# Get ALLOWED_HOSTS from settings to validate WebSocket origins
from django.conf import settings

# Wrap WebSocket router with origin validator based on ALLOWED_HOSTS
# If ALLOWED_HOSTS contains '*', allow all origins (for development/production flexibility)
websocket_router = AuthMiddlewareStack(
    URLRouter(
        routing.websocket_urlpatterns
    )
)

# Only use AllowedHostsOriginValidator if ALLOWED_HOSTS doesn't allow all hosts
# This allows WebSocket connections from any origin when ALLOWED_HOSTS=['*']
if settings.ALLOWED_HOSTS and '*' not in settings.ALLOWED_HOSTS:
    websocket_router = AllowedHostsOriginValidator(websocket_router)

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": websocket_router,
})
