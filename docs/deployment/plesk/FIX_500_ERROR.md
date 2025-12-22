# Fix 500 Internal Server Error

## Quick Diagnostic Steps

### Step 1: Check Error Logs

**Check Plesk error logs:**
```bash
# View recent error logs
tail -50 /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/logs/error_log

# Or check nginx error logs
tail -50 /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/logs/nginx_error_log
```

**Check backend logs:**
```bash
# If using nohup
tail -50 ~/backend.log

# If using systemd
journalctl -u leadflow -n 50
```

### Step 2: Check Backend Status

```bash
# Check if backend is running
netstat -tulpn | grep :8000
ps aux | grep daphne

# Test backend directly
curl http://127.0.0.1:8000/api/health/
```

### Step 3: Check Document Root Configuration

**Common Issue:** Document root is set to `/httpdocs/frontend/dist` but Plesk is trying to execute it as PHP/Python.

**Fix:**

1. **Plesk Panel** → **Hosting & DNS** → **Hosting Settings**
2. Check **Document root** - should be `/httpdocs/frontend/dist`
3. **IMPORTANT:** Make sure **"PHP support"** is **DISABLED** for the frontend
   - Or set PHP to "None" / "Disabled"
   - Frontend files are static HTML/JS, not PHP

### Step 4: Check File Permissions

```bash
# Check permissions on frontend/dist
ls -la /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs/frontend/dist/

# Fix permissions if needed
chmod -R 755 /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs/frontend/dist/
chown -R $(whoami):psacln /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs/frontend/dist/
```

### Step 5: Verify Frontend Files Exist

```bash
# Check if dist folder exists and has files
ls -la /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs/frontend/dist/

# Should see:
# - index.html
# - assets/ folder
```

## Common Causes and Solutions

### Cause 1: PHP Support Enabled on Static Files

**Problem:** Plesk is trying to execute `index.html` as PHP.

**Solution:**
1. **Plesk Panel** → **Hosting & DNS** → **Hosting Settings**
2. Set **PHP support** to **"None"** or **"Disabled"**
3. Click **OK**

### Cause 2: Document Root Points to Wrong Location

**Problem:** Document root not set correctly.

**Solution:**
1. **Plesk Panel** → **Hosting & DNS** → **Hosting Settings**
2. Set **Document root** to: `/httpdocs/frontend/dist`
3. Click **OK**

### Cause 3: Backend Not Running

**Problem:** Frontend tries to load, but backend API calls fail.

**Solution:**
```bash
# Start backend
cd /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs/backend
nohup python3.12 -m daphne -b 127.0.0.1 -p 8000 backend.asgi:application > ~/backend.log 2>&1 &

# Verify
curl http://127.0.0.1:8000/api/health/
```

### Cause 4: Nginx Configuration Issue

**Problem:** Nginx directives conflict or incorrect.

**Solution:**
1. **Plesk Panel** → **Hosting & DNS** → **Apache & nginx Settings**
2. Check **Additional nginx directives**
3. Make sure you're using `plesk-nginx-fixed.conf` (NOT `plesk-nginx.conf`)
4. Remove any `location /` blocks (Plesk handles root)
5. Click **OK** to test and apply

### Cause 5: Missing index.html or Wrong Permissions

**Problem:** Files don't exist or can't be read.

**Solution:**
```bash
# Check if index.html exists
ls -la /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs/frontend/dist/index.html

# If missing, rebuild frontend
cd /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs/frontend
npm run build

# Fix permissions
chmod 644 /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs/frontend/dist/index.html
chmod -R 755 /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs/frontend/dist/
```

## Step-by-Step Fix

### Option A: If Using Nginx

1. **Disable PHP for frontend:**
   - **Plesk Panel** → **Hosting & DNS** → **Hosting Settings**
   - Set **PHP support** to **"None"**
   - Click **OK**

2. **Set Document Root:**
   - **Hosting Settings** → **Document root**: `/httpdocs/frontend/dist`
   - Click **OK**

3. **Check Nginx Directives:**
   - **Apache & nginx Settings** → **Additional nginx directives**
   - Use content from `plesk-nginx-fixed.conf`
   - Click **OK**

4. **Start Backend:**
   ```bash
   cd /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs/backend
   nohup python3.12 -m daphne -b 127.0.0.1 -p 8000 backend.asgi:application > ~/backend.log 2>&1 &
   ```

5. **Test:**
   ```bash
   curl https://blissful-spence.82-165-44-164.plesk.page/
   ```

### Option B: If Using Apache

1. **Create .htaccess file:**
   ```bash
   cd /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs/frontend/dist
   cp ../../docs/deployment/plesk/plesk.htaccess .htaccess
   ```

2. **Update paths in .htaccess** (replace `your-domain.com` with your domain)

3. **Set Document Root:**
   - **Plesk Panel** → **Hosting & DNS** → **Hosting Settings**
   - **Document root**: `/httpdocs/frontend/dist`
   - Click **OK**

## Quick Diagnostic Script

Run this to check everything:

```bash
echo "=== Checking Backend ==="
netstat -tulpn | grep :8000 || echo "❌ Backend not running"
curl -s http://127.0.0.1:8000/api/health/ || echo "❌ Backend not responding"

echo ""
echo "=== Checking Frontend Files ==="
ls -la /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs/frontend/dist/index.html || echo "❌ index.html missing"

echo ""
echo "=== Checking Permissions ==="
ls -ld /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs/frontend/dist/

echo ""
echo "=== Checking Error Logs ==="
tail -5 /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/logs/error_log
```

## Most Common Fix

**90% of the time, the issue is PHP support enabled on static files:**

1. **Plesk Panel** → **Hosting & DNS** → **Hosting Settings**
2. Set **PHP support** to **"None"**
3. Click **OK**
4. Refresh your browser

## Still Not Working?

Share the output of:
```bash
tail -20 /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/logs/error_log
```

This will show the exact error causing the 500.

