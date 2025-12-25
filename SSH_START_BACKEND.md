# Instructions to Start Backend on Server

## Server Details
- **IP**: 82.165.44.164
- **Port**: 22 (SSH) - Note: Port 8443 is HTTPS, not SSH
- **Username**: root

## Method 1: Manual SSH Connection (Recommended)

### Step 1: Connect via SSH
Open PowerShell or Command Prompt and run:
```powershell
ssh root@82.165.44.164
```

### Step 2: Navigate to Project Directory
```bash
cd /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs/backend
```

If that path doesn't exist, try:
```bash
cd /var/www/vhosts/*/httpdocs/backend
# or
find /var/www -name "manage.py" -type f 2>/dev/null | head -1 | xargs dirname
```

### Step 3: Check Python and Dependencies
```bash
python3 --version
python3 -m pip list | grep daphne
```

If daphne is not installed:
```bash
python3 -m pip install daphne
```

### Step 4: Stop Existing Backend (if running)
```bash
pkill -f "daphne.*backend.asgi"
```

### Step 5: Start Backend with Daphne
```bash
cd /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs/backend
nohup python3 -m daphne -b 0.0.0.0 -p 8000 backend.asgi:application > /tmp/daphne.log 2>&1 &
```

### Step 6: Verify Backend is Running
```bash
# Check process
ps aux | grep daphne | grep -v grep

# View logs
tail -f /tmp/daphne.log

# Check if port 8000 is listening
netstat -tulpn | grep :8000
```

## Method 2: Using the Provided Script

### Option A: Copy script to server and run
1. Upload `start-backend-on-server.sh` to the server
2. SSH into server
3. Make it executable: `chmod +x start-backend-on-server.sh`
4. Run it: `./start-backend-on-server.sh`

### Option B: Run script directly via SSH
```powershell
# In PowerShell (will prompt for password)
Get-Content start-backend-on-server.sh | ssh root@82.165.44.164 bash
```

## Method 3: One-Line Command (Copy-paste after SSH login)

After connecting via SSH, run this single command:
```bash
cd /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs/backend && pkill -f "daphne.*backend.asgi" 2>/dev/null; nohup python3 -m daphne -b 0.0.0.0 -p 8000 backend.asgi:application > /tmp/daphne.log 2>&1 & sleep 3 && ps aux | grep daphne | grep -v grep && echo "✅ Backend started! Logs: /tmp/daphne.log"
```

## Troubleshooting

### If backend directory not found:
```bash
# Find the project
find /var/www -name "manage.py" -type f 2>/dev/null
find /home -name "manage.py" -type f 2>/dev/null
```

### If Python not found:
```bash
which python3
which python
# Try: python3.12 or python3.11
```

### If daphne not installed:
```bash
python3 -m pip install daphne
# or
pip3 install daphne
```

### View backend logs:
```bash
tail -f /tmp/daphne.log
```

### Stop backend:
```bash
pkill -f "daphne.*backend.asgi"
# or find PID and kill
ps aux | grep daphne
kill <PID>
```

### Check if backend is accessible:
```bash
curl http://localhost:8000/api/health/
curl http://127.0.0.1:8000/api/health/
```

## Keep Backend Running After SSH Disconnect

The `nohup` command already handles this, but you can also use:
- **screen**: `screen -S django` then start backend, press Ctrl+A then D to detach
- **tmux**: `tmux new -s django` then start backend, press Ctrl+B then D to detach

