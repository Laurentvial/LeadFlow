# Start Backend for Internet Access
# WARNING: This makes your backend accessible from anywhere in the world
# Ensure you have proper security measures in place!

Write-Host "========================================" -ForegroundColor Red
Write-Host "  INTERNET ACCESS SETUP" -ForegroundColor Red
Write-Host "========================================" -ForegroundColor Red
Write-Host ""
Write-Host "WARNING: This will make your backend accessible from the internet!" -ForegroundColor Yellow
Write-Host "Ensure you have:" -ForegroundColor Yellow
Write-Host "  - DEBUG=False in .env" -ForegroundColor Yellow
Write-Host "  - Strong SECRET_KEY" -ForegroundColor Yellow
Write-Host "  - HTTPS/SSL configured" -ForegroundColor Yellow
Write-Host "  - Proper authentication" -ForegroundColor Yellow
Write-Host "  - Rate limiting enabled" -ForegroundColor Yellow
Write-Host ""
$confirm = Read-Host "Do you want to continue? (yes/no)"
if ($confirm -ne "yes") {
    Write-Host "Aborted." -ForegroundColor Red
    exit 1
}

# Function to check if a port is in use
function Test-Port {
    param([int]$Port)
    $connection = Test-NetConnection -ComputerName localhost -Port $Port -WarningAction SilentlyContinue -InformationLevel Quiet
    return $connection
}

# Get public IP
Write-Host ""
Write-Host "Getting your public IP address..." -ForegroundColor Cyan
try {
    $publicIP = Invoke-RestMethod -Uri "https://api.ipify.org" -TimeoutSec 5
    Write-Host "Your public IP: $publicIP" -ForegroundColor Green
} catch {
    Write-Host "Could not get public IP. You may need to check manually." -ForegroundColor Yellow
    $publicIP = "YOUR_PUBLIC_IP"
}

# Get local IP
Write-Host ""
Write-Host "Getting your local IP address..." -ForegroundColor Cyan
$localIPs = Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.InterfaceAlias -notlike "*Loopback*"}
if ($localIPs) {
    $localIP = $localIPs[0].IPAddress
    Write-Host "Your local IP: $localIP" -ForegroundColor Green
} else {
    Write-Host "Could not determine local IP." -ForegroundColor Yellow
    $localIP = "YOUR_LOCAL_IP"
}

# Check backend configuration
Write-Host ""
Write-Host "Checking backend configuration..." -ForegroundColor Cyan

if (-not (Test-Path "backend\.env")) {
    Write-Host "WARNING: backend\.env not found!" -ForegroundColor Yellow
    Write-Host "Creating template .env file..." -ForegroundColor Yellow
    
    $envContent = @"
# Django Settings
SECRET_KEY=CHANGE-THIS-TO-A-STRONG-RANDOM-SECRET-KEY-MINIMUM-50-CHARACTERS
DEBUG=False
ALLOWED_HOSTS=*

# Database Configuration
USE_LOCAL_DB=1
DB_NAME=leadflow
DB_USER=postgres
DB_PASSWORD=yourpassword
DB_HOST=localhost
DB_PORT=5432

# CORS Settings
CSRF_TRUSTED_ORIGINS=https://$publicIP,http://$publicIP
"@
    $envContent | Out-File -FilePath "backend\.env" -Encoding utf8
    Write-Host "Created backend\.env - PLEASE UPDATE SECRET_KEY AND OTHER SETTINGS!" -ForegroundColor Red
} else {
    $envContent = Get-Content "backend\.env" -Raw
    if ($envContent -match "DEBUG=True") {
        Write-Host "WARNING: DEBUG=True found in .env! This is unsafe for internet access!" -ForegroundColor Red
        Write-Host "Please set DEBUG=False before continuing." -ForegroundColor Red
        $continue = Read-Host "Continue anyway? (yes/no)"
        if ($continue -ne "yes") {
            exit 1
        }
    }
    if ($envContent -notmatch "ALLOWED_HOSTS=\*") {
        Write-Host "INFO: ALLOWED_HOSTS is restricted. Consider using ALLOWED_HOSTS=* for internet access." -ForegroundColor Yellow
    }
}

# Check if backend is already running
Write-Host ""
Write-Host "Checking if backend is already running..." -ForegroundColor Cyan
$backendRunning = Test-Port -Port 8000

