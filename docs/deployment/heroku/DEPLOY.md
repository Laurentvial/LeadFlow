# Deployment Guide - Frontend & Backend

## Quick Deploy Commands

### Backend (Heroku)

```powershell
# 1. Commit backend changes
git add backend/
git commit -m "Deploy backend with CORS fixes"

# 2. Deploy to Heroku
git push heroku main --app leadflow-backend-eu

# 3. Restart dynos
heroku restart --app leadflow-backend-eu

# 4. Run migrations (if needed)
heroku run bash -c "cd backend && python manage.py migrate" --app leadflow-backend-eu

# 5. Collect static files (if needed)
heroku run bash -c "cd backend && python manage.py collectstatic --noinput" --app leadflow-backend-eu

# 6. Check logs
heroku logs --tail --app leadflow-backend-eu
```

### Frontend (Vercel)

```powershell
# 1. Commit frontend changes
git add frontend/
git commit -m "Deploy frontend with direct API calls"

# 2. Push to GitHub (Vercel auto-deploys from GitHub)
git push origin main

# 3. Or deploy manually via Vercel CLI (if installed)
# vercel --prod
```

## Step-by-Step Deployment

### Part 1: Deploy Backend to Heroku

#### Step 1: Verify Backend Changes
```powershell
# Check what files changed
git status

# Review backend changes
git diff backend/
```

#### Step 2: Commit Backend Changes
```powershell
git add backend/backend/settings.py backend/requirements.txt backend/Procfile
git commit -m "Deploy backend: Update CORS configuration"
```

#### Step 3: Deploy to Heroku
```powershell
# Deploy (from project root)
git push heroku main --app leadflow-backend-eu

# Or if heroku remote is already set
git push heroku main
```

#### Step 4: Verify Backend Deployment
```powershell
# Check deployment status
heroku releases --app leadflow-backend-eu

# View logs
heroku logs --tail --app leadflow-backend-eu

# Test health endpoint
Invoke-RestMethod -Uri "https://leadflow-backend-eu-8d20fb5efc7b.herokuapp.com/health/"
```

#### Step 5: Run Post-Deployment Tasks
```powershell
# Run migrations
heroku run bash -c "cd backend && python manage.py migrate" --app leadflow-backend-eu

# Collect static files
heroku run bash -c "cd backend && python manage.py collectstatic --noinput" --app leadflow-backend-eu

# Restart dynos
heroku restart --app leadflow-backend-eu
```

### Part 2: Deploy Frontend to Vercel

#### Step 1: Set Environment Variable in Vercel

**Important:** Before deploying, set the `VITE_URL` environment variable:

1. Go to: https://vercel.com/dashboard
2. Select project: `lead-flow-orpin`
3. Go to **Settings** → **Environment Variables**
4. Add:
   - **Name:** `VITE_URL`
   - **Value:** `https://leadflow-backend-eu-8d20fb5efc7b.herokuapp.com`
   - **Environments:** ✅ Production, ✅ Preview, ✅ Development
5. Click **Save**

#### Step 2: Commit Frontend Changes
```powershell
# Check frontend changes
git status

# Commit frontend changes
git add frontend/src/utils/api.ts frontend/vercel.json frontend/API_CONFIGURATION.md
git commit -m "Deploy frontend: Use direct API calls, remove proxy"
```

#### Step 3: Push to GitHub (Auto-Deploy)
```powershell
# Push to GitHub - Vercel will auto-deploy
git push origin main
```

#### Step 4: Verify Frontend Deployment

1. Go to Vercel Dashboard: https://vercel.com/dashboard
2. Check deployment status
3. Wait for build to complete
4. Click on deployment to see build logs

#### Step 5: Test Frontend

After deployment completes:
1. Open your Vercel app URL: `https://lead-flow-orpin.vercel.app`
2. Open browser DevTools → Network tab
3. Make an API request (e.g., login)
4. Verify requests go to: `https://leadflow-backend-eu-8d20fb5efc7b.herokuapp.com/api/...`

## Complete Deployment Script

Run all commands in sequence:

