# Fix Nginx Duplicate Location Error

## Problem
```
nginx: [emerg] duplicate location "/" in /var/www/vhosts/system/blissful-spence.82-165-44-164.plesk.page/conf/vhost_nginx.conf:21
```

This happens because Plesk auto-generates a `location /` block, and you've added another one in Additional nginx directives.

## Solution

### Step 1: Remove the Duplicate Location Block

**In Plesk Panel:**
1. Go to **Hosting & DNS** → **Apache & nginx Settings**
2. Scroll to **Additional nginx directives**
3. **Remove** the `location / { ... }` block
4. Keep only these location blocks:
   - `/static/`
   - `/media/`
   - `/api/`
   - `/admin/`
   - `/ws/`

### Step 2: Use the Fixed Configuration

Copy this configuration (without `location /`):

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

# WebSocket support (if using channels)
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

### Step 3: Configure Frontend Serving

Since you can't override `location /` in Additional directives, configure frontend serving via Plesk:

**Option A: Set Document Root to Frontend**
1. **Hosting & DNS** → **Hosting Settings**
2. Set **Document root** to: `/httpdocs/frontend/dist`
3. Plesk will serve frontend files automatically

**Option B: Use Apache Instead**
- Switch to Apache mode
- Use `.htaccess` file (which allows overriding root location)
- See `plesk.htaccess` for configuration

**Option C: Custom Nginx Template (Advanced)**
- Create custom vhost template in Plesk
- This allows full control over nginx config

### Step 4: Test Configuration

After updating:
1. Click **OK** or **Apply** in Plesk
2. Plesk will test nginx configuration automatically
3. If valid, it will apply the changes
4. If invalid, it will show the error

### Step 5: Verify

```bash
# Test nginx configuration
nginx -t

# If successful, reload nginx
systemctl reload nginx
```

## Quick Fix Summary

1. **Remove** `location / { ... }` from Additional nginx directives
2. **Keep** only `/static/`, `/media/`, `/api/`, `/admin/`, `/ws/` locations
3. **Set** document root to `/httpdocs/frontend/dist` in Hosting Settings
4. **Test** configuration

## Alternative: Use Apache

If nginx configuration is too complex, switch to Apache:

1. **Hosting & DNS** → **Hosting Settings**
2. Change web server to **Apache**
3. Use `.htaccess` file instead (more flexible for root location)

