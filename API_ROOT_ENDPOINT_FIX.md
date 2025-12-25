# API Root Endpoint Fix

## Problem
Visiting `https://blissful-spence.82-165-44-164.plesk.page/api/` returned a 404 "Not Found" error, even though the backend was running correctly.

## Solution
Added an API root endpoint at `/api/` that returns a JSON response with API information.

## Changes Made

### 1. Added `api_root` view in `backend/api/views.py`
- Returns a JSON response with API status and available endpoints
- Uses `@api_view(['GET'])` and `@permission_classes([AllowAny])` decorators
- Accessible without authentication

### 2. Added route in `backend/api/urls.py`
- Added `path('', api_views.api_root, name='api-root')` as the first route
- This matches `/api/` exactly when no additional path is provided

## Deploy to Server

### Step 1: Upload Changes
The changes have been made to:
- `backend/api/views.py` (added `api_root` function)
- `backend/api/urls.py` (added root route)

You need to upload these files to your server or pull the latest code.

### Step 2: Restart Backend
After uploading the changes, restart the backend:

```bash
# SSH into server
ssh root@82.165.44.164

# Navigate to backend directory
cd /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs/backend
# OR if different path:
cd /var/www/django/LeadFlow/backend

# Stop existing backend
pkill -f "daphne.*backend.asgi"

# Start backend again
nohup python3 -m daphne -b 0.0.0.0 -p 8000 backend.asgi:application > /tmp/daphne.log 2>&1 &

# Verify it's running
ps aux | grep daphne | grep -v grep
tail -f /tmp/daphne.log
```

### Step 3: Test
Visit: `https://blissful-spence.82-165-44-164.plesk.page/api/`

You should now see:
```json
{
  "message": "LeadFlow API is running",
  "status": "ok",
  "version": "1.0",
  "endpoints": {
    "health": "/api/health/",
    "token": "/api/token/",
    "contacts": "/api/contacts/",
    ...
  }
}
```

## Alternative: Quick Test Without Restart

If you want to test without restarting, you can also test these endpoints:
- `/api/health/` - Should return `{"status": "healthy", "service": "backend"}`
- `/api/contacts/` - Should return contacts list (if authenticated) or 401
- `/api/token/` - Should return token endpoint (POST required)

## Frontend Configuration

The frontend should already be configured correctly. Make sure `VITE_URL` is set to:
```
VITE_URL=https://blissful-spence.82-165-44-164.plesk.page
```

**Important:** Do NOT include `/api/` in `VITE_URL` - the frontend code automatically appends it.

## Summary

✅ Added API root endpoint at `/api/`
✅ Returns helpful JSON with API status and available endpoints
✅ No authentication required (public endpoint)
✅ Ready to deploy to server

