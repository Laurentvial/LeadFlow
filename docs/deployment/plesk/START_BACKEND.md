# Start Django Backend - Fix 502 Bad Gateway

## Problem
**502 Bad Gateway** means nginx can't reach the Django backend at `http://127.0.0.1:8000`.

## Quick Check

```bash
# Check if anything is running on port 8000
netstat -tulpn | grep :8000
# Or
ss -tulpn | grep :8000

# Check if Django process is running
ps aux | grep python
ps aux | grep daphne
```

## Solution: Start the Backend

### Option 1: Using Passenger (Recommended - Automatic)

**If Python is enabled in Plesk:**
1. **Hosting & DNS** → **Python**
2. Ensure Python is **enabled**
3. Set **Application root** to: `/backend`
4. Set **Application startup file** to: `passenger_wsgi.py`
5. Plesk will automatically start the application

**Check if Passenger is running:**
```bash
ps aux | grep passenger
```

### Option 2: Using Systemd Service (Recommended for Production)

**Step 1: Create Service File**

```bash
# Edit the service file
nano /etc/systemd/system/leadflow.service
```

**Step 2: Copy this content (update paths):**

```ini
[Unit]
Description=LeadFlow Django ASGI Application
After=network.target postgresql.service

[Service]
Type=simple
User=blissful-spence_81c8zbi6itn
Group=psacln

# Working directory
WorkingDirectory=/var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs/backend

# Environment
Environment="PATH=/usr/bin:/usr/local/bin:/bin"
Environment="DJANGO_SETTINGS_MODULE=backend.settings"

# Load environment variables from .env file
EnvironmentFile=/var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs/.env

# Command to start the application
ExecStart=/usr/bin/python3.12 -m daphne -b 127.0.0.1 -p 8000 backend.asgi:application

# Restart policy
Restart=always
RestartSec=10

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=leadflow

[Install]
WantedBy=multi-user.target
```

**Step 3: Enable and Start Service**

```bash
# Reload systemd
systemctl daemon-reload

# Enable service (start on boot)
systemctl enable leadflow

# Start service
systemctl start leadflow

# Check status
systemctl status leadflow

# View logs
journalctl -u leadflow -f
```

### Option 3: Manual Start (Testing/Temporary)

**Start backend manually:**

```bash
cd /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs/backend

# Load environment variables if using .env file
export $(cat ../.env | xargs)

# Start with Daphne (ASGI)
python3.12 -m daphne -b 127.0.0.1 -p 8000 backend.asgi:application
```

**Or use the startup script:**

```bash
cd /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs
chmod +x docs/deployment/plesk/plesk-start.sh
bash docs/deployment/plesk/plesk-start.sh
```

**Note:** This runs in foreground. Use `screen` or `tmux` to keep it running:

```bash
# Install screen
dnf install -y screen

# Start in screen session
screen -S django
cd /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs/backend
python3.12 -m daphne -b 127.0.0.1 -p 8000 backend.asgi:application

# Detach: Press Ctrl+A then D
# Reattach: screen -r django
```

### Option 4: Using Gunicorn (WSGI - No WebSockets)

If you don't need WebSocket support:

```bash
cd /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs/backend

# Start with Gunicorn
python3.12 -m gunicorn backend.wsgi:application --bind 127.0.0.1:8000 --workers 3
```

## Verify Backend is Running

```bash
# Check if port 8000 is listening
netstat -tulpn | grep :8000

# Test API endpoint locally
curl http://127.0.0.1:8000/api/health/

# Check process
ps aux | grep daphne
ps aux | grep gunicorn
```

## Troubleshooting

### "ModuleNotFoundError" or Import Errors

```bash
# Make sure dependencies are installed
cd backend
python3.12 -m pip install --user -r requirements.txt
```

### "Port already in use"

```bash
# Find what's using port 8000
lsof -i :8000
# Or
netstat -tulpn | grep :8000

# Kill the process
kill -9 <PID>
```

### "Database connection error"

1. Check database credentials in `.env` file
2. Verify PostgreSQL is running: `systemctl status postgresql`
3. Test connection: `psql -U your_db_user -d your_db_name -h localhost`

### "Permission denied"

```bash
# Check file permissions
ls -la backend/
chmod +x backend/manage.py

# Check if user has access
whoami
```

## Recommended Setup

**For Production:**
- Use **systemd service** (Option 2) - auto-restarts, logs to journal
- Or use **Passenger** (Option 1) - managed by Plesk

**For Testing:**
- Use **manual start** (Option 3) - easier to debug

## After Starting Backend

1. **Test API:**
   ```bash
   curl http://127.0.0.1:8000/api/health/
   ```

2. **Test via browser:**
   - Visit: `https://blissful-spence.82-165-44-164.plesk.page/api/health/`
   - Should return JSON response

3. **Check logs:**
   ```bash
   # If using systemd
   journalctl -u leadflow -f
   
   # Or check nginx error logs
   tail -f /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/logs/error_log
   ```

