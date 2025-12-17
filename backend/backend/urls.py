from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from django.conf.urls.static import static
from api.views import UserCreateView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

def health_check(request):
    """Health check endpoint for Choreo to verify the service is running."""
    return JsonResponse({"status": "healthy", "service": "backend"})

@csrf_exempt
def cors_test(request):
    """Test endpoint to verify CORS is working."""
    return JsonResponse({
        "status": "CORS test successful",
        "origin": request.META.get('HTTP_ORIGIN', 'No origin header'),
        "method": request.method
    })

urlpatterns = [
    path('health/', health_check, name='health_check'),
    path('cors-test/', cors_test, name='cors_test'),
    path('admin/', admin.site.urls),
    path('api/token/', TokenObtainPairView.as_view(), name='get_token'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='refresh'),
    path("api-auth/", include('rest_framework.urls')),
    path('api/', include('api.urls')),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
