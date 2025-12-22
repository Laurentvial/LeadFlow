# Fix 404 Not Found for /api/

## Problem

Accessing `https://blissful-spence.82-165-44-164.plesk.page/api/` returns **404 Not Found**.

## Quick Diagnostic

### Step 1: Check if Backend is Running

```bash
# Check if backend is running on port 8000
netstat -tulpn | grep :8000
ps aux | grep daphne

# Test backend directly
curl http://127.0.0.1:8000/api/health/
```

**Expected:** Should return `{"status": "healthy", "service": "backend"}`

**If backend is NOT running:**
```bash
# Start backend
cd /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs/backend
nohup python3.12 -m daphne -b 127.0.0.1 -p 8000 backend.asgi:application > ~/backend.log 2>&1 &

# Verify it started
netstat -tulpn | grep :8000
curl http://127.0.0.1:8000/api/health/
```

### Step 2: Check Nginx Configuration

**In Plesk Panel:**

1. **Hosting & DNS** → **Apache & nginx Settings**
2. Scroll to **Additional nginx directives**
3. **Verify** you have this block:

```nginx
# API endpoints - proxy to Django backend
location /api/ {
    proxy_pass http://127.0.0.1:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_redirect off;
}
```

**If missing, add it!**

### Step 3: Verify Nginx Configuration is Applied

```bash
# Check nginx configuration
nginx -t

# If valid, reload nginx
systemctl reload nginx
```

### Step 4: Check Error Logs

```bash
# Check nginx error logs
tail -20 /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/logs/nginx_error_log

# Check access logs
tail -20 /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/logs/access_log
```

## Common Issues and Fixes

### Issue 1: Backend Not Running

**Symptoms:** `netstat -tulpn | grep :8000` returns nothing

**Fix:**
```bash
cd /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs/backend
nohup python3.12 -m daphne -b 127.0.0.1 -p 8000 backend.asgi:application > ~/backend.log 2>&1 &
```

### Issue 2: Nginx Location Block Missing

**Symptoms:** Backend works locally but 404 via domain

**Fix:**
1. **Plesk Panel** → **Hosting & DNS** → **Apache & nginx Settings**
2. **Additional nginx directives** → Add the `/api/` location block (see Step 2 above)
3. Click **OK** to apply

### Issue 3: Wrong proxy_pass URL

**Symptoms:** Nginx config exists but still 404

**Check:** Make sure `proxy_pass` is `http://127.0.0.1:8000` (NOT `http://127.0.0.1:8000/`)

**Correct:**
```nginx
location /api/ {
    proxy_pass http://127.0.0.1:8000;  # No trailing slash
}
```

**Wrong:**
```nginx
location /api/ {
    proxy_pass http://127.0.0.1:8000/;  # Trailing slash removes /api/
}
```

### Issue 4: Nginx Not Reloaded

**Symptoms:** Config looks correct but still not working

**Fix:**
```bash
# Test configuration
nginx -t

# Reload nginx
systemctl reload nginx

# Or restart
systemctl restart nginx
```

## Complete Fix Steps

### Step 1: Start Backend

```bash
cd /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs/backend
nohup python3.12 -m daphne -b 127.0.0.1 -p 8000 backend.asgi:application > ~/backend.log 2>&1 &

# Verify
curl http://127.0.0.1:8000/api/health/
```

### Step 2: Configure Nginx in Plesk

1. **Plesk Panel** → **Hosting & DNS** → **Apache & nginx Settings**
2. **Additional nginx directives** → Copy this:

```nginx
# Static files serving
location /static/ {
    alias /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs/backend/staticfiles/;
    expires 30d;
    add_header Cache-Control "public, immutable";
}

location /media/ {
    alias /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs/backend/media/;
    expires 7d;
    add_header Cache-Control "public";
}

# API endpoints - proxy to Django backend
location /api/ {
    proxy_pass http://127.0.0.1:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_redirect off;
}

# Admin panel - proxy to Django backend
location /admin/ {
    proxy_pass http://127.0.0.1:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_redirect off;
}

# WebSocket support
location /ws/ {
    proxy_pass http://127.0.0.1:8000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

3. Click **OK** to apply

### Step 3: Reload Nginx

```bash
# Test configuration
nginx -t

# Reload
systemctl reload nginx
```

### Step 4: Test

```bash
# Test via domain
curl https://blissful-spence.82-165-44-164.plesk.page/api/health/

# Should return: {"status": "healthy", "service": "backend"}
```

## Quick Diagnostic Script

Run this to check everything:

```bash
echo "=== Backend Status ==="
netstat -tulpn | grep :8000 || echo "❌ Backend NOT running"

echo ""
echo "=== Backend Health Check ==="
curl -s http://127.0.0.1:8000/api/health/ || echo "❌ Backend not responding"

echo ""
echo "=== Nginx Config Test ==="
nginx -t 2>&1 | tail -1

echo ""
echo "=== Recent Nginx Errors ==="
tail -5 /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/logs/nginx_error_log 2>/dev/null || echo "No nginx errors"
```

## Summary

**Most common causes:**
1. ❌ Backend not running → Start it with `nohup`
2. ❌ Nginx `/api/` location block missing → Add it in Plesk
3. ❌ Nginx not reloaded → Run `systemctl reload nginx`

**Quick fix:**
1. Start backend
2. Add nginx config in Plesk
3. Reload nginx
4. Test `/api/health/`

