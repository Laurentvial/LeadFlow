# WebSocket Troubleshooting Guide

## Quick Reference: Windows PowerShell Commands

**Note:** If you're on Windows PowerShell, use these alternatives instead of `grep`:

| Linux/Mac (bash) | Windows (PowerShell) |
|------------------|---------------------|
| `heroku logs \| grep -i notification` | `heroku logs \| Select-String -Pattern "notification" -CaseSensitive:$false` |
| `heroku logs \| grep -i websocket` | `heroku logs \| Select-String -Pattern "websocket" -CaseSensitive:$false` |
| `heroku logs \| grep -i redis` | `heroku logs \| Select-String -Pattern "redis" -CaseSensitive:$false` |

**Or save logs to file and search:**
```powershell
heroku logs --tail -a leadflow-backend-eu > logs.txt
# Then open logs.txt in Notepad/VS Code and search manually
```

## Issue: Live Notifications Not Showing Up in Production

### Step 1: Verify WebSocket Connection

**In Browser Console (Production Site):**
1. Open DevTools (F12)
2. Go to Console tab
3. Look for WebSocket connection messages:
   - ✅ `[useWebSocket]` logs showing connection attempts
   - ✅ No WebSocket errors
   - ✅ Connection status should show `isConnected: true`

**In Network Tab:**
1. Open DevTools → Network tab
2. Filter by "WS" (WebSocket)
3. Look for connection to: `wss://your-backend.herokuapp.com/ws/notifications/?token=...`
4. Status should be `101 Switching Protocols` (successful connection)

### Step 2: Check Backend Logs

**Linux/Mac (bash):**
```bash
# Check Heroku logs for WebSocket activity
heroku logs --tail -a leadflow-backend-eu | grep -i websocket

# Check for notification sending
heroku logs --tail -a leadflow-backend-eu | grep -i notification

# Check for Redis/channel layer errors
heroku logs --tail -a leadflow-backend-eu | grep -i redis
heroku logs --tail -a leadflow-backend-eu | grep -i channel
```

**Windows (PowerShell):**
```powershell
# Check Heroku logs for WebSocket activity
heroku logs --tail -a leadflow-backend-eu | Select-String -Pattern "websocket" -CaseSensitive:$false

# Check for notification sending
heroku logs --tail -a leadflow-backend-eu | Select-String -Pattern "notification" -CaseSensitive:$false

# Check for Redis/channel layer errors
heroku logs --tail -a leadflow-backend-eu | Select-String -Pattern "redis" -CaseSensitive:$false
heroku logs --tail -a leadflow-backend-eu | Select-String -Pattern "channel" -CaseSensitive:$false

# Or save logs to file and search
heroku logs --tail -a leadflow-backend-eu > logs.txt
# Then open logs.txt and search manually, or use:
Select-String -Path logs.txt -Pattern "notification" -CaseSensitive:$false
```

**What to look for:**
- ✅ `[NotificationConsumer] Connection accepted`
- ✅ `[send_notification_via_websocket] Sent notification`
- ❌ `No channel_layer available` - Redis not configured
- ❌ `Error sending notification` - Check error details

### Step 3: Verify Redis is Running

```bash
# Check if Redis addon is installed
heroku addons -a leadflow-backend-eu

# Check Redis info
heroku redis:info -a leadflow-backend-eu

# Verify REDIS_URL is set
heroku config:get REDIS_URL -a leadflow-backend-eu
```

**Expected:**
- Should see `heroku-redis` addon listed
- `REDIS_URL` should start with `rediss://` (SSL) or `redis://`

### Step 4: Verify Procfile

```bash
# Check root Procfile (Heroku uses root Procfile)
cat Procfile
```

**Expected:**
```
web: cd backend && daphne -b 0.0.0.0 -p $PORT backend.asgi:application
```

**NOT:**
```
web: gunicorn backend.wsgi --log-file -
```

### Step 5: Test WebSocket Connection Manually

**In Browser Console:**
```javascript
// Get your token from localStorage
const token = localStorage.getItem('access_token');

// Test WebSocket connection
const ws = new WebSocket(`wss://your-backend.herokuapp.com/ws/notifications/?token=${token}`);

ws.onopen = () => console.log('✅ WebSocket connected');
ws.onmessage = (event) => console.log('📨 Message received:', JSON.parse(event.data));
ws.onerror = (error) => console.error('❌ WebSocket error:', error);
ws.onclose = (event) => console.log('🔌 WebSocket closed:', event.code, event.reason);

// Wait a few seconds, then check connection status
setTimeout(() => {
  console.log('WebSocket state:', ws.readyState); // 1 = OPEN, 0 = CONNECTING, 2 = CLOSING, 3 = CLOSED
}, 2000);
```

### Step 6: Check Frontend Environment Variable

**On Vercel:**
1. Go to Project Settings → Environment Variables
2. Verify `VITE_URL` is set to: `https://your-backend.herokuapp.com`
3. Ensure it's set for Production environment
4. **Redeploy** frontend after changing environment variables