if ($backendRunning) {
    Write-Host "Backend is already running on port 8000" -ForegroundColor Green
    $restart = Read-Host "Restart backend? (yes/no)"
    if ($restart -eq "yes") {
        Write-Host "Stopping existing backend..." -ForegroundColor Yellow
        $process = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -First 1
        if ($process) {
            Stop-Process -Id $process -Force
            Start-Sleep -Seconds 2
        }
        $backendRunning = $false
    }
}

if (-not $backendRunning) {
    Write-Host ""
    Write-Host "Starting backend server..." -ForegroundColor Cyan
    
    if (-not (Test-Path "backend\manage.py")) {
        Write-Host "ERROR: backend\manage.py not found. Please run this script from the project root." -ForegroundColor Red
        exit 1
    }
    
    Write-Host "Opening backend server in new window..." -ForegroundColor Cyan
    Write-Host "Backend will be accessible at:" -ForegroundColor Green
    Write-Host "  Local: http://127.0.0.1:8000" -ForegroundColor Cyan
    Write-Host "  Network: http://$localIP:8000" -ForegroundColor Cyan
    Write-Host "  Internet: http://$publicIP:8000 (if port forwarding configured)" -ForegroundColor Cyan
    Write-Host ""
    
    # Start backend bound to all interfaces
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\backend'; Write-Host 'Starting Django backend server for INTERNET ACCESS...' -ForegroundColor Green; Write-Host 'Backend accessible on: http://0.0.0.0:8000' -ForegroundColor Yellow; python manage.py runserver 0.0.0.0:8000"
    
    Write-Host "Waiting for backend to start (5 seconds)..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5
    
    # Verify backend started
    $backendRunning = Test-Port -Port 8000
    if (-not $backendRunning) {
        Write-Host "WARNING: Backend may not have started. Check the backend window for errors." -ForegroundColor Yellow
    } else {
        Write-Host "✓ Backend started successfully" -ForegroundColor Green
    }
}

# Configure firewall
Write-Host ""
Write-Host "Checking Windows Firewall..." -ForegroundColor Cyan
$firewallRule = Get-NetFirewallRule -DisplayName "Django Backend Internet" -ErrorAction SilentlyContinue
if (-not $firewallRule) {
    Write-Host "Creating firewall rule for port 8000..." -ForegroundColor Yellow
    try {
        New-NetFirewallRule -DisplayName "Django Backend Internet" -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow -ErrorAction Stop
        Write-Host "✓ Firewall rule created" -ForegroundColor Green
    } catch {
        Write-Host "WARNING: Could not create firewall rule. You may need to run as Administrator." -ForegroundColor Yellow
        Write-Host "Error: $_" -ForegroundColor Red
    }
} else {
    Write-Host "✓ Firewall rule already exists" -ForegroundColor Green
}

# Display summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Backend URLs:" -ForegroundColor Cyan
Write-Host "  Local:      http://127.0.0.1:8000" -ForegroundColor White
Write-Host "  Network:    http://$localIP:8000" -ForegroundColor White
Write-Host "  Internet:   http://$publicIP:8000" -ForegroundColor White
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Configure router port forwarding:" -ForegroundColor White
Write-Host "   - External Port: 8000" -ForegroundColor Gray
Write-Host "   - Internal IP: $localIP" -ForegroundColor Gray
Write-Host "   - Internal Port: 8000" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Set up HTTPS/SSL (REQUIRED for production):" -ForegroundColor White
Write-Host "   - See INTERNET_ACCESS_SETUP.md for details" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Update frontend .env.production:" -ForegroundColor White
Write-Host "   VITE_URL=http://$publicIP:8000" -ForegroundColor Gray
Write-Host "   (Or use your domain if you have one)" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Test accessibility:" -ForegroundColor White
Write-Host "   Invoke-RestMethod -Uri 'http://$publicIP:8000/health/'" -ForegroundColor Gray
Write-Host ""
Write-Host "Security Reminders:" -ForegroundColor Red
Write-Host "  - Ensure DEBUG=False" -ForegroundColor Yellow
Write-Host "  - Use strong SECRET_KEY" -ForegroundColor Yellow
Write-Host "  - Set up HTTPS/SSL" -ForegroundColor Yellow
Write-Host "  - Enable rate limiting" -ForegroundColor Yellow
Write-Host "  - Monitor access logs" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")


