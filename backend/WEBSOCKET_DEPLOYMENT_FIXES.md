# WebSocket Deployment Issues - Common Fixes

## Quick Diagnostic

**Important:** First commit and push the diagnostic script to Heroku:

```bash
git add backend/check_websocket_deployment.py
git commit -m "Add WebSocket diagnostic script"
git push heroku main
```

Then run this command on Heroku to diagnose WebSocket issues:

```bash
heroku run python backend/check_websocket_deployment.py -a leadflow-backend-eu
```

Or run locally:

```bash
python backend/check_websocket_deployment.py
```

## Common Issues and Fixes

### 1. ❌ Redis Not Configured

**Symptoms:**
- WebSocket connections fail immediately
- Logs show: `No channel_layer available`
- Channel layer errors in Heroku logs

**Fix:**
```bash
# Add Redis addon to Heroku
heroku addons:create heroku-redis:mini -a leadflow-backend-eu

# Or for production (paid):
heroku addons:create heroku-redis:premium-0 -a leadflow-backend-eu

# Verify REDIS_URL is set
heroku config:get REDIS_URL -a leadflow-backend-eu
```

**Expected:** `REDIS_URL` should start with `rediss://` (SSL) or `redis://`

### 2. ❌ Procfile Uses Gunicorn Instead of Daphne

**Symptoms:**
- WebSocket connections return 404 or 500
- Logs show gunicorn starting instead of daphne
- WebSocket upgrade requests fail

**Fix:**
Ensure root `Procfile` contains:
```
web: cd backend && daphne -b 0.0.0.0 -p $PORT backend.asgi:application
```

**NOT:**
```
web: gunicorn backend.wsgi --log-file -
```

Then redeploy:
```bash
git add Procfile
git commit -m "Fix Procfile for WebSocket support"
git push heroku main
```

### 3. ❌ ALLOWED_HOSTS Not Set

**Symptoms:**
- WebSocket connections rejected
- 400 Bad Request errors
- Origin validation failures

**Fix:**
```bash
# Set ALLOWED_HOSTS on Heroku
heroku config:set ALLOWED_HOSTS=leadflow-backend-eu-8d20fb5efc7b.herokuapp.com -a leadflow-backend-eu

# Or allow all hosts (less secure, but works):
heroku config:set ALLOWED_HOSTS=* -a leadflow-backend-eu
```

### 4. ❌ Frontend VITE_URL Not Set

**Symptoms:**
- Frontend tries to connect to wrong URL
- WebSocket connections to localhost instead of Heroku
- CORS errors

**Fix:**
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add/Update:
   - **Name:** `VITE_URL`
   - **Value:** `https://leadflow-backend-eu-8d20fb5efc7b.herokuapp.com`
   - **Environments:** ✅ Production, ✅ Preview, ✅ Development
3. **Redeploy** frontend (Vercel will auto-deploy or trigger manually)

### 5. ❌ WebSocket Origin Validation Too Strict

**Symptoms:**
- WebSocket connections fail with origin errors
- Works locally but not in production

**Fix:**
The ASGI configuration has been updated to properly handle WebSocket origins:
- If `ALLOWED_HOSTS` contains `'*'`, all origins are allowed
- Otherwise, `AllowedHostsOriginValidator` validates origins

Make sure `ALLOWED_HOSTS` includes your frontend domain or use `'*'`:
```bash
heroku config:set ALLOWED_HOSTS=* -a leadflow-backend-eu
```

### 6. ❌ Channels Not in INSTALLED_APPS

**Symptoms:**
- Import errors
- Channel layer not available
- ASGI application errors

**Fix:**
Verify `backend/backend/settings.py` includes:
```python
INSTALLED_APPS = [
    # ... other apps
    'channels',
]
```

### 7. ❌ ASGI_APPLICATION Not Set

**Symptoms:**
- WebSocket routing doesn't work
- ASGI server can't find application

**Fix:**
Verify `backend/backend/settings.py` includes:
```python
ASGI_APPLICATION = 'backend.asgi.application'
```

## Step-by-Step Deployment Checklist

### Backend (Heroku)

