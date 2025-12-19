# Local Self-Hosted Deployment Guide

This guide explains how to deploy the backend locally and configure the frontend production build to use it.

## Overview

- **Backend**: Run locally on `http://127.0.0.1:8000` (or your preferred port)
- **Frontend**: Build production bundle and serve locally, configured to use local backend

## Prerequisites

1. **Python 3.8+** installed
2. **Node.js 18+** and npm installed
3. **PostgreSQL** database (or SQLite for testing)
4. **Redis** (optional, for WebSocket support - falls back to in-memory if not available)

## Part 1: Backend Setup

### Step 1: Install Python Dependencies

```powershell
# Navigate to backend directory
cd backend

# Create virtual environment (recommended)
python -m venv venv

# Activate virtual environment
# PowerShell:
.\venv\Scripts\Activate.ps1
# CMD:
# venv\Scripts\activate.bat

# Install dependencies
pip install -r ..\requirements.txt
```

### Step 2: Configure Environment Variables

Create a `.env` file in the `backend` directory (or root directory):

```env
# Django Settings
SECRET_KEY=your-secret-key-here
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# Database Configuration (choose one)

# Option 1: Local PostgreSQL
USE_LOCAL_DB=1
DB_NAME=leadflow
DB_USER=postgres
DB_PASSWORD=yourpassword
DB_HOST=localhost
DB_PORT=5432

# Option 2: Remote Database (if you have one)
# DB_HOST=your-db-host
# DB_NAME=your-db-name
# DB_USER=your-db-user
# DB_PASSWORD=your-db-password
# DB_PORT=5432

# Option 3: SQLite (for testing - no DB config needed)
# USE_LOCAL_DB=0

# Redis (optional - for WebSocket support)
# USE_REDIS=True
# REDIS_HOST=localhost
# REDIS_PORT=6379

# CORS Settings
CSRF_TRUSTED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173
```

### Step 3: Run Database Migrations

```powershell
# Make sure you're in the backend directory
cd backend

# Run migrations
python manage.py migrate

# Create superuser (optional, for admin access)
python manage.py createsuperuser
```

### Step 4: Collect Static Files (Optional)

```powershell
python manage.py collectstatic --noinput
```

### Step 5: Run the Backend Server

**Important**: By default, the backend runs on `127.0.0.1:8000`, which is **only accessible from the same computer**. See "Network Accessibility" section below for making it accessible on your local network.

You have two options:

#### Option A: Development Server (Simple)

```powershell
# Run Django development server (localhost only)
python manage.py runserver 127.0.0.1:8000

# OR: Accessible on local network (see Network Accessibility section)
python manage.py runserver 0.0.0.0:8000
```

#### Option B: Production-like Server with Daphne (Recommended)

Daphne supports WebSockets and is closer to production:

```powershell
# Run with Daphne (ASGI server) - localhost only
daphne -b 127.0.0.1 -p 8000 backend.asgi:application

# OR: Accessible on local network (see Network Accessibility section)
daphne -b 0.0.0.0 -p 8000 backend.asgi:application
```

**Note**: Daphne is already in `requirements.txt`. If you get an error, install it:
```powershell
pip install daphne
```

### Network Accessibility Options

#### Option 1: Localhost Only (Default - Most Secure)

**Current setup**: Backend runs on `127.0.0.1:8000`
- ✅ **Only accessible from the same computer**
- ✅ **Most secure** - no external access
- ❌ Other computers on your network cannot access it

**Use case**: Development on a single machine

#### Option 2: Local Network Access

To make the backend accessible to other computers on your **local network** (same WiFi/router):

1. **Find your computer's local IP address:**

   ```powershell
   # Windows PowerShell
   ipconfig | findstr IPv4
   
   # Or get specific adapter IP
   Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.InterfaceAlias -notlike "*Loopback*"}
   ```

   Example output: `192.168.1.100` or `10.0.0.5`

2. **Update `.env` file:**

   ```env
   # Add your local IP and allow all local network IPs
   ALLOWED_HOSTS=localhost,127.0.0.1,192.168.1.100,0.0.0.0
   # Or use wildcard for local network (less secure)
   # ALLOWED_HOSTS=*
   ```

3. **Start backend bound to all interfaces:**

   ```powershell
   # Django development server
   python manage.py runserver 0.0.0.0:8000
   
   # OR Daphne
   daphne -b 0.0.0.0 -p 8000 backend.asgi:application
   ```

4. **Configure Windows Firewall** (if needed):

   ```powershell
   # Allow port 8000 through firewall
   New-NetFirewallRule -DisplayName "Django Backend" -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow
   ```

