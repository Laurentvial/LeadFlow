# Start Local Self-Hosted Deployment
# This script starts the backend and serves the frontend production build

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Local Self-Hosted Deployment" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Function to check if a port is in use
function Test-Port {
    param([int]$Port)
    $connection = Test-NetConnection -ComputerName localhost -Port $Port -WarningAction SilentlyContinue -InformationLevel Quiet
    return $connection
}

# Check if backend is already running
Write-Host "Checking backend status..." -ForegroundColor Yellow
$backendRunning = Test-Port -Port 8000

if ($backendRunning) {
    Write-Host "✓ Backend is already running on port 8000" -ForegroundColor Green
} else {
    Write-Host "Starting backend server..." -ForegroundColor Cyan
    
    # Check if we're in the right directory
    if (-not (Test-Path "backend\manage.py")) {
        Write-Host "ERROR: backend\manage.py not found. Please run this script from the project root." -ForegroundColor Red
        exit 1
    }
    
    # Start backend in new window
    Write-Host "Opening backend server in new window..." -ForegroundColor Cyan
    Write-Host "Note: Backend will run on 127.0.0.1:8000 (localhost only)" -ForegroundColor Yellow
    Write-Host "For network access, edit this script to use 0.0.0.0:8000" -ForegroundColor Yellow
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\backend'; Write-Host 'Starting Django backend server on 127.0.0.1:8000 (localhost only)...' -ForegroundColor Green; python manage.py runserver 127.0.0.1:8000"
    
    # Wait for backend to start
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

# Build frontend
Write-Host ""
Write-Host "Building frontend for production..." -ForegroundColor Cyan

if (-not (Test-Path "frontend\package.json")) {
    Write-Host "ERROR: frontend\package.json not found. Please run this script from the project root." -ForegroundColor Red
    exit 1
}

Set-Location frontend

# Check if .env.production exists
if (-not (Test-Path ".env.production")) {
    Write-Host "Creating .env.production file..." -ForegroundColor Yellow
    "VITE_URL=http://127.0.0.1:8000" | Out-File -FilePath ".env.production" -Encoding utf8
    Write-Host "✓ Created .env.production with VITE_URL=http://127.0.0.1:8000" -ForegroundColor Green
} else {
    Write-Host "✓ .env.production already exists" -ForegroundColor Green
    # Check if VITE_URL is set correctly
    $envContent = Get-Content ".env.production" -Raw
    if ($envContent -notmatch "VITE_URL=http://127.0.0.1:8000") {
        Write-Host "WARNING: .env.production exists but VITE_URL may not be set to local backend" -ForegroundColor Yellow
        Write-Host "  Current content: $envContent" -ForegroundColor Yellow
    }
}

# Build frontend
Write-Host ""
Write-Host "Running npm run build..." -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Frontend build failed!" -ForegroundColor Red
    Set-Location ..
    exit 1
}

Write-Host "✓ Frontend build completed successfully" -ForegroundColor Green

# Check if serve is installed
Write-Host ""
Write-Host "Checking for serve package..." -ForegroundColor Cyan
$serveInstalled = Get-Command serve -ErrorAction SilentlyContinue

if (-not $serveInstalled) {
    Write-Host "Installing serve package globally..." -ForegroundColor Yellow
    npm install -g serve
    if ($LASTEXITCODE -ne 0) {
        Write-Host "WARNING: Failed to install serve. You can install it manually with: npm install -g serve" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Alternative: Use Python HTTP server:" -ForegroundColor Yellow
        Write-Host "  cd dist" -ForegroundColor White
        Write-Host "  python -m http.server 3000" -ForegroundColor White
        Set-Location ..
        exit 1
    }
}

# Check if port 3000 is available
Write-Host ""
Write-Host "Checking if port 3000 is available..." -ForegroundColor Cyan
$port3000InUse = Test-Port -Port 3000

if ($port3000InUse) {
    Write-Host "WARNING: Port 3000 is already in use. Trying port 3001..." -ForegroundColor Yellow
    $frontendPort = 3001
} else {
    $frontendPort = 3000
}

# Display summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Deployment Ready!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Backend:  http://127.0.0.1:8000" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:$frontendPort" -ForegroundColor Cyan
Write-Host ""
Write-Host "Starting frontend server..." -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host ""

# Serve frontend
serve -s dist -l $frontendPort


