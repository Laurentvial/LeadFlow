# PowerShell script to SSH into server and start backend
# Usage: .\start-server-ssh.ps1

$serverIP = "82.165.44.164"
$serverPort = "22"  # Standard SSH port (8443 is HTTPS, not SSH)
$username = "root"
$projectPath = "/var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "LeadFlow Backend Startup Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Server: $serverIP" -ForegroundColor Yellow
Write-Host "Username: $username" -ForegroundColor Yellow
Write-Host ""

# Upload the startup script to server
Write-Host "Step 1: Uploading startup script to server..." -ForegroundColor Cyan

# Create a temporary script content
$scriptContent = Get-Content -Path "start-backend-on-server.sh" -Raw

# Try to upload using SCP (will prompt for password)
Write-Host "Uploading script to server..." -ForegroundColor Yellow
Write-Host "You will be prompted for password: $password" -ForegroundColor Yellow
Write-Host ""

# Use SSH to upload and execute
$sshCommand = @"
bash -s << 'EOF'
cd $projectPath || cd /var/www/vhosts/*/httpdocs || cd ~
pwd
ls -la backend/ 2>/dev/null || echo "Backend directory not found in current location"
python3 --version || python --version
python3 -m pip list | grep daphne || python -m pip list | grep daphne || echo "daphne not found in pip list"
cd backend 2>/dev/null && {
    echo "Found backend directory"
    if pgrep -f "daphne.*backend.asgi" > /dev/null; then
        echo "Backend is already running. Stopping..."
        pkill -f "daphne.*backend.asgi"
        sleep 2
    fi
    echo "Starting backend with Daphne..."
    nohup python3 -m daphne -b 0.0.0.0 -p 8000 backend.asgi:application > /tmp/daphne.log 2>&1 &
    DAPHNE_PID=`$!
    echo "Backend started with PID: `$DAPHNE_PID"
    sleep 3
    if ps -p `$DAPHNE_PID > /dev/null 2>&1; then
        echo "✅ Backend is running!"
        echo "PID: `$DAPHNE_PID"
        echo "Logs: /tmp/daphne.log"
        tail -n 20 /tmp/daphne.log
    else
        echo "❌ Backend failed to start. Check logs:"
        cat /tmp/daphne.log
    fi
} || {
    echo "Error: Could not find or access backend directory"
    echo "Current directory:"
    pwd
    echo "Contents:"
    ls -la
}
EOF
"@

Write-Host "Step 2: Connecting to server and starting backend..." -ForegroundColor Cyan
Write-Host ""
Write-Host "You will be prompted to enter the password: $password" -ForegroundColor Yellow
Write-Host ""
Write-Host "Running command..." -ForegroundColor Green
Write-Host ""

# Execute SSH command
$sshCommand | ssh -p $serverPort $username@$serverIP

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Connection closed." -ForegroundColor Cyan
Write-Host ""
Write-Host "To check backend status, SSH to server and run:" -ForegroundColor Yellow
Write-Host "  ps aux | grep daphne" -ForegroundColor Cyan
Write-Host "  tail -f /tmp/daphne.log" -ForegroundColor Cyan
Write-Host ""