5. **Update frontend `.env.production`:**

   ```env
   # Use your computer's local IP address
   VITE_URL=http://192.168.1.100:8000
   ```

   **Note**: Other devices on your network can now access the backend at `http://192.168.1.100:8000`

#### Option 3: Internet Access (Worldwide Access)

⚠️ **CRITICAL SECURITY WARNING**: Exposing your backend to the internet makes it accessible to **anyone in the world**. This requires proper security measures. Only proceed if you understand the risks and have implemented proper security.

**Two approaches:**

##### Approach A: Direct Internet Access (Router Port Forwarding)

This makes your backend directly accessible via your public IP address.

**Step 1: Find Your Public IP Address**

```powershell
# Get your public IP
Invoke-RestMethod -Uri "https://api.ipify.org"
# Or visit: https://whatismyipaddress.com
```

**Step 2: Configure Backend for Internet Access**

Update `backend/.env`:

```env
# Allow all hosts (or specify your domain if you have one)
ALLOWED_HOSTS=*

# IMPORTANT: Set DEBUG to False for production!
DEBUG=False

# Use a strong secret key
SECRET_KEY=your-very-strong-secret-key-here-minimum-50-characters
```

**Step 3: Start Backend on All Interfaces**

```powershell
# Django development server
python manage.py runserver 0.0.0.0:8000

# OR Daphne (recommended for production)
daphne -b 0.0.0.0 -p 8000 backend.asgi:application
```

**Step 4: Configure Router Port Forwarding**

1. Access your router admin panel (usually `http://192.168.1.1` or `http://192.168.0.1`)
2. Find "Port Forwarding" or "Virtual Server" settings
3. Add a rule:
   - **External Port**: 8000 (or any port you prefer)
   - **Internal IP**: Your computer's local IP (e.g., `192.168.1.100`)
   - **Internal Port**: 8000
   - **Protocol**: TCP
4. Save and apply changes

**Step 5: Configure Windows Firewall**

```powershell
# Allow port 8000 through Windows Firewall
New-NetFirewallRule -DisplayName "Django Backend Internet" -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow
```

**Step 6: Update Frontend Configuration**

Update `frontend/.env.production`:

```env
# Use your public IP address (or domain if you have one)
VITE_URL=http://YOUR_PUBLIC_IP:8000

# Example:
# VITE_URL=http://123.45.67.89:8000
```

**Step 7: Rebuild Frontend**

```powershell
cd frontend
npm run build
```

**Access URLs:**
- Backend: `http://YOUR_PUBLIC_IP:8000`
- Frontend: Configure based on where you deploy it

##### Approach B: Using Tunnel Services (Easier, More Secure)

**Using ngrok** (creates secure HTTPS tunnel):

```powershell
# Install ngrok: https://ngrok.com/download

# Expose local backend (creates HTTPS tunnel automatically)
ngrok http 8000

# Output will show: Forwarding https://abc123.ngrok.io -> http://localhost:8000
# Use this URL in frontend: VITE_URL=https://abc123.ngrok.io
```

**Using localtunnel**:

```powershell
npm install -g localtunnel
lt --port 8000

# Output will show: https://your-subdomain.loca.lt
# Use this URL in frontend: VITE_URL=https://your-subdomain.loca.lt
```

**Advantages of tunnel services:**
- ✅ Automatic HTTPS (secure)
- ✅ No router configuration needed
- ✅ Works behind NAT/firewalls
- ✅ Easier to set up
- ⚠️ Free tiers have limitations (connection timeouts, bandwidth)

**Security Requirements for Internet Access:**

1. **Authentication & Authorization:**
   - ✅ Use strong JWT tokens
   - ✅ Implement proper user authentication
   - ✅ Use role-based access control (RBAC)
   - ✅ Validate all user inputs

