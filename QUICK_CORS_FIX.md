# Quick CORS Fix - Apply Immediately

## The Problem
Your code changes haven't been deployed to Heroku yet, so the CORS fix isn't active. The backend is blocking requests from your Vercel frontend.

## Immediate Fix (Run This Now)

Open PowerShell and run:

```powershell
heroku config:unset CORS_ALLOWED_ORIGINS -a leadflow-backend-eu
heroku restart -a leadflow-backend-eu
```

This will allow all origins temporarily until you deploy the code fix.

## Verify It Works

After running the command above, try logging in from your Vercel frontend. The CORS error should be gone.

## Then Deploy the Code Fix

After the quick fix works, deploy the proper code fix:

```powershell
cd backend
git add backend/settings.py
git commit -m "Fix CORS: Add Vercel domain and improve CORS configuration"
git push heroku main
```

After deployment, you can optionally set `CORS_ALLOWED_ORIGINS` again if you want to restrict origins, but the code will automatically include the Vercel domain.

## Test CORS Configuration After Deployment

```powershell
heroku run python test_cors.py -a leadflow-backend-eu
```

This will show you the current CORS configuration.

