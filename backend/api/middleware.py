"""
Custom CORS middleware to ensure CORS headers are always set for API requests.
This is a fallback in case django-cors-headers isn't working properly.
"""
import logging
from django.http import HttpResponse

logger = logging.getLogger(__name__)


class ExplicitCorsMiddleware:
    """
    Explicitly add CORS headers to all API responses.
    This ensures CORS works even if django-cors-headers has issues.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Handle preflight OPTIONS requests
        if request.method == 'OPTIONS':
            logger.info(f"[CORS] Handling OPTIONS preflight for {request.path} from origin {request.META.get('HTTP_ORIGIN', 'unknown')}")
            response = HttpResponse()
            response['Access-Control-Allow-Origin'] = '*'
            response['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS, PATCH'
            response['Access-Control-Allow-Headers'] = 'accept, accept-encoding, authorization, content-type, dnt, origin, user-agent, x-csrftoken, x-requested-with'
            response['Access-Control-Allow-Credentials'] = 'true'
            response['Access-Control-Max-Age'] = '86400'
            return response

        # Process the request
        response = self.get_response(request)

        # Add CORS headers to all API responses
        if request.path.startswith('/api/'):
            origin = request.META.get('HTTP_ORIGIN', 'unknown')
            logger.info(f"[CORS] Adding CORS headers to {request.method} {request.path} from origin {origin}")
            response['Access-Control-Allow-Origin'] = '*'
            response['Access-Control-Allow-Credentials'] = 'true'
            response['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS, PATCH'
            response['Access-Control-Allow-Headers'] = 'accept, accept-encoding, authorization, content-type, dnt, origin, user-agent, x-csrftoken, x-requested-with'

        return response