2. **HTTPS/SSL:**
   - ✅ **REQUIRED**: Use HTTPS, not HTTP
   - ✅ Set up SSL certificate (Let's Encrypt is free)
   - ✅ Use reverse proxy (nginx) with SSL termination
   - ✅ Tunnel services (ngrok) provide HTTPS automatically

3. **Django Settings:**
   ```env
   DEBUG=False  # NEVER use True in production
   SECRET_KEY=strong-random-secret-key
   ALLOWED_HOSTS=your-domain.com,your-ip-address
   ```

4. **Additional Security Measures:**
   - ✅ Use rate limiting (django-ratelimit)
   - ✅ Enable CORS only for trusted origins
   - ✅ Use strong database passwords
   - ✅ Regular security updates
   - ✅ Monitor access logs
   - ✅ Use firewall rules
   - ✅ Consider using a VPN for admin access
   - ✅ Implement request validation
   - ✅ Use environment variables for secrets

5. **Recommended Setup:**
   - Use nginx as reverse proxy with SSL
   - Use gunicorn/uwsgi for production (not runserver)
   - Set up proper logging and monitoring
   - Use a proper database (PostgreSQL) with backups
   - Implement automated backups
   - Use a process manager (systemd, supervisor)

**Example Production Setup with nginx:**

```nginx
# /etc/nginx/sites-available/leadflow
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Step 6: Verify Backend is Running

Open your browser or use PowerShell:

```powershell
# Test health endpoint
Invoke-RestMethod -Uri "http://127.0.0.1:8000/health/"

# Or test API endpoint
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/contacts/" -Headers @{Authorization="Bearer YOUR_TOKEN"}
```

You should see responses from the backend.

## Part 2: Frontend Production Build

### Step 1: Install Frontend Dependencies

```powershell
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install
```

### Step 2: Configure Environment Variable

Create a `.env.production` file in the `frontend` directory:

```env
VITE_URL=http://127.0.0.1:8000
```

**Important**: This tells the production build to use your local backend.

### Step 3: Build Frontend for Production

```powershell
# Build production bundle
npm run build
```

This creates a `dist` folder with optimized production files.

### Step 4: Serve Frontend Production Build

You have several options to serve the production build:

#### Option A: Using Python HTTP Server (Simple)

```powershell
# Navigate to dist directory
cd dist

# Python 3
python -m http.server 3000

# Or Python 2
python -m SimpleHTTPServer 3000
```

Then open: `http://localhost:3000`

#### Option B: Using Node.js serve Package (Recommended)

```powershell
# Install serve globally
npm install -g serve

# Serve the dist folder
serve -s dist -l 3000
```

#### Option C: Using Vite Preview

Add to `frontend/package.json` scripts:

```json
"preview": "vite preview"
```

Then run:
```powershell
npm run preview
```

#### Option D: Using Django to Serve (Integrated)

You can also serve the frontend from Django. The backend is already configured to serve static files from `frontend/dist` if it exists.

1. Build the frontend: `npm run build`
2. The Django backend will automatically serve it at `http://127.0.0.1:8000`

## Part 3: Complete Setup Script

Create a PowerShell script `start-local.ps1` in the project root:

```powershell
# Start Local Self-Hosted Deployment
Write-Host "Starting Local Self-Hosted Deployment..." -ForegroundColor Green

# Check if backend is running
$backendRunning = $false
try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:8000/health/" -TimeoutSec 2 -ErrorAction Stop
    $backendRunning = $true
    Write-Host "Backend is already running!" -ForegroundColor Yellow
} catch {
    Write-Host "Starting backend..." -ForegroundColor Cyan
    
    # Start backend in new window
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; python manage.py runserver 127.0.0.1:8000"
    
    # Wait for backend to start
    Write-Host "Waiting for backend to start..." -ForegroundColor Cyan
    Start-Sleep -Seconds 5
}

# Build frontend
Write-Host "`nBuilding frontend..." -ForegroundColor Cyan
Set-Location frontend
npm run build

# Check if .env.production exists
if (-not (Test-Path ".env.production")) {
    Write-Host "Creating .env.production..." -ForegroundColor Yellow
    "VITE_URL=http://127.0.0.1:8000" | Out-File -FilePath ".env.production" -Encoding utf8
}

# Serve frontend
Write-Host "`nServing frontend on http://localhost:3000" -ForegroundColor Green
Write-Host "Backend is running on http://127.0.0.1:8000" -ForegroundColor Green
Write-Host "`nPress Ctrl+C to stop" -ForegroundColor Yellow

# Check if serve is installed
$serveInstalled = Get-Command serve -ErrorAction SilentlyContinue
if ($serveInstalled) {
    serve -s dist -l 3000
} else {
    Write-Host "Installing serve package..." -ForegroundColor Yellow
    npm install -g serve
    serve -s dist -l 3000
}
```

Run it with:
```powershell
.\start-local.ps1
```

## Part 4: Verification Checklist

After setup, verify everything works:

### Backend ✅
- [ ] Backend responds at `http://127.0.0.1:8000/health/`
- [ ] API endpoints work: `http://127.0.0.1:8000/api/contacts/`
- [ ] WebSocket connections work (if using Daphne)
- [ ] CORS headers are present in responses

### Frontend ✅
- [ ] Frontend loads at `http://localhost:3000` (or your chosen port)
- [ ] Browser console shows no CORS errors
- [ ] API calls go to `http://127.0.0.1:8000/api/...` (check Network tab)
- [ ] Login/authentication works
- [ ] WebSocket connections work (check browser console)

## Troubleshooting

### Backend Won't Start

1. **Port already in use:**
   ```powershell
   # Find process using port 8000
   netstat -ano | findstr :8000
   # Kill the process (replace PID)
   taskkill /PID <PID> /F
   ```

2. **Database connection error:**
   - Check `.env` file has correct database credentials
   - Ensure PostgreSQL is running (if using PostgreSQL)
   - Try SQLite for testing: set `USE_LOCAL_DB=0` in `.env`

3. **Missing dependencies:**
   ```powershell
   pip install -r requirements.txt
   ```

### Frontend Won't Connect to Backend

1. **Check VITE_URL:**
   - Ensure `.env.production` exists with `VITE_URL=http://127.0.0.1:8000`
   - Rebuild: `npm run build`

2. **CORS errors:**
   - Check backend `settings.py` has `CORS_ALLOW_ALL_ORIGINS = True`
   - Verify backend is running
   - Check browser console for specific CORS errors

3. **WebSocket errors:**
   - Ensure using Daphne (not runserver) for WebSocket support
   - Check `backend/backend/settings.py` channel layers configuration

### Frontend Build Errors

1. **Missing dependencies:**
   ```powershell
   cd frontend
   npm install
   ```

2. **Build fails:**
   ```powershell
   # Clear cache and rebuild
   Remove-Item -Recurse -Force node_modules
   npm install
   npm run build
   ```

## Quick Reference

### Backend Commands

```powershell
# Start backend (development)
cd backend
python manage.py runserver 127.0.0.1:8000

# Start backend (production-like with WebSockets)
cd backend
daphne -b 127.0.0.1 -p 8000 backend.asgi:application

# Run migrations
cd backend
python manage.py migrate

# Create superuser
cd backend
python manage.py createsuperuser
```

### Frontend Commands

```powershell
# Build production
cd frontend
npm run build

# Serve production build
cd frontend
serve -s dist -l 3000

# Or use Python
cd frontend/dist
python -m http.server 3000
```

### URLs

- **Backend API**: `http://127.0.0.1:8000/api/`
- **Backend Health**: `http://127.0.0.1:8000/health/`
- **Frontend**: `http://localhost:3000` (or your chosen port)

## Quick Setup Scripts

### For Localhost Only

```powershell
.\start-local.ps1
```

### For Internet Access

```powershell
.\start-internet.ps1
```

**Note:** The internet access script will:
- Warn you about security risks
- Check your configuration
- Set up firewall rules
- Display your public and local IP addresses
- Guide you through router port forwarding

See `INTERNET_ACCESS_SETUP.md` for complete internet access setup guide.

## Advanced: Expose Local Backend to Internet

If you want to test with a production frontend (e.g., on Vercel) but use your local backend:

### Using ngrok (Easiest)

```powershell
# Install ngrok: https://ngrok.com/download

# Expose local backend
ngrok http 8000

# Use the ngrok URL in Vercel VITE_URL environment variable
# Example: VITE_URL=https://abc123.ngrok.io
```

### Using localtunnel

```powershell
# Install localtunnel
npm install -g localtunnel

# Expose local backend
lt --port 8000

# Use the localtunnel URL in Vercel VITE_URL environment variable
```

### Direct Internet Access

See `INTERNET_ACCESS_SETUP.md` for complete guide on setting up direct internet access with proper security measures.

## Network Accessibility Summary

| Configuration | Accessible From | Security Level | Use Case |
|--------------|----------------|----------------|----------|
| `127.0.0.1:8000` | Same computer only | ✅ High | Local development |
| `0.0.0.0:8000` + Local IP | Local network (same WiFi) | ⚠️ Medium | Testing on multiple devices |
| `0.0.0.0:8000` + Port Forwarding | Entire internet | ⚠️ Low-Medium* | Production (with proper security) |
| ngrok/localtunnel | Internet (via tunnel) | ⚠️ Medium | Temporary testing or production |

*Security level depends on implemented security measures (HTTPS, authentication, rate limiting, etc.)

## Notes

- The backend CORS is configured to allow all origins (`CORS_ALLOW_ALL_ORIGINS = True`), so it will accept requests from any frontend URL
- WebSocket support requires Daphne (not Django's runserver)
- **Security**: Binding to `0.0.0.0` makes your backend accessible on your network. Only do this on trusted networks.
- **Firewall**: Windows Firewall may block incoming connections. You may need to allow port 8000.
- For production use, consider:
  - Using a reverse proxy (nginx)
  - Setting up SSL/TLS certificates
  - Using environment-specific settings
  - Setting up proper logging and monitoring
  - Using proper authentication and authorization
  - Implementing rate limiting


