# Setup Systemd Service for LeadFlow Backend

This guide will help you set up the backend to run automatically as a system service, so it stays running even after closing your terminal.

## Step 1: Find Your Plesk Username

SSH into your server and run:
```bash
whoami
```

Or check the owner of your httpdocs folder:
```bash
ls -la /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs/ | head -5
```

The username is typically something like `blissful-spence_81c8zbi6itn` (your-domain_randomstring).

## Step 2: Find Python 3.12 Path

Check where Python 3.12 is installed:
```bash
which python3.12
# Or
/opt/plesk/python/3.12/bin/python3.12 --version
# Or
/usr/bin/python3.12 --version
```

## Step 3: Create the Systemd Service File

**Choose one method below based on what you have access to:**

### Method 1: Using `cat` (No sudo/nano needed)

```bash
cat > /tmp/leadflow.service << 'EOF'
[Unit]
Description=LeadFlow Django ASGI Application
After=network.target postgresql.service

[Service]
Type=simple
User=your-plesk-user
Group=psacln
WorkingDirectory=/var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs/backend
Environment="PATH=/usr/bin:/usr/local/bin:/bin"
Environment="DJANGO_SETTINGS_MODULE=backend.settings"
ExecStart=/usr/bin/python3.12 -m daphne -b 127.0.0.1 -p 8000 backend.asgi:application
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=leadflow

[Install]
WantedBy=multi-user.target
EOF

# Then copy it (requires sudo or ask your hosting provider)
sudo cp /tmp/leadflow.service /etc/systemd/system/leadflow.service
```

**Replace `your-plesk-user` with your actual username before running!**

### Method 2: Using `vi` or `vim` (if available)

```bash
sudo vi /etc/systemd/system/leadflow.service
# Or
sudo vim /etc/systemd/system/leadflow.service
```

**vi/vim commands:**
- Press `i` to enter insert mode
- Paste the content
- Press `Esc` then type `:wq` and press Enter to save and quit

### Method 3: Using Plesk File Manager

1. **Plesk Panel** → **Files** → Navigate to `/etc/systemd/system/`
2. Click **Upload** → Upload `leadflow.service` file
3. Or create new file → Paste content → Save

### Method 4: Create locally and upload via SFTP

1. Create `leadflow.service` file on your computer with the content below
2. Upload via SFTP/FTP to `/etc/systemd/system/leadflow.service`
3. Set permissions: `chmod 644 /etc/systemd/system/leadflow.service`

### Method 5: Ask your hosting provider

If you don't have sudo access, contact your hosting provider and ask them to create the systemd service file for you. Provide them with the configuration below.

## Step 4: Copy This Configuration

**Replace the following values:**
- `your-plesk-user` → Your actual Plesk username (from Step 1)
- `/opt/plesk/python/3.12/bin/daphne` → Path to daphne (usually `/usr/bin/python3.12 -m daphne` or `/opt/plesk/python/3.12/bin/daphne`)

```ini
[Unit]
Description=LeadFlow Django ASGI Application
After=network.target postgresql.service

[Service]
Type=simple
User=your-plesk-user
Group=psacln

# Working directory
WorkingDirectory=/var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs/backend

# Environment
Environment="PATH=/usr/bin:/usr/local/bin:/bin"
Environment="DJANGO_SETTINGS_MODULE=backend.settings"

# Load environment variables from .env file (if you have one)
EnvironmentFile=/var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs/.env

# Command to start the application
# Try this first (most common):
ExecStart=/usr/bin/python3.12 -m daphne -b 127.0.0.1 -p 8000 backend.asgi:application

# If that doesn't work, try:
# ExecStart=/opt/plesk/python/3.12/bin/daphne -b 127.0.0.1 -p 8000 backend.asgi:application

# Restart policy - automatically restart if it crashes
Restart=always
RestartSec=10

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=leadflow

# Security
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

**Important:** 
- If you don't have a `.env` file, comment out or remove the `EnvironmentFile` line
- Make sure the `User` matches your Plesk username exactly
- The `ExecStart` path must point to the correct Python/daphne installation

## Step 5: Enable and Start the Service

```bash
# Reload systemd to recognize the new service
sudo systemctl daemon-reload

# Enable the service (start automatically on boot)
sudo systemctl enable leadflow

# Start the service now
sudo systemctl start leadflow

# Check if it's running
sudo systemctl status leadflow
```

## Step 6: Verify It's Working

```bash
# Check if port 8000 is listening
netstat -tulpn | grep :8000

# Test the API endpoint
curl http://127.0.0.1:8000/api/health/

# View logs (press Ctrl+C to exit)
sudo journalctl -u leadflow -f
```

## Common Commands

```bash
# Start the service
sudo systemctl start leadflow

# Stop the service
sudo systemctl stop leadflow

# Restart the service (after code changes)
sudo systemctl restart leadflow

# Check status
sudo systemctl status leadflow

# View logs
sudo journalctl -u leadflow -f

# View last 50 lines of logs
sudo journalctl -u leadflow -n 50
```

## Troubleshooting

### Service fails to start

1. **Check the logs:**
   ```bash
   sudo journalctl -u leadflow -n 50
   ```

2. **Common issues:**
   - **Wrong user:** Make sure the `User` in the service file matches your Plesk username
   - **Wrong Python path:** Verify the `ExecStart` command works manually
   - **Missing dependencies:** Make sure daphne is installed: `python3.12 -m pip install daphne`
   - **Permission denied:** Check file permissions in the backend directory

3. **Test the command manually:**
   ```bash
   cd /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs/backend
   /usr/bin/python3.12 -m daphne -b 127.0.0.1 -p 8000 backend.asgi:application
   ```
   If this works, the service should work too.

### Port already in use

If port 8000 is already in use:
```bash
# Find what's using it
sudo lsof -i :8000
# Or
sudo netstat -tulpn | grep :8000

# Kill the process (replace PID with actual process ID)
sudo kill -9 <PID>
```

### Environment variables not loading

If your `.env` file isn't being loaded:
1. Make sure the path in `EnvironmentFile` is correct
2. Check file permissions: `ls -la /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs/.env`
3. You can also set environment variables directly in the service file:
   ```ini
   Environment="SECRET_KEY=your-secret-key"
   Environment="DEBUG=False"
   ```

## Alternative: Using Passenger (Easier, but less control)

If you prefer a simpler setup managed by Plesk:

1. **Plesk Panel** → **Hosting & DNS** → **Python**
2. Enable Python
3. Set **Application root** to: `/backend`
4. Set **Application startup file** to: `passenger_wsgi.py`
5. Plesk will automatically start and manage the application

## Success!

Once the service is running:
- ✅ Backend will start automatically on server reboot
- ✅ Backend will restart automatically if it crashes
- ✅ You can close your terminal - backend keeps running
- ✅ Logs are available via `journalctl`

Test your API:
```
https://blissful-spence.82-165-44-164.plesk.page/api/health/
```