- [ ] Redis addon added: `heroku addons:create heroku-redis:mini -a leadflow-backend-eu`
- [ ] `REDIS_URL` is set (automatically set by Redis addon)
- [ ] Root `Procfile` uses `daphne` (not `gunicorn`)
- [ ] `ALLOWED_HOSTS` includes your Heroku domain
- [ ] `ASGI_APPLICATION = 'backend.asgi.application'` in settings.py
- [ ] `channels` is in `INSTALLED_APPS`
- [ ] Dependencies installed: `channels`, `channels-redis`, `redis`, `daphne`
- [ ] Backend deployed: `git push heroku main`
- [ ] Run diagnostic: `heroku run python backend/check_websocket_deployment.py -a leadflow-backend-eu`

### Frontend (Vercel)

- [ ] `VITE_URL` environment variable set to `https://your-backend.herokuapp.com`
- [ ] Environment variable set for Production environment
- [ ] Frontend redeployed after setting environment variable
- [ ] Browser console shows WebSocket connection successful
- [ ] Network tab shows WebSocket connection with status 101

## Testing WebSocket Connection

### In Browser Console (Production Site)

```javascript
// Get your token from localStorage
const token = localStorage.getItem('access_token');

// Test WebSocket connection
const ws = new WebSocket(`wss://leadflow-backend-eu-8d20fb5efc7b.herokuapp.com/ws/notifications/?token=${token}`);

ws.onopen = () => console.log('✅ WebSocket connected');
ws.onmessage = (event) => console.log('📨 Message received:', JSON.parse(event.data));
ws.onerror = (error) => console.error('❌ WebSocket error:', error);
ws.onclose = (event) => console.log('🔌 WebSocket closed:', event.code, event.reason);

// Check connection status after 2 seconds
setTimeout(() => {
  console.log('WebSocket state:', ws.readyState); // 1 = OPEN
}, 2000);
```

### Check Heroku Logs

```bash
# Watch logs in real-time
heroku logs --tail -a leadflow-backend-eu

# Filter for WebSocket activity
heroku logs --tail -a leadflow-backend-eu | Select-String -Pattern "websocket" -CaseSensitive:$false

# Filter for notification activity
heroku logs --tail -a leadflow-backend-eu | Select-String -Pattern "notification" -CaseSensitive:$false

# Filter for Redis/channel errors
heroku logs --tail -a leadflow-backend-eu | Select-String -Pattern "redis|channel" -CaseSensitive:$false
```

**Look for:**
- ✅ `Starting server at tcp:port:XXXXX:interface=0.0.0.0` (Daphne starting)
- ✅ `[NotificationConsumer] Connection accepted`
- ✅ `[send_notification_via_websocket] Sent notification`
- ❌ `No channel_layer available` → Redis not configured
- ❌ `Error sending notification` → Check error details

## Recent Fixes Applied

1. **ASGI Configuration Updated** (`backend/backend/asgi.py`):
   - Properly handles WebSocket origin validation
   - Allows all origins when `ALLOWED_HOSTS=['*']`
   - Uses `AllowedHostsOriginValidator` when hosts are restricted

2. **Diagnostic Script Created** (`backend/check_websocket_deployment.py`):
   - Checks Redis configuration
   - Tests channel layer connection
   - Verifies ASGI configuration
   - Validates installed apps
   - Checks ALLOWED_HOSTS
   - Verifies Procfile

## Next Steps

1. **Run the diagnostic script:**
   ```bash
   heroku run python backend/check_websocket_deployment.py -a leadflow-backend-eu
   ```

2. **Check the results** and fix any issues found

3. **Redeploy backend** if you made changes:
   ```bash
   git add backend/
   git commit -m "Fix WebSocket deployment configuration"
   git push heroku main
   ```

4. **Test WebSocket connection** in browser console (see above)

5. **Check Heroku logs** for WebSocket activity

6. **Test real-time notifications** by creating a notification in one tab and watching it appear in another tab

## Still Not Working?

1. Check browser console for WebSocket errors
2. Check Heroku logs for backend errors
3. Verify Redis addon is active: `heroku addons -a leadflow-backend-eu`
4. Verify REDIS_URL is set: `heroku config:get REDIS_URL -a leadflow-backend-eu`
5. Test WebSocket connection manually (see above)
6. Check frontend VITE_URL is set correctly in Vercel
7. Ensure frontend is redeployed after setting VITE_URL

## Architecture Overview

```
Frontend (Vercel)
  ↓ (wss://)
Heroku Backend (Daphne ASGI Server)
  ↓
Django Channels
  ↓
Redis (Heroku Redis Addon)
  ↓
WebSocket Consumers (NotificationConsumer, ChatConsumer)
```

All components must be properly configured for WebSockets to work!

