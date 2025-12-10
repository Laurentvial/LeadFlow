# Deployment Script for LeadFlow
# Deploys both backend (Heroku) and frontend (Vercel via GitHub)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  LeadFlow Deployment Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Stage all changes
Write-Host "[1/5] Staging all changes..." -ForegroundColor Yellow
git add .

# Step 2: Commit changes
Write-Host "[2/5] Committing changes..." -ForegroundColor Yellow
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$commitMessage = "Deploy: Update backend and frontend - $timestamp"
git commit -m $commitMessage

if ($LASTEXITCODE -ne 0) {
    Write-Host "Warning: Commit may have failed or no changes to commit" -ForegroundColor Yellow
}

# Step 3: Push to GitHub (triggers Vercel frontend deployment)
Write-Host "[3/5] Pushing to GitHub (frontend auto-deploys on Vercel)..." -ForegroundColor Green
git push origin main

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Failed to push to GitHub" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Frontend deployment triggered on Vercel" -ForegroundColor Green
Write-Host ""

# Step 4: Push to Heroku (backend deployment)
Write-Host "[4/5] Deploying backend to Heroku..." -ForegroundColor Green
git push heroku main

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Failed to deploy to Heroku" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Backend deployed to Heroku" -ForegroundColor Green
Write-Host ""

# Step 5: Restart Heroku dynos
Write-Host "[5/5] Restarting Heroku dynos..." -ForegroundColor Yellow
heroku restart --app leadflow-backend-eu

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Deployment Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Backend:" -ForegroundColor Yellow
Write-Host "  - App: leadflow-backend-eu" -ForegroundColor White
Write-Host "  - Check logs: heroku logs --tail --app leadflow-backend-eu" -ForegroundColor Gray
Write-Host ""
Write-Host "Frontend:" -ForegroundColor Yellow
Write-Host "  - Check Vercel dashboard for deployment status" -ForegroundColor White
Write-Host "  - URL: https://vercel.com/dashboard" -ForegroundColor Gray
Write-Host ""

