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
# If ALLOWED_HOSTS contains '*', allow all origins
if settings.ALLOWED_HOSTS and '*' not in settings.ALLOWED_HOSTS:
    # Create a custom validator that allows localhost and production domains
    from channels.security.websocket import OriginValidator
    
    def allowed_origin(scope):
        # Get origin from headers
        headers = dict(scope.get('headers', []))
        origin_bytes = headers.get(b'origin', b'')
        if not origin_bytes:
            return True  # Allow if no origin header
        
        origin = origin_bytes.decode('utf-8')
        
        # Extract hostname from origin URL (e.g., "http://localhost:3000" -> "localhost")
        try:
            from urllib.parse import urlparse
            parsed = urlparse(origin)
            origin_host = parsed.hostname
            origin_port = parsed.port
            
            # Allow localhost origins (for local development) - any port
            # This covers: localhost, localhost:3000, localhost:5173, 127.0.0.1, etc.
            if origin_host in ['localhost', '127.0.0.1']:
                return True
            
            # Allow origins matching ALLOWED_HOSTS
            for allowed_host in settings.ALLOWED_HOSTS:
                if allowed_host == '*' or origin_host == allowed_host:
                    return True
                # Also check if origin_host ends with allowed_host (for subdomains)
                if origin_host.endswith('.' + allowed_host):
                    return True
            
            return False
        except Exception as e:
            # If we can't parse origin, allow it (fail open for WebSocket)
            # Log the error for debugging
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Error parsing WebSocket origin '{origin}': {e}")
            return True
    
    # Use custom origin validator
    websocket_router = OriginValidator(websocket_router, allowed_origin)

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": websocket_router,
})
