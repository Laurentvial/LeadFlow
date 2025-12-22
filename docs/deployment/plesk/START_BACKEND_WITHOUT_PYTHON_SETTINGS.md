# Start Backend Without Python Settings in Plesk

If Python settings are not available in your Plesk panel, use one of these methods:

## ✅ Option 1: Use `screen` (Works without sudo, keeps running)

This is the quickest solution that works immediately.

### Step 1: Check if screen is installed

```bash
which screen
```

If it says "command not found", try to install it (may require hosting provider):

```bash
# Try this first (no sudo needed)
screen --version

# If not available, contact your hosting provider to install it
```

### Step 2: Start backend in screen session

```bash
# Start a new screen session named "django"
screen -S django

# Navigate to backend directory
cd /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs/backend

# Start the backend
python3.12 -m daphne -b 127.0.0.1 -p 8000 backend.asgi:application
```

### Step 3: Detach from screen (keep it running)

- Press: `Ctrl+A` then press `D` (capital D)
- This detaches from screen but keeps the backend running
- You can now close your terminal!

### Step 4: Verify it's running

```bash
# Check if port 8000 is listening
netstat -tulpn | grep :8000

# Test the API
curl http://127.0.0.1:8000/api/health/
```

### Useful screen commands:

```bash
# List all screen sessions
screen -ls

# Reattach to the django session
screen -r django

# Kill a screen session (when attached)
# Press Ctrl+A then K, then Y to confirm

# Or kill from outside:
screen -X -S django quit
```

**Note:** If the server reboots, you'll need to start it again manually.

---

## Option 2: Use `nohup` (Alternative, simpler)

If `screen` is not available, use `nohup`:

```bash
cd /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs/backend

# Start backend with nohup (runs in background)
nohup python3.12 -m daphne -b 127.0.0.1 -p 8000 backend.asgi:application > backend.log 2>&1 &

# Check if it's running
ps aux | grep daphne

# View logs
tail -f backend.log

# Stop it later
pkill -f "daphne.*backend.asgi"
```

---

## Option 3: Contact Your Hosting Provider

Ask them to:

1. **Enable Python support in Plesk** (if available)
   - They may need to install the Python extension
   - Or enable it for your account

2. **OR set up a systemd service** for you:
   - Create `/etc/systemd/system/leadflow.service`
   - Enable and start the service
   - This will auto-start on reboot

3. **OR install `screen` or `tmux`** if not available

---

## Option 4: Create a Startup Script (with cron)

Create a script that starts the backend automatically:

### Step 1: Create startup script

```bash
cat > ~/start-backend.sh << 'EOF'
#!/bin/bash
cd /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs/backend

# Check if already running
if pgrep -f "daphne.*backend.asgi" > /dev/null; then
    echo "Backend is already running"
    exit 0
fi

# Start backend
nohup python3.12 -m daphne -b 127.0.0.1 -p 8000 backend.asgi:application > ~/backend.log 2>&1 &
echo "Backend started. PID: $!"
EOF

chmod +x ~/start-backend.sh
```

### Step 2: Run it manually

```bash
~/start-backend.sh
```

### Step 3: Add to cron (runs on server boot)

```bash
# Edit your crontab
crontab -e

# Add this line (runs 2 minutes after boot)
@reboot sleep 120 && /home/YOUR_USERNAME/start-backend.sh

# Replace YOUR_USERNAME with your actual username
```

---

## Quick Comparison

| Method | Auto-start on reboot? | Requires sudo? | Easiest? |
|--------|----------------------|----------------|----------|
| **screen** | ❌ No | ❌ No | ✅ Yes |
| **nohup** | ❌ No | ❌ No | ✅ Yes |
| **systemd** | ✅ Yes | ✅ Yes | ❌ No |
| **Passenger** | ✅ Yes | ❌ No | ✅ Yes (if available) |
| **cron + script** | ✅ Yes | ❌ No | ⚠️ Medium |

---

## Recommended: Start with `screen`

**For immediate use:**
```bash
screen -S django
cd /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs/backend
python3.12 -m daphne -b 127.0.0.1 -p 8000 backend.asgi:application
# Press Ctrl+A then D to detach
```

**Then contact your hosting provider** to:
- Enable Python support in Plesk (best long-term solution)
- OR set up systemd service (good alternative)

---

## Troubleshooting

### "screen: command not found"

Contact your hosting provider to install screen:
```bash
# They would run (requires sudo):
yum install screen -y
# or
apt-get install screen -y
```

### Backend stops after closing terminal

Make sure you **detached** from screen properly:
- Press `Ctrl+A` then `D` (not just closing terminal)
- Or use `nohup` method instead

### Port 8000 already in use

```bash
# Find what's using it
netstat -tulpn | grep :8000

# Kill it (replace PID with actual process ID)
kill -9 <PID>
```

### Backend not responding

```bash
# Check if it's running
ps aux | grep daphne

# Check logs (if using nohup)
tail -f ~/backend.log

# Or if using screen, reattach and check
screen -r django
```

