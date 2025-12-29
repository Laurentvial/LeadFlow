import os
from django.core.asgi import get_asgi_application
from django.db import close_old_connections
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


class DatabaseConnectionMiddleware:
    """
    ASGI middleware to close database connections after each HTTP request.
    This is critical for ASGI/Daphne servers to prevent connection exhaustion.
    """
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        # Close old connections before processing request
        close_old_connections()
        
        # Also explicitly close all connections
        from django.db import connections
        for conn in connections.all():
            try:
                if conn.connection is not None:
                    conn.close()
            except:
                pass
        
        try:
            # Process the request
            await self.app(scope, receive, send)
        finally:
            # Always close connections after request completes
            close_old_connections()
            
            # Explicitly close all connections
            for conn in connections.all():
                try:
                    if conn.connection is not None:
                        conn.close()
                except:
                    pass


# Wrap Django ASGI app with connection cleanup middleware
django_asgi_app = DatabaseConnectionMiddleware(django_asgi_app)

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
