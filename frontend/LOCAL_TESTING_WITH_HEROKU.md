# Local Frontend Testing with Heroku Backend

This guide explains how to test your local frontend with the Heroku backend deployment.

## Problem

When running the frontend locally (`npm run dev`), WebSockets work with a local backend but not with the Heroku backend. This is because the frontend needs to know which backend URL to use.

## Solution: Set VITE_URL Environment Variable

The frontend uses the `VITE_URL` environment variable to determine the backend URL. When testing locally with Heroku backend, you need to set this variable.

### Option 1: Create `.env.local` file (Recommended)

Create a file `frontend/.env.local` (this file is gitignored):

```bash
VITE_URL=https://leadflow-backend-eu-8d20fb5efc7b.herokuapp.com
```

Then restart your dev server:
```bash
npm run dev
```

### Option 2: Set Environment Variable in PowerShell

**Windows PowerShell:**
```powershell
$env:VITE_URL="https://leadflow-backend-eu-8d20fb5efc7b.herokuapp.com"
npm run dev
```

**Windows CMD:**
```cmd
set VITE_URL=https://leadflow-backend-eu-8d20fb5efc7b.herokuapp.com
npm run dev
```

**Linux/Mac:**
```bash
export VITE_URL=https://leadflow-backend-eu-8d20fb5efc7b.herokuapp.com
npm run dev
```

### Option 3: Use `.env` file (Not Recommended - Committed to Git)

Create `frontend/.env`:
```bash
VITE_URL=https://leadflow-backend-eu-8d20fb5efc7b.herokuapp.com
```

**Note:** `.env` files are usually committed to git, so this might affect other developers. Use `.env.local` instead.

## Verify Configuration

After setting `VITE_URL`, check the browser console when the app loads. You should see:

```
[useWebSocket] Backend URL from VITE_URL: https://leadflow-backend-eu-8d20fb5efc7b.herokuapp.com
[useWebSocket] Protocol: wss:
[useWebSocket] Host: leadflow-backend-eu-8d20fb5efc7b.herokuapp.com
[useWebSocket] Connecting to: wss://leadflow-backend-eu-8d20fb5efc7b.herokuapp.com/ws/notifications/?token=***
```

If you see `http://127.0.0.1:8000` instead, the `VITE_URL` is not set correctly.

## Testing Checklist

- [ ] `VITE_URL` is set to Heroku backend URL
- [ ] Frontend dev server restarted after setting `VITE_URL`
- [ ] Browser console shows correct backend URL in WebSocket logs
- [ ] WebSocket connection shows `✅ WebSocket connected successfully`
- [ ] Network tab shows WebSocket connection with status `101 Switching Protocols`

## Troubleshooting

### WebSocket Still Not Connecting

1. **Check browser console** for WebSocket errors:
   - Look for `[useWebSocket]` logs
   - Check for CORS errors
   - Check for network errors

2. **Check Network tab**:
   - Filter by "WS" (WebSocket)
   - Look for connection attempts
   - Check status code (should be `101`)

3. **Verify Heroku backend is running**:
   ```bash
   heroku ps -a leadflow-backend-eu
   ```

4. **Check Heroku logs**:
   ```bash
   heroku logs --tail -a leadflow-backend-eu
   ```
   Look for WebSocket connection attempts and errors.

5. **Test WebSocket manually in browser console**:
   ```javascript
   const token = localStorage.getItem('access_token');
   const ws = new WebSocket(`wss://leadflow-backend-eu-8d20fb5efc7b.herokuapp.com/ws/notifications/?token=${token}`);
   ws.onopen = () => console.log('✅ Connected');
   ws.onerror = (e) => console.error('❌ Error:', e);
   ws.onclose = (e) => console.log('🔌 Closed:', e.code, e.reason);
   ```

### Common Issues

**Issue:** WebSocket connects but immediately closes with code 1006
- **Cause:** Backend WebSocket route not configured or Redis not working
- **Fix:** Check Heroku logs for WebSocket errors, verify Redis addon is installed

**Issue:** CORS errors in console
- **Cause:** Backend CORS configuration doesn't allow localhost origin
- **Fix:** Backend should allow all origins or add localhost to CORS_ALLOWED_ORIGINS

**Issue:** WebSocket URL shows `ws://` instead of `wss://`
- **Cause:** `VITE_URL` is set to `http://` instead of `https://`
- **Fix:** Use `https://` URL for Heroku backend

**Issue:** "Failed to construct 'WebSocket': Invalid URL"
- **Cause:** `VITE_URL` is not set or is invalid
- **Fix:** Set `VITE_URL` to valid Heroku backend URL

## Environment Files Priority

Vite loads environment variables in this order (highest priority first):
1. `.env.local` (always loaded, except in test)
2. `.env.[mode].local` (e.g., `.env.development.local`)
3. `.env.[mode]` (e.g., `.env.development`)
4. `.env`

Use `.env.local` for local development to avoid committing secrets.

## Quick Reference

**Local Backend:**
```bash
# No VITE_URL needed (defaults to http://127.0.0.1:8000)
npm run dev
```

**Heroku Backend:**
```bash
# Set VITE_URL first
echo "VITE_URL=https://leadflow-backend-eu-8d20fb5efc7b.herokuapp.com" > frontend/.env.local
npm run dev
```

**Production (Vercel):**
- Set `VITE_URL` in Vercel environment variables
- Vercel automatically uses it during build

