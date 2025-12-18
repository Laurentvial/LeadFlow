"""
Custom CORS middleware to ensure CORS headers are always set for API requests.
This is a fallback in case django-cors-headers isn't working properly.
Async-compatible for Daphne/ASGI servers.
"""
import logging
import asyncio
from django.http import HttpResponse
from django.db import close_old_connections
from asgiref.sync import iscoroutinefunction

logger = logging.getLogger(__name__)


def _add_cors_headers(response, request):
    """Helper function to add CORS headers to a response."""
    if request.path.startswith('/api/'):
        origin = request.META.get('HTTP_ORIGIN')
        logger.debug(f"[CORS] Adding CORS headers to {request.method} {request.path} from origin {origin or 'unknown'}")
        # When credentials are allowed, we must echo back the origin instead of using '*'
        # This matches django-cors-headers behavior when CORS_ALLOW_ALL_ORIGINS=True and CORS_ALLOW_CREDENTIALS=True
        if origin:
            response['Access-Control-Allow-Origin'] = origin
        else:
            # Fallback to '*' only if no origin header (shouldn't happen in normal CORS requests)
            response['Access-Control-Allow-Origin'] = '*'
        response['Access-Control-Allow-Credentials'] = 'true'
        response['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS, PATCH'
        response['Access-Control-Allow-Headers'] = 'accept, accept-encoding, authorization, content-type, dnt, origin, user-agent, x-csrftoken, x-requested-with'


def _create_preflight_response(request):
    """Helper function to create preflight OPTIONS response."""
    origin = request.META.get('HTTP_ORIGIN')
    logger.debug(f"[CORS] Handling OPTIONS preflight for {request.path} from origin {origin or 'unknown'}")
    response = HttpResponse()
    # When credentials are allowed, we must echo back the origin instead of using '*'
    if origin:
        response['Access-Control-Allow-Origin'] = origin
    else:
        # Fallback to '*' only if no origin header (shouldn't happen in normal CORS requests)
        response['Access-Control-Allow-Origin'] = '*'
    response['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS, PATCH'
    response['Access-Control-Allow-Headers'] = 'accept, accept-encoding, authorization, content-type, dnt, origin, user-agent, x-csrftoken, x-requested-with'
    response['Access-Control-Allow-Credentials'] = 'true'
    response['Access-Control-Max-Age'] = '86400'
    return response


class ExplicitCorsMiddleware:
    """
    Explicitly add CORS headers to all API responses.
    This ensures CORS works even if django-cors-headers has issues.
    Supports both sync and async request handling for Daphne compatibility.
    """
    def __init__(self, get_response):
        self.get_response = get_response
        # Check if get_response is async
        self._is_async = iscoroutinefunction(get_response)

    def __call__(self, request):
        # Handle preflight OPTIONS requests
        if request.method == 'OPTIONS':
            return _create_preflight_response(request)

        # Process the request - handle both sync and async
        if self._is_async:
            return self._async_call(request)
        else:
            response = self.get_response(request)
            _add_cors_headers(response, request)
            return response

    async def _async_call(self, request):
        """Handle async request processing with proper cancellation handling."""
        try:
            # Handle preflight OPTIONS requests
            if request.method == 'OPTIONS':
                return _create_preflight_response(request)

            # Process the request
            response = await self.get_response(request)
            
            # Add CORS headers to all API responses
            # Header operations are fast and don't need async conversion
            _add_cors_headers(response, request)
            
            return response
        except asyncio.CancelledError:
            # Request was cancelled (e.g., client disconnected)
            # Log but don't raise to prevent error spam
            logger.debug(f"[CORS] Request cancelled for {getattr(request, 'path', 'unknown')}")
            # Return a minimal response
            try:
                response = HttpResponse(status=499)  # Client Closed Request
                _add_cors_headers(response, request)
                return response
            except Exception:
                # If we can't create a response, return None
                # Django will handle this gracefully
                return None
        except Exception as e:
            # Re-raise other exceptions
            raise


class DatabaseConnectionCleanupMiddleware:
    """
    Middleware to close old database connections after each request.
    This helps prevent connection exhaustion in ASGI/Daphne servers where
    connections can accumulate across async requests.
    
    This middleware aggressively closes connections to prevent pool exhaustion.
    """
    def __init__(self, get_response):
        self.get_response = get_response
        self._is_async = iscoroutinefunction(get_response)

    def __call__(self, request):
        # Close old connections before processing request
        close_old_connections()
        
        # Handle both sync and async requests
        if self._is_async:
            return self._async_call(request)
        else:
            try:
                response = self.get_response(request)
                return response
            finally:
                # Aggressively close all connections after sync request
                close_old_connections()
                # Also close connections for all databases
                from django.db import connections
                for conn in connections.all():
                    conn.close()

    async def _async_call(self, request):
        """Handle async request processing."""
        try:
            response = await self.get_response(request)
            return response
        finally:
            # Aggressively close all connections after async request
            close_old_connections()
            # Also close connections for all databases
            from django.db import connections
            for conn in connections.all():
                conn.close()

