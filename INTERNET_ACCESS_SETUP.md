# Internet Access Setup Guide

Complete guide for making your backend accessible from anywhere in the world.

## ⚠️ CRITICAL SECURITY WARNING

**Exposing your backend to the internet makes it accessible to anyone worldwide.** This requires:
- Strong authentication and authorization
- HTTPS/SSL encryption
- Rate limiting
- Proper firewall configuration
- Regular security updates
- Monitoring and logging

**Only proceed if you understand these risks and have implemented proper security measures.**

## Quick Start: Using Tunnel Service (Easiest & Recommended)

### Option 1: ngrok (Recommended)

```powershell
# 1. Download ngrok: https://ngrok.com/download
# 2. Extract and add to PATH, or run from directory

# 3. Start your backend locally
cd backend
python manage.py runserver 0.0.0.0:8000

# 4. In another terminal, expose with ngrok
ngrok http 8000

# Output:
# Forwarding  https://abc123.ngrok.io -> http://localhost:8000
# Use this URL: https://abc123.ngrok.io
```

**Update frontend `.env.production`:**
```env
VITE_URL=https://abc123.ngrok.io
```

**Advantages:**
- ✅ Automatic HTTPS
- ✅ No router configuration
- ✅ Works behind firewalls
- ✅ Free tier available

**Limitations:**
- Free tier: Random URLs, connection timeouts
- Paid tier: Custom domains, no timeouts

### Option 2: localtunnel

```powershell
# Install
npm install -g localtunnel

# Expose backend
lt --port 8000

# Output: https://your-subdomain.loca.lt
```

## Full Internet Access Setup (Direct Access)

### Prerequisites

1. **Static Public IP** (or dynamic DNS service)
2. **Router with port forwarding capability**
3. **Domain name** (optional but recommended)
4. **SSL Certificate** (required for HTTPS)

### Step 1: Get Your Public IP Address

```powershell
# Get current public IP
Invoke-RestMethod -Uri "https://api.ipify.org"

# Or visit: https://whatismyipaddress.com
```

