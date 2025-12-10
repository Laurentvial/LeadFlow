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
websocket_router = AuthMiddlewareStack(
    URLRouter(
        routing.websocket_urlpatterns
    )
)

# WebSocket origin validation
# We need to allow localhost origins for local frontend development connecting to production backend
# If ALLOWED_HOSTS contains '*', skip origin validation (allow all)
# Otherwise, use AllowedHostsOriginValidator which validates against ALLOWED_HOSTS

# Define custom validator class at module level (not inside if block)
class CustomOriginValidator(AllowedHostsOriginValidator):
    """Custom origin validator that allows localhost in addition to ALLOWED_HOSTS"""
    def __init__(self, application):
        # Call parent __init__ - AllowedHostsOriginValidator reads from settings.ALLOWED_HOSTS
        super().__init__(application)
    
    def validate_origin(self, parsed_origin):
        # Always allow localhost origins (for local development)
        if parsed_origin.hostname in ['localhost', '127.0.0.1']:
            return True
        # Use parent validation for other origins
        return super().validate_origin(parsed_origin)

# Check if ALLOWED_HOSTS contains '*' - if so, skip origin validation
if settings.ALLOWED_HOSTS and '*' in settings.ALLOWED_HOSTS:
    # Allow all origins when ALLOWED_HOSTS contains '*'
    # Don't wrap with origin validator - websocket_router will accept all origins
    pass
else:
    # Use custom validator which validates against ALLOWED_HOSTS and allows localhost
    websocket_router = CustomOriginValidator(websocket_router)

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": websocket_router,
})
