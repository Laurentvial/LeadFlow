# Heroku Deployment Guide

## Prerequisites
1. Heroku account
2. Heroku CLI installed
3. Git repository initialized

## Deployment Steps

### 1. Login to Heroku
```bash
heroku login
```

### 2. Create a Heroku App
```bash
cd backend
heroku create your-app-name
```

### 3. Add PostgreSQL Database
```bash
heroku addons:create heroku-postgresql:mini
```

### 4. Set Environment Variables
```bash
# Set secret key (generate a new one!)
heroku config:set SECRET_KEY="your-secret-key-here"

# Set debug mode (False for production)
heroku config:set DEBUG="False"

# Set allowed hosts (your Heroku app URL)
heroku config:set ALLOWED_HOSTS="your-app-name.herokuapp.com"

# Set CSRF trusted origins (add your frontend URL)
heroku config:set CSRF_TRUSTED_ORIGINS="https://your-app-name.herokuapp.com,https://your-frontend-domain.com"
```

### 5. Deploy to Heroku
```bash
# Make sure you're in the backend directory
git add .
git commit -m "Prepare for Heroku deployment"
git push heroku main
```

### 6. Run Migrations
```bash
heroku run python manage.py migrate
```

### 7. Create Superuser (Optional)
```bash
heroku run python manage.py createsuperuser
```

### 8. Collect Static Files
```bash
heroku run python manage.py collectstatic --noinput
```

## Important Notes

- The `DATABASE_URL` is automatically set by Heroku when you add the PostgreSQL addon
- Make sure to set `DEBUG=False` in production
- Update `ALLOWED_HOSTS` with your actual Heroku app URL
- Update `CSRF_TRUSTED_ORIGINS` with your frontend domain if needed
- The app will automatically use `gunicorn` to serve the application

## Troubleshooting

### View Logs
```bash
heroku logs --tail
```

### Run Django Shell
```bash
heroku run python manage.py shell
```

### Check Environment Variables
```bash
heroku config
```

