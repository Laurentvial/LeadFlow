# Production WebSocket Deployment Guide

This guide explains how to deploy WebSockets to production so notifications appear in real-time without page refresh, just like in local development.

## Prerequisites

- Heroku account
- Heroku CLI installed
- Backend deployed on Heroku
- Frontend deployed (Vercel or other)

## Step-by-Step Deployment

### 1. Add Redis Addon to Heroku

WebSockets require Redis for Django Channels. Add the Heroku Redis addon:

```bash
# For production (recommended - paid plan)
heroku addons:create heroku-redis:premium-0 -a leadflow-backend-eu

# OR for testing (free plan with limitations)
heroku addons:create heroku-redis:mini -a leadflow-backend-eu
```

This automatically sets the `REDIS_URL` environment variable on your Heroku app.

### 2. Verify Procfile Configuration

**IMPORTANT**: Heroku uses the `Procfile` in the **root directory** (not `backend/Procfile`).

Ensure your root `Procfile` contains:

```
web: cd backend && daphne -b 0.0.0.0 -p $PORT backend.asgi:application
```

**NOT** `gunicorn` - gunicorn doesn't support WebSockets!

### 3. Verify Backend Settings

Your `backend/backend/settings.py` should already be configured correctly:
- ✅ Channels is installed
- ✅ ASGI_APPLICATION is set
- ✅ CHANNEL_LAYERS uses Redis when REDIS_URL is present
- ✅ SSL support for Heroku Redis (rediss://)

### 4. Verify Dependencies

Ensure `backend/requirements.txt` includes:

```
channels==4.1.0
channels-redis==4.2.0
redis==7.1.0
daphne==4.1.1
```

### 5. Configure Environment Variables on Heroku

Set these environment variables on Heroku:

```bash
# Replace with your actual Heroku app URL
heroku config:set ALLOWED_HOSTS=leadflow-backend-eu-8d20fb5efc7b.herokuapp.com -a leadflow-backend-eu

# CSRF trusted origins (add your frontend URL too)
heroku config:set CSRF_TRUSTED_ORIGINS=https://leadflow-backend-eu-8d20fb5efc7b.herokuapp.com,https://your-frontend-domain.vercel.app -a leadflow-backend-eu

# CORS allowed origins (optional, if you want to restrict)
heroku config:set CORS_ALLOWED_ORIGINS=https://your-frontend-domain.vercel.app -a leadflow-backend-eu
```

### 6. Configure Frontend Environment Variable

**On Vercel** (or your frontend hosting):

1. Go to your Vercel project settings
2. Navigate to **Environment Variables**
3. Add/Update:
   - **Name:** `VITE_URL`
   - **Value:** `https://leadflow-backend-eu-8d20fb5efc7b.herokuapp.com`
   - **Environment:** Production, Preview, Development (select all)
4. **Redeploy** your frontend

The frontend code already handles WebSocket protocol correctly:
- For `https://` URLs → Uses `wss://` (WebSocket Secure)
- For `http://` URLs → Uses `ws://`

### 7. Deploy Backend to Heroku

```bash
# Commit any changes
git add .
git commit -m "Configure WebSocket for production"

# Push to Heroku
git push heroku main

# Or if using a different branch
git push heroku your-branch:main
```

### 8. Verify Deployment

#### Check Heroku Logs

```bash
heroku logs --tail -a leadflow-backend-eu
```

Look for:
- ✅ `Starting server at tcp:port:XXXXX:interface=0.0.0.0` (Daphne starting)
- ✅ No errors about channel_layer or Redis

#### Check Redis Addon

```bash
heroku addons -a leadflow-backend-eu
```

Should show `heroku-redis` addon.

#### Verify Environment Variables

```bash
heroku config:get REDIS_URL -a leadflow-backend-eu
```

Should return a Redis URL starting with `rediss://` or `redis://`.

### 9. Test WebSocket Connection

1. Open your production frontend in a browser
2. Open browser DevTools → Console
3. Look for WebSocket connection messages:
   - ✅ `[useWebSocket]` logs showing connection attempts
   - ✅ No WebSocket errors
4. Check Network tab → WS filter:
   - Should see WebSocket connection to `wss://leadflow-backend-eu-8d20fb5efc7b.herokuapp.com/ws/notifications/`
   - Status should be `101 Switching Protocols` (successful connection)

### 10. Test Real-Time Notifications

1. Open your app in two browser windows/tabs
2. In Tab 1: Create a notification or send a message
3. In Tab 2: Should see notification appear **without refreshing**

## Troubleshooting

### WebSocket Connection Fails

**Symptoms:**
- Console shows WebSocket errors
- Connection closes immediately
- Status code 404 or 500

**Solutions:**

1. **Check Procfile location:**
   ```bash
   # Verify root Procfile exists and uses daphne
   cat Procfile
   ```

2. **Check Redis is running:**
   ```bash
   heroku addons -a leadflow-backend-eu
   heroku redis:info -a leadflow-backend-eu
   ```

3. **Check backend logs:**
   ```bash
   heroku logs --tail -a leadflow-backend-eu | grep -i websocket
   heroku logs --tail -a leadflow-backend-eu | grep -i redis
   ```

4. **Verify ASGI application:**
   - Ensure `backend/backend/asgi.py` exists and is configured correctly
   - Ensure `ASGI_APPLICATION = 'backend.asgi.application'` in settings.py

### "No channel layer" Error

**Solution:**
```bash
# Verify REDIS_URL is set
heroku config:get REDIS_URL -a leadflow-backend-eu

# If not set, Redis addon might not be installed
heroku addons:create heroku-redis:premium-0 -a leadflow-backend-eu

# Restart dynos
heroku restart -a leadflow-backend-eu
```

### WebSocket Connects but No Notifications

**Check:**
1. Frontend console for WebSocket messages
2. Backend logs for notification sending:
   ```bash
   heroku logs --tail -a leadflow-backend-eu | grep -i notification
   ```
3. Verify token is being sent in WebSocket URL (check Network tab → WS → Headers)

### WebSocket Uses Wrong Protocol (ws:// instead of wss://)

**Solution:**
- Ensure `VITE_URL` environment variable is set to `https://` URL (not `http://`)
- Frontend code automatically converts `https://` → `wss://`
- Redeploy frontend after setting environment variable

### Connection Timeout After 55 Seconds

This is normal on Heroku. The WebSocket code handles reconnection automatically. If you see frequent disconnections:

1. Check Heroku dyno is not sleeping (use a paid dyno)
2. Verify WebSocket reconnection logic is working (check console logs)

## Production Checklist

- [ ] Redis addon added to Heroku
- [ ] Root `Procfile` uses `daphne` (not `gunicorn`)
- [ ] `REDIS_URL` environment variable is set automatically by Redis addon
- [ ] `ALLOWED_HOSTS` includes your Heroku domain
- [ ] `CSRF_TRUSTED_ORIGINS` includes backend and frontend URLs
- [ ] `VITE_URL` environment variable set on frontend (Vercel)
- [ ] Backend dependencies include: `channels`, `channels-redis`, `redis`, `daphne`
- [ ] Backend deployed successfully
- [ ] Frontend deployed successfully
- [ ] WebSocket connection successful (check browser console)
- [ ] Real-time notifications working (test with two tabs)

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

## Important Notes

1. **HTTPS/WSS**: Production uses `wss://` (WebSocket Secure) for HTTPS sites
2. **Redis Required**: WebSockets won't work without Redis in production
3. **Daphne Required**: Must use `daphne` ASGI server, not `gunicorn` WSGI server
4. **Environment Variables**: Both backend (Heroku) and frontend (Vercel) need correct environment variables
5. **Free Redis Limitations**: Free Heroku Redis has limitations; use paid plan for production

## Support

If issues persist:
1. Check Heroku logs: `heroku logs --tail -a leadflow-backend-eu`
2. Check browser console for WebSocket errors
3. Verify all environment variables are set correctly
4. Ensure Redis addon is active and not expired