### Step 7: Verify Signal Handler is Working

**Check if signals.py is being imported:**
```bash
# In Django shell on Heroku
heroku run python manage.py shell -a leadflow-backend-eu

# Then in shell:
from api.signals import send_notification_via_websocket
from api.models import Notification
from django.contrib.auth.models import User

# Check if signal is registered
import django.dispatch
print(Notification._meta.get_field('id'))  # Should work

# Test creating a notification
user = User.objects.first()
notif = Notification.objects.create(
    user=user,
    type='system',
    title='Test',
    message='Test notification'
)
# Should trigger signal and send via WebSocket
```

### Step 8: Common Issues and Fixes

#### Issue: "No channel_layer available"

**Fix:**
1. Ensure Redis addon is installed: `heroku addons:create heroku-redis:premium-0 -a your-app`
2. Restart dynos: `heroku restart -a your-app`
3. Check `REDIS_URL` is set: `heroku config:get REDIS_URL -a your-app`

#### Issue: WebSocket connects but no messages received

**Possible causes:**
1. Signal handler not firing - check if signals.py is imported in apps.py
2. Channel layer not configured correctly - check settings.py
3. Notification type is 'event' or 'message' (these are handled separately)

**Fix:**
1. Verify signals.py is imported in `api/apps.py`:
   ```python
   def ready(self):
       import api.signals  # noqa: F401
   ```
2. Check notification type - only non-event, non-message notifications trigger the signal

#### Issue: WebSocket connection fails (404 or 500)

**Fix:**
1. Verify Procfile uses `daphne` not `gunicorn`
2. Check ASGI application is configured: `ASGI_APPLICATION = 'backend.asgi.application'`
3. Verify routing.py has WebSocket URL patterns
4. Check ALLOWED_HOSTS includes your Heroku domain

#### Issue: CORS errors in browser console

**Fix:**
1. Set CORS_ALLOWED_ORIGINS on Heroku:
   ```bash
   heroku config:set CORS_ALLOWED_ORIGINS=https://your-frontend.vercel.app -a your-app
   ```
2. Or set CORS_ALLOW_ALL_ORIGINS=True (less secure but works)

#### Issue: Token authentication fails

**Fix:**
1. Verify token is being sent in WebSocket URL query string
2. Check token is valid and not expired
3. Verify SECRET_KEY matches between backend and token generation

### Step 9: Enable Debug Logging

**Add to settings.py temporarily:**
```python
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
        },
    },
    'loggers': {
        'api.consumers': {
            'handlers': ['console'],
            'level': 'DEBUG',
        },
        'api.signals': {
            'handlers': ['console'],
            'level': 'DEBUG',
        },
        'channels': {
            'handlers': ['console'],
            'level': 'DEBUG',
        },
    },
}
```

Then check logs:
```bash
heroku logs --tail -a leadflow-backend-eu
```

### Step 10: Test Notification Creation

**Create a test notification via Django shell:**
```bash
heroku run python manage.py shell -a leadflow-backend-eu
```

```python
from api.models import Notification
from django.contrib.auth.models import User

user = User.objects.first()
notification = Notification.objects.create(
    user=user,
    type='system',
    title='Test Notification',
    message='This is a test notification'
)
# This should trigger the signal and send via WebSocket
```

**Check browser console** - should see notification appear immediately.

## Quick Checklist

- [ ] Redis addon installed on Heroku
- [ ] `REDIS_URL` environment variable is set
- [ ] Root `Procfile` uses `daphne` (not `gunicorn`)
- [ ] `ASGI_APPLICATION` is configured in settings.py
- [ ] `CHANNEL_LAYERS` configured to use Redis
- [ ] `signals.py` is imported in `apps.py`
- [ ] `VITE_URL` is set on Vercel frontend
- [ ] Frontend is redeployed after setting `VITE_URL`
- [ ] WebSocket connection shows `101 Switching Protocols` in Network tab
- [ ] Browser console shows no WebSocket errors
- [ ] Backend logs show notification sending messages

## Still Not Working?

1. **Check all logs:**
   ```bash
   heroku logs --tail -a leadflow-backend-eu > logs.txt
   ```

2. **Test locally first:**
   - Set up local Redis
   - Test WebSocket connection locally
   - If it works locally but not in production, it's a deployment/config issue

3. **Verify signal is firing:**
   - Add print statements in `send_notification_via_websocket`
   - Check Heroku logs for these print statements

4. **Check notification type:**
   - Event notifications use `send_event_notification` function
   - Message notifications use chat WebSocket
   - Other notifications use the signal handler

