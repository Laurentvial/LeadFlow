# Heroku Deployment Verification Checklist

## ✅ Pre-Deployment Checks

### 1. Procfile Configuration
- [x] Root Procfile exists: `web: cd backend && gunicorn backend.wsgi --log-file -`
- [x] Procfile is in root directory (Heroku looks for it there)
- [x] Gunicorn is specified in requirements.txt

### 2. Requirements.txt
- [x] All dependencies listed in `backend/requirements.txt`
- [x] Gunicorn included for production server
- [x] WhiteNoise included for static file serving
- [x] dj-database-url included for Heroku DATABASE_URL parsing
- [x] psycopg2-binary included for PostgreSQL

**Current dependencies:**
```
asgiref==3.10.0
Django==5.2.7
django-cors-headers==4.9.0
djangorestframework==3.16.1
djangorestframework-simplejwt==5.5.1
PyJWT==2.10.1
pytz==2025.2
sqlparse==0.5.3
psycopg2-binary==2.9.11
python-dotenv==1.2.1
boto3==1.40.74
gunicorn==23.0.0
whitenoise==6.8.2
dj-database-url==2.1.0
email-validator==2.1.1
```

### 3. Runtime Configuration
- [x] `runtime.txt` specifies Python version: `python-3.12.8`
- [x] Python version matches local development

### 4. Settings.py Configuration
- [x] WhiteNoise middleware configured for static files
- [x] STATIC_ROOT set to `BASE_DIR / "staticfiles"`
- [x] STATICFILES_STORAGE uses WhiteNoise
- [x] Database configuration supports DATABASE_URL (Heroku Postgres)
- [x] DEBUG reads from environment variable (defaults to False)
- [x] ALLOWED_HOSTS reads from environment variable
- [x] SECRET_KEY reads from environment variable

### 5. WSGI Configuration
- [x] `backend/backend/wsgi.py` exists and is properly configured
- [x] WSGI_APPLICATION points to `backend.wsgi.application`

## 🔧 Deployment Steps

### Step 1: Verify Heroku App Configuration
```bash
# Check app info
heroku info --app leadflow-backend-eu

# Check config vars
heroku config --app leadflow-backend-eu
```

**Required Config Vars:**
- `SECRET_KEY` - Django secret key
- `DEBUG` - Should be "False" in production
- `ALLOWED_HOSTS` - Your Heroku app domain
- `CSRF_TRUSTED_ORIGINS` - Your frontend and backend URLs
- `DATABASE_URL` - Automatically set by Heroku Postgres addon

### Step 2: Verify Database Connection
```bash
# Check if PostgreSQL addon is attached
heroku addons --app leadflow-backend-eu

# Test database connection
heroku run bash -c "cd backend && python manage.py dbshell" --app leadflow-backend-eu
```

### Step 3: Run Migrations
```bash
heroku run bash -c "cd backend && python manage.py migrate" --app leadflow-backend-eu
```

### Step 4: Collect Static Files
```bash
heroku run bash -c "cd backend && python manage.py collectstatic --noinput" --app leadflow-backend-eu
```

### Step 5: Verify Application Starts
```bash
# Check logs for startup errors
heroku logs --tail --app leadflow-backend-eu

# Check if web dyno is running
heroku ps --app leadflow-backend-eu
```

### Step 6: Test API Endpoints

**Using PowerShell (Windows):**
```powershell
# Test health endpoint
Invoke-WebRequest -Uri "https://leadflow-backend-eu-8d20fb5efc7b.herokuapp.com/health/" -UseBasicParsing

# Test CORS endpoint
Invoke-WebRequest -Uri "https://leadflow-backend-eu-8d20fb5efc7b.herokuapp.com/cors-test/" -UseBasicParsing

# Test authentication endpoint (POST)
$body = @{username="test";password="test"} | ConvertTo-Json
Invoke-WebRequest -Uri "https://leadflow-backend-eu-8d20fb5efc7b.herokuapp.com/api/token/" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing
```

**Using curl.exe (if available):**
```powershell
# Use curl.exe explicitly (not PowerShell alias)
curl.exe https://leadflow-backend-eu-8d20fb5efc7b.herokuapp.com/health/

# Or use Invoke-RestMethod for JSON responses
Invoke-RestMethod -Uri "https://leadflow-backend-eu-8d20fb5efc7b.herokuapp.com/health/"
```

## 🐛 Common Issues & Solutions

### Issue 1: "No such file or directory: manage.py"
**Solution:** Use `bash -c "cd backend && python manage.py <command>"` for all Django commands

### Issue 2: Static files not loading
**Solution:** 
- Ensure WhiteNoise is in MIDDLEWARE (after SecurityMiddleware)
- Run `collectstatic` after deployment
- Check STATIC_ROOT is set correctly

### Issue 3: Database connection errors
**Solution:**
- Verify PostgreSQL addon is attached: `heroku addons --app leadflow-backend-eu`
- Check DATABASE_URL is set: `heroku config:get DATABASE_URL --app leadflow-backend-eu`
- Ensure dj-database-url is in requirements.txt

### Issue 4: CORS errors
**Solution:**
- Verify CORS_ALLOWED_ORIGINS or CORS_ALLOW_ALL_ORIGINS is set
- Check CSRF_TRUSTED_ORIGINS includes frontend URL
- Ensure django-cors-headers is in INSTALLED_APPS and MIDDLEWARE

### Issue 5: Application crashes on startup
**Solution:**
- Check logs: `heroku logs --tail --app leadflow-backend-eu`
- Verify all environment variables are set
- Check for missing dependencies in requirements.txt
- Ensure Procfile command is correct

## 📋 Post-Deployment Verification

### Health Checks
1. [ ] Application responds to HTTP requests
2. [ ] API endpoints are accessible
3. [ ] Authentication works (login endpoint)
4. [ ] Database queries work (test a simple GET request)
5. [ ] Static files are served correctly
6. [ ] CORS headers are present in responses

### Performance Checks
1. [ ] Response times are acceptable (< 2s for API calls)
2. [ ] No memory leaks (check dyno memory usage)
3. [ ] Database queries are optimized

### Security Checks
1. [ ] DEBUG=False in production
2. [ ] SECRET_KEY is set and secure
3. [ ] ALLOWED_HOSTS restricts access
4. [ ] HTTPS is enforced (Heroku does this automatically)
5. [ ] CORS is properly configured

## 🔍 Debugging Commands

```bash
# View real-time logs
heroku logs --tail --app leadflow-backend-eu

# View last 100 lines of logs
heroku logs -n 100 --app leadflow-backend-eu

# Run Django shell
heroku run bash -c "cd backend && python manage.py shell" --app leadflow-backend-eu

# Check environment variables
heroku config --app leadflow-backend-eu

# Restart dynos
heroku restart --app leadflow-backend-eu

# Scale dynos (if needed)
heroku ps:scale web=1 --app leadflow-backend-eu
```

## 📝 Notes

- Heroku automatically provides HTTPS
- Static files are served via WhiteNoise (no need for separate static file hosting)
- Database backups are handled by Heroku Postgres addon
- Logs are automatically collected and available via `heroku logs`
- Environment variables should never be committed to git