```powershell
# ===== BACKEND DEPLOYMENT =====
Write-Host "Deploying backend to Heroku..." -ForegroundColor Green

# Commit backend changes
git add backend/
git commit -m "Deploy backend: CORS configuration updates"

# Deploy to Heroku
git push heroku main --app leadflow-backend-eu

# Restart and verify
heroku restart --app leadflow-backend-eu
Write-Host "Backend deployed! Check logs with: heroku logs --tail --app leadflow-backend-eu" -ForegroundColor Green

# ===== FRONTEND DEPLOYMENT =====
Write-Host "`nDeploying frontend to Vercel..." -ForegroundColor Green

# Commit frontend changes
git add frontend/
git commit -m "Deploy frontend: Direct API calls configuration"

# Push to GitHub (Vercel auto-deploys)
git push origin main

Write-Host "Frontend deployed! Check Vercel dashboard for deployment status." -ForegroundColor Green
Write-Host "Make sure VITE_URL is set in Vercel environment variables!" -ForegroundColor Yellow
```

## Manual Vercel Deployment (Alternative)

If you have Vercel CLI installed:

```powershell
# Install Vercel CLI (if not installed)
npm i -g vercel

# Login to Vercel
vercel login

# Deploy frontend
cd frontend
vercel --prod

# Or deploy from root
vercel --prod --cwd frontend
```

## Verification Checklist

After deployment, verify:

### Backend ✅
- [ ] Health endpoint works: `https://leadflow-backend-eu-8d20fb5efc7b.herokuapp.com/health/`
- [ ] CORS test works: `https://leadflow-backend-eu-8d20fb5efc7b.herokuapp.com/cors-test/`
- [ ] Logs show no errors: `heroku logs --tail --app leadflow-backend-eu`
- [ ] Dynos are running: `heroku ps --app leadflow-backend-eu`

### Frontend ✅
- [ ] Vercel deployment completed successfully
- [ ] `VITE_URL` environment variable is set in Vercel
- [ ] Frontend loads without errors
- [ ] API calls go directly to Heroku backend (check Network tab)
- [ ] No CORS errors in browser console
- [ ] Login/authentication works

## Troubleshooting

### Backend Deployment Fails

```powershell
# Check build logs
heroku builds:info --app leadflow-backend-eu

# View recent logs
heroku logs --tail --app leadflow-backend-eu

# Check config vars
heroku config --app leadflow-backend-eu

# Rollback if needed
heroku rollback --app leadflow-backend-eu
```

### Frontend Deployment Fails

1. Check Vercel build logs in dashboard
2. Verify `VITE_URL` is set correctly
3. Check for build errors in console
4. Verify all dependencies are in `package.json`

### CORS Errors After Deployment

1. **Verify backend CORS is deployed:**
   ```powershell
   heroku logs --tail --app leadflow-backend-eu | Select-String "CORS"
   ```

2. **Test CORS endpoint:**
   ```powershell
   Invoke-RestMethod -Uri "https://leadflow-backend-eu-8d20fb5efc7b.herokuapp.com/cors-test/"
   ```

3. **Verify VITE_URL in Vercel:**
   - Go to Vercel Dashboard → Settings → Environment Variables
   - Ensure `VITE_URL` is set and matches backend URL

4. **Restart backend:**
   ```powershell
   heroku restart --app leadflow-backend-eu
   ```

## Quick Reference

### Backend URLs
- **App URL:** https://leadflow-backend-eu-8d20fb5efc7b.herokuapp.com
- **Health Check:** https://leadflow-backend-eu-8d20fb5efc7b.herokuapp.com/health/
- **API Base:** https://leadflow-backend-eu-8d20fb5efc7b.herokuapp.com/api/

### Frontend URLs
- **Vercel App:** https://lead-flow-orpin.vercel.app
- **Dashboard:** https://vercel.com/dashboard

### Useful Commands

```powershell
# Backend
heroku logs --tail --app leadflow-backend-eu
heroku ps --app leadflow-backend-eu
heroku config --app leadflow-backend-eu
heroku restart --app leadflow-backend-eu

# Frontend (if using Vercel CLI)
vercel logs
vercel inspect
```

