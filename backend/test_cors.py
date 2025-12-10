"""
Test script to verify CORS configuration on Heroku.
Run this on Heroku to check CORS settings.
"""
import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.conf import settings
import corsheaders

print("=" * 60)
print("CORS Configuration Check")
print("=" * 60)
print(f"\ndjango-cors-headers version: {corsheaders.__version__}")
print(f"\nCORS_ALLOW_ALL_ORIGINS: {getattr(settings, 'CORS_ALLOW_ALL_ORIGINS', 'NOT SET')}")
print(f"CORS_ALLOWED_ORIGINS: {getattr(settings, 'CORS_ALLOWED_ORIGINS', 'NOT SET')}")
print(f"CORS_ALLOW_CREDENTIALS: {getattr(settings, 'CORS_ALLOW_CREDENTIALS', 'NOT SET')}")
print(f"CORS_ALLOW_METHODS: {getattr(settings, 'CORS_ALLOW_METHODS', 'NOT SET')}")
print(f"CORS_URLS_REGEX: {getattr(settings, 'CORS_URLS_REGEX', 'NOT SET')}")
print(f"\nEnvironment variable CORS_ALLOWED_ORIGINS: {os.getenv('CORS_ALLOWED_ORIGINS', 'NOT SET')}")
print("\n" + "=" * 60)

