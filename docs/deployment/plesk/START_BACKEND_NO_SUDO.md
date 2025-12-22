# Start Backend Without Sudo Access

If you don't have `sudo` access, use **Passenger** (managed by Plesk) - it's the easiest option!

## ✅ Option 1: Using Passenger (EASIEST - No sudo needed!)

This is the recommended method if you don't have sudo access.

### Steps:

1. **Open Plesk Panel** → Go to your domain
2. **Hosting & DNS** → **Python**
3. **Enable Python** (toggle switch)
4. Set **Application root** to: `/backend`
5. Set **Application startup file** to: `passenger_wsgi.py`
6. Click **Apply** or **OK**

**That's it!** Plesk will automatically:
- Start your backend
- Keep it running
- Restart it if it crashes
- Manage it for you

### Verify it's working:

```bash
# Check if Passenger is running
ps aux | grep passenger

# Test the API
curl http://127.0.0.1:8000/api/health/
```

### Troubleshooting Passenger:

- **Python not available?** Contact your hosting provider to enable Python support
- **Application not starting?** Check **Python** → **Logs** in Plesk
- **Need to restart?** Click **Restart** button in Plesk Python settings

---

## Option 2: Create Service File Without Sudo (If you want systemd)

If you still want to use systemd but don't have sudo, you can create the file and ask your hosting provider to move it:

### Step 1: Create the file in your home directory

```bash
# Find your username
whoami

# Create the service file locally
cat > ~/leadflow.service << 'EOF'
[Unit]
Description=LeadFlow Django ASGI Application
After=network.target postgresql.service

[Service]
Type=simple
User=YOUR_USERNAME_HERE
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
```

**Replace `YOUR_USERNAME_HERE` with your actual username from `whoami`**

### Step 2: Ask your hosting provider

Contact your hosting provider and ask them to:
1. Copy `~/leadflow.service` to `/etc/systemd/system/leadflow.service`
2. Run: `systemctl daemon-reload`
3. Run: `systemctl enable leadflow`
4. Run: `systemctl start leadflow`

---

## Option 3: Use `screen` or `tmux` (Temporary solution)

This keeps the backend running after closing terminal, but it won't auto-start on reboot:

```bash
# Install screen (if not available)
# On CentOS/RHEL:
yum install screen -y
# On Ubuntu/Debian:
apt-get install screen -y

# Start a screen session
screen -S django

# Navigate to backend
cd /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs/backend

# Start backend
python3.12 -m daphne -b 127.0.0.1 -p 8000 backend.asgi:application

# Detach from screen: Press Ctrl+A, then press D
# Your backend will keep running!

# To reattach later:
screen -r django

# To see all screen sessions:
screen -ls
```

**Note:** This is temporary - if the server reboots, you'll need to start it again manually.

---

## 🎯 Recommended: Use Passenger (Option 1)

**Why Passenger is best:**
- ✅ No sudo needed
- ✅ Managed by Plesk
- ✅ Auto-restarts on crash
- ✅ Auto-starts on server reboot
- ✅ Easy to manage via Plesk UI
- ✅ Built-in logging

**Just enable Python in Plesk and you're done!**

