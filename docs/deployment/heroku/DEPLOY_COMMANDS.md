# Heroku Deployment Commands

Your Heroku app name is: **leadflow-backend**

## Step 1: Add Heroku Git Remote (Already Done)
```powershell
heroku git:remote -a leadflow-backend
```

## Step 2: Add PostgreSQL Database
```powershell
heroku addons:create heroku-postgresql:mini -a leadflow-backend
```

## Step 3: Set Environment Variables

### Generate a secret key first:
```powershell
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

### Then set all config variables:
```powershell
heroku config:set SECRET_KEY="<paste-the-generated-key-here>" -a leadflow-backend
heroku config:set DEBUG="False" -a leadflow-backend
heroku config:set ALLOWED_HOSTS="leadflow-backend.herokuapp.com" -a leadflow-backend
heroku config:set CSRF_TRUSTED_ORIGINS="https://leadflow-backend.herokuapp.com" -a leadflow-backend
```

## Step 4: Deploy to Heroku

Make sure you're in the `backend` directory and have committed your changes:

```powershell
cd backend
git add .
git commit -m "Prepare for Heroku deployment"
git push heroku main
```

If your default branch is `master` instead of `main`:
```powershell
git push heroku master
```

## Step 5: Run Migrations
```powershell
heroku run python manage.py migrate -a leadflow-backend
```

## Step 6: Collect Static Files
```powershell
heroku run python manage.py collectstatic --noinput -a leadflow-backend
```

## Step 7: Create Superuser (Optional)
```powershell
heroku run python manage.py createsuperuser -a leadflow-backend
```

## Useful Commands

### View logs:
```powershell
heroku logs --tail -a leadflow-backend
```

### Check environment variables:
```powershell
heroku config -a leadflow-backend
```

### Open your app in browser:
```powershell
heroku open -a leadflow-backend
```

### Run Django shell:
```powershell
heroku run python manage.py shell -a leadflow-backend
```

## Troubleshooting

### If you get "No app specified" errors:
Make sure you're either:
1. In a git directory with heroku remote set, OR
2. Using `-a leadflow-backend` flag with every command

### Check if heroku remote is set:
```powershell
git remote -v
```

You should see a `heroku` remote pointing to your app.

