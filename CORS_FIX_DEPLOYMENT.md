# CORS Fix Deployment Guide

## Issue
CORS errors when accessing Heroku backend from Vercel frontend (`https://lead-flow-orpin.vercel.app`) or localhost (`http://localhost:3000`):
```
Access to fetch at 'https://leadflow-backend-eu-8d20fb5efc7b.herokuapp.com/api/token/' 
from origin 'https://lead-flow-orpin.vercel.app' has been blocked by CORS policy: 
Response to preflight request doesn't pass access control check: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

## Root Cause
The backend CORS configuration needs to be updated to always allow the Vercel frontend domain (`https://lead-flow-orpin.vercel.app`) and localhost origins, even when `CORS_ALLOWED_ORIGINS` environment variable is set on Heroku.

## Changes Made
1. ✅ Updated `backend/backend/settings.py` to always include Vercel domain (`https://lead-flow-orpin.vercel.app`) and localhost origins
2. ✅ Updated `CSRF_TRUSTED_ORIGINS` to include Vercel domain
3. ✅ Added production logging for CORS configuration to help troubleshoot issues
4. ✅ Updated `backend/backend/asgi.py` to fix WebSocket origin validation (if needed)

## Deployment Steps

### Step 1: Commit Changes
```powershell
git add backend/backend/settings.py
git commit -m "Fix CORS: Add Vercel frontend domain to allowed origins"
```

### Step 2: Deploy to Heroku
```powershell
git push heroku main
```

### Step 3: Verify CORS Configuration on Heroku
After deployment, check if `CORS_ALLOWED_ORIGINS` is set:
```powershell
heroku config:get CORS_ALLOWED_ORIGINS -a leadflow-backend-eu
```

**If it's set:**
- The fix will automatically add the Vercel domain (`https://lead-flow-orpin.vercel.app`) and localhost origins
- Check logs to verify: `heroku logs --tail -a leadflow-backend-eu | Select-String -Pattern "CORS"`
- Or you can unset it to allow all origins:
  ```powershell
  heroku config:unset CORS_ALLOWED_ORIGINS -a leadflow-backend-eu
  heroku restart -a leadflow-backend-eu
  ```

**If it's not set:**
- CORS will allow all origins by default (including Vercel and localhost)
- No action needed

### Step 4: Restart Heroku Dynos
```powershell
heroku restart -a leadflow-backend-eu
```

### Step 5: Test
1. Open your frontend at `https://lead-flow-orpin.vercel.app` (production) or `http://localhost:3000` (local)
2. Try to login - the POST request to `/api/token/` should succeed
3. Check browser console - CORS errors should be gone
4. Check Network tab - OPTIONS preflight requests should return 200 with CORS headers
5. Verify CORS headers in response:
   - `Access-Control-Allow-Origin: https://lead-flow-orpin.vercel.app` (or `*` if allowing all)
   - `Access-Control-Allow-Credentials: true`

## Expected CORS Headers
After the fix, responses should include:
```
Access-Control-Allow-Origin: https://lead-flow-orpin.vercel.app
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS, PATCH
Access-Control-Allow-Headers: accept, authorization, content-type, ...
```

For preflight OPTIONS requests, you should see:
- Status: 200 OK
- All the CORS headers listed above

## Troubleshooting

### Still Getting CORS Errors?

1. **Check Heroku logs:**
   ```powershell
   heroku logs --tail -a leadflow-backend-eu | Select-String -Pattern "CORS" -CaseSensitive:$false
   ```

2. **Verify CORS middleware is first:**
   - Check `backend/backend/settings.py` line 60
   - Should be: `'corsheaders.middleware.CorsMiddleware',`

3. **Test CORS directly:**
   ```powershell
   # Test OPTIONS preflight for token endpoint
   Invoke-WebRequest -Uri "https://leadflow-backend-eu-8d20fb5efc7b.herokuapp.com/api/token/" -Method OPTIONS -Headers @{"Origin"="https://lead-flow-orpin.vercel.app"} -UseBasicParsing
   
   # Check response headers
   $response = Invoke-WebRequest -Uri "https://leadflow-backend-eu-8d20fb5efc7b.herokuapp.com/api/token/" -Method OPTIONS -Headers @{"Origin"="https://lead-flow-orpin.vercel.app"} -UseBasicParsing
   $response.Headers
   ```

4. **Check if django-cors-headers is installed:**
   ```powershell
   heroku run python -c "import corsheaders; print(corsheaders.__version__)" -a leadflow-backend-eu
   ```

## Quick Fix (Temporary)
If you need immediate access while deploying:

**Option 1: Unset CORS_ALLOWED_ORIGINS (allows all origins)**
```powershell
heroku config:unset CORS_ALLOWED_ORIGINS -a leadflow-backend-eu
heroku restart -a leadflow-backend-eu
```

**Option 2: Set CORS_ALLOWED_ORIGINS to include Vercel domain**
```powershell
heroku config:set CORS_ALLOWED_ORIGINS="https://lead-flow-orpin.vercel.app" -a leadflow-backend-eu
heroku restart -a leadflow-backend-eu
```

**Note:** The code fix will automatically add the Vercel domain even if `CORS_ALLOWED_ORIGINS` is set, so after deployment, Option 1 or 2 will work. Option 1 is simpler and more permissive.

