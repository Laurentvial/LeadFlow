# Heroku Deployment - Next Steps

## ✅ Deployment Successful!

Your app is deployed at: **https://leadflow-backend-88fb1042b069.herokuapp.com/**

## Required Next Steps:

### 1. Add PostgreSQL Database
```powershell
heroku addons:create heroku-postgresql:mini -a leadflow-backend
```

### 2. Set Environment Variables

**Generate a secret key:**
```powershell
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

**Set all config variables (replace <SECRET_KEY> with the generated key):**
```powershell
heroku config:set SECRET_KEY="<SECRET_KEY>" -a leadflow-backend
heroku config:set DEBUG="False" -a leadflow-backend
heroku config:set ALLOWED_HOSTS="leadflow-backend.herokuapp.com,leadflow-backend-88fb1042b069.herokuapp.com" -a leadflow-backend
heroku config:set CSRF_TRUSTED_ORIGINS="https://leadflow-backend.herokuapp.com,https://leadflow-backend-88fb1042b069.herokuapp.com" -a leadflow-backend
```

### 3. Run Database Migrations
```powershell
heroku run python backend/manage.py migrate -a leadflow-backend
```

### 4. Create Superuser (Optional)
```powershell
heroku run python backend/manage.py createsuperuser -a leadflow-backend
```

### 5. Verify Deployment
```powershell
heroku open -a leadflow-backend
```

## Useful Commands:

### View logs:
```powershell
heroku logs --tail -a leadflow-backend
```

### Check environment variables:
```powershell
heroku config -a leadflow-backend
```

### Run Django shell:
```powershell
heroku run python backend/manage.py shell -a leadflow-backend
```

## Notes:

- The `DATABASE_URL` will be automatically set when you add the PostgreSQL addon
- Make sure `DEBUG=False` in production
- Update your frontend API URL to point to: `https://leadflow-backend-88fb1042b069.herokuapp.com`

