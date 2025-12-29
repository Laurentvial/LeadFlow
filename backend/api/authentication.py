"""
Custom JWT Authentication with database connection cleanup.
This ensures connections are closed after authentication queries.
"""
from rest_framework_simplejwt.authentication import JWTAuthentication
from django.db import close_old_connections


class ConnectionCleanupJWTAuthentication(JWTAuthentication):
    """
    JWT Authentication that closes database connections after authentication.
    This prevents connection exhaustion in ASGI/Daphne servers.
    """
    
    def authenticate(self, request):
        """
        Authenticate the request and close connections after database queries.
        """
        # Close old connections before authentication
        close_old_connections()
        
        try:
            # Perform authentication (this may query the database)
            result = super().authenticate(request)
            
            # Close connections after authentication query
            close_old_connections()
            
            return result
        except Exception as e:
            # Close connections even on authentication error
            close_old_connections()
            raise

