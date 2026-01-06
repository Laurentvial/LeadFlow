# Heroku Backend Deployment Script
# Run this after authenticating with: heroku login

Write-Host "Deploying backend to Heroku..." -ForegroundColor Green

# Deploy to Heroku
Write-Host "`nPushing to Heroku..." -ForegroundColor Yellow
git push heroku main

# Run migrations
Write-Host "`nRunning migrations..." -ForegroundColor Yellow
heroku run bash -c "cd backend && python manage.py migrate" --app leadflow-backend-eu

# Collect static files
Write-Host "`nCollecting static files..." -ForegroundColor Yellow
heroku run bash -c "cd backend && python manage.py collectstatic --noinput" --app leadflow-backend-eu

# Restart dynos
Write-Host "`nRestarting dynos..." -ForegroundColor Yellow
heroku restart --app leadflow-backend-eu

# Show logs
Write-Host "`nDeployment complete! View logs with:" -ForegroundColor Green
Write-Host "heroku logs --tail --app leadflow-backend-eu" -ForegroundColor Cyan