**Note:** If your ISP provides a dynamic IP, consider using a dynamic DNS service like:
- No-IP (https://www.noip.com)
- DuckDNS (https://www.duckdns.org)
- Dynu (https://www.dynu.com)

### Step 2: Configure Backend for Internet Access

**Update `backend/.env`:**

```env
# Django Settings
SECRET_KEY=your-very-strong-secret-key-minimum-50-characters-random-string
DEBUG=False  # CRITICAL: Never use True for internet access
ALLOWED_HOSTS=*

# Or specify your domain/IP explicitly (more secure):
# ALLOWED_HOSTS=your-domain.com,123.45.67.89,your-dynamic-dns-domain.ddns.net

# Database (use strong passwords!)
DB_NAME=leadflow
DB_USER=your_db_user
DB_PASSWORD=strong-database-password-here
DB_HOST=localhost
DB_PORT=5432

# CORS - restrict to your frontend domain (more secure)
# CSRF_TRUSTED_ORIGINS=https://your-frontend-domain.com,https://your-domain.com
```

### Step 3: Start Backend on All Interfaces

```powershell
cd backend

# Development (not recommended for production)
python manage.py runserver 0.0.0.0:8000

# Production (recommended)
daphne -b 0.0.0.0 -p 8000 backend.asgi:application

# Or with gunicorn (for production)
gunicorn backend.wsgi:application --bind 0.0.0.0:8000 --workers 4
```

### Step 4: Configure Router Port Forwarding

**Find your router's admin panel:**
- Usually: `http://192.168.1.1` or `http://192.168.0.1`
- Check router manual or sticker on router

**Configure Port Forwarding:**

1. Log into router admin panel
2. Navigate to "Port Forwarding" or "Virtual Server"
3. Add new rule:
   - **Service Name**: Django Backend
   - **External Port**: 8000 (or 443 for HTTPS)
   - **Internal IP**: Your computer's local IP (e.g., `192.168.1.100`)
   - **Internal Port**: 8000
   - **Protocol**: TCP (or Both)
4. Save and apply

**Find your local IP:**
```powershell
ipconfig | findstr IPv4
```

### Step 5: Configure Windows Firewall

```powershell
# Allow inbound connections on port 8000
New-NetFirewallRule -DisplayName "Django Backend Internet" -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow

# Verify rule was created
Get-NetFirewallRule -DisplayName "Django Backend Internet"
```

### Step 6: Set Up HTTPS (REQUIRED)

**Option A: Using nginx Reverse Proxy (Recommended)**

1. **Install nginx:**
   ```powershell
   # Download from: https://nginx.org/en/download.html
   # Or use chocolatey:
   choco install nginx
   ```

2. **Get SSL Certificate (Let's Encrypt):**
   ```powershell
   # Install certbot
   choco install certbot
   
   # Get certificate (replace with your domain)
   certbot certonly --standalone -d your-domain.com
   ```

3. **Configure nginx:**

   Create `C:\nginx\conf\leadflow.conf`:

   ```nginx
   # Redirect HTTP to HTTPS
   server {
       listen 80;
       server_name your-domain.com;
       return 301 https://$server_name$request_uri;
   }

   # HTTPS server
   server {
       listen 443 ssl http2;
       server_name your-domain.com;

       ssl_certificate C:/certbot/live/your-domain.com/fullchain.pem;
       ssl_certificate_key C:/certbot/live/your-domain.com/privkey.pem;

       # SSL configuration
       ssl_protocols TLSv1.2 TLSv1.3;
       ssl_ciphers HIGH:!aNULL:!MD5;
       ssl_prefer_server_ciphers on;

       # Proxy to Django backend
       location / {
           proxy_pass http://127.0.0.1:8000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_set_header X-Forwarded-Host $host;
           
           # WebSocket support
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
       }

       # Security headers
       add_header X-Frame-Options "SAMEORIGIN" always;
       add_header X-Content-Type-Options "nosniff" always;
       add_header X-XSS-Protection "1; mode=block" always;
   }
   ```

4. **Update router port forwarding:**
   - External Port: 443 (HTTPS)
   - Internal IP: Your computer's IP
   - Internal Port: 443

**Option B: Using Cloudflare Tunnel (Free HTTPS)**

```powershell
# Install cloudflared
# Download from: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/

# Create tunnel
cloudflared tunnel create leadflow

# Run tunnel
cloudflared tunnel run leadflow
```

### Step 7: Update Frontend Configuration

**Update `frontend/.env.production`:**

```env
# Use your public domain or IP
VITE_URL=https://your-domain.com
# Or if using IP:
# VITE_URL=https://123.45.67.89:8000
```

**Rebuild frontend:**
```powershell
cd frontend
npm run build
```

### Step 8: Additional Security Hardening

**1. Install Rate Limiting:**

```powershell
cd backend
pip install django-ratelimit
```

Add to `backend/backend/settings.py`:
```python
INSTALLED_APPS = [
    # ... existing apps
    'django_ratelimit',
]

# Rate limiting middleware
MIDDLEWARE = [
    # ... existing middleware
    'django_ratelimit.middleware.RatelimitMiddleware',
]
```

**2. Restrict CORS Origins:**

Update `backend/backend/settings.py`:
```python
# Instead of allowing all origins
CORS_ALLOW_ALL_ORIGINS = False

# Specify allowed origins
CORS_ALLOWED_ORIGINS = [
    "https://your-frontend-domain.com",
    "https://your-domain.com",
]
```

**3. Set Up Monitoring:**

```powershell
# Install monitoring tools
pip install django-silk  # For request profiling
pip install sentry-sdk    # For error tracking
```

**4. Enable Django Security Settings:**

Update `backend/backend/settings.py`:
```python
# Security settings
SECURE_SSL_REDIRECT = True  # Redirect HTTP to HTTPS
SESSION_COOKIE_SECURE = True  # Only send cookies over HTTPS
CSRF_COOKIE_SECURE = True  # Only send CSRF cookies over HTTPS
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'
```

## Testing Internet Access

### From Another Network

```powershell
# Test backend health endpoint
Invoke-RestMethod -Uri "https://your-domain.com/health/"

# Or using curl
curl https://your-domain.com/health/
```

### Check Port Accessibility

Use online tools:
- https://www.yougetsignal.com/tools/open-ports/
- https://canyouseeme.org/

Enter your public IP and port 8000 (or 443 for HTTPS).

## Troubleshooting

### Backend Not Accessible from Internet

1. **Check router port forwarding:**
   - Verify rule is active
   - Check external port matches
   - Verify internal IP is correct

2. **Check Windows Firewall:**
   ```powershell
   Get-NetFirewallRule -DisplayName "Django Backend Internet"
   ```

3. **Check ISP restrictions:**
   - Some ISPs block incoming connections
   - May need to contact ISP or use tunnel service

4. **Verify backend is running:**
   ```powershell
   netstat -ano | findstr :8000
   ```

### SSL Certificate Issues

1. **Certificate expired:**
   ```powershell
   certbot renew
   ```

2. **Certificate not trusted:**
   - Use Let's Encrypt (free, trusted)
   - Or purchase from trusted CA

### Connection Timeouts

1. **Check router timeout settings**
2. **Use keep-alive headers**
3. **Consider using tunnel service** (handles this automatically)

## Production Checklist

Before going live, ensure:

- [ ] `DEBUG=False` in production
- [ ] Strong `SECRET_KEY` set
- [ ] HTTPS/SSL configured
- [ ] Strong database passwords
- [ ] Rate limiting enabled
- [ ] CORS restricted to trusted origins
- [ ] Firewall rules configured
- [ ] Monitoring/logging set up
- [ ] Regular backups configured
- [ ] Security headers enabled
- [ ] Authentication properly implemented
- [ ] Input validation on all endpoints
- [ ] Error handling doesn't expose sensitive info

## Recommended Architecture

```
Internet
   ↓
Router (Port Forwarding)
   ↓
Nginx (SSL Termination, Reverse Proxy)
   ↓
Django Backend (Gunicorn/Daphne)
   ↓
PostgreSQL Database
```

## Quick Reference

**Start backend for internet access:**
```powershell
cd backend
daphne -b 0.0.0.0 -p 8000 backend.asgi:application
```

**Check if accessible:**
```powershell
Invoke-RestMethod -Uri "https://your-domain.com/health/"
```

**View access logs:**
```powershell
# Django logs
cd backend
python manage.py runserver 0.0.0.0:8000

# Nginx logs (if using)
Get-Content C:\nginx\logs\access.log -Tail 50
```

## Support

For issues:
1. Check router logs
2. Check Windows Firewall logs
3. Check Django logs
4. Use online port checker tools
5. Consider using tunnel service (ngrok) as temporary solution
