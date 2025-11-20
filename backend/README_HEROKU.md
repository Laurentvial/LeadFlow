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

**To create an app in EU (Ireland) region:**
```bash
heroku create your-app-name --region eu
```

**Available regions:**
- `us` - United States (default)
- `eu` - Europe (Ireland)
- `dublin` - Dublin, Ireland (same as `eu`)

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
# Since manage.py is in the backend directory
heroku run bash -c "cd backend && python manage.py migrate"
```

### 7. Create Superuser (Optional)
```bash
heroku run bash -c "cd backend && python manage.py createsuperuser"
```

### 8. Collect Static Files
```bash
heroku run bash -c "cd backend && python manage.py collectstatic --noinput"
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
heroku run bash -c "cd backend && python manage.py shell"
```

### Check Environment Variables
```bash
heroku config
```

## Migrating to EU Region (Ireland)

**Important:** Heroku does not allow changing the region of an existing app. You must create a new app in the EU region and migrate your data.

### Step 1: Create New App in EU Region
```bash
cd backend
heroku create your-app-name-eu --region eu
```

### Step 2: Copy Environment Variables from Old App

**Method 1: Using PowerShell (Windows) - Recommended**
```powershell
# Export config from old app to file
heroku config --app your-old-app-name --shell | Out-File -FilePath config.txt -Encoding utf8

# Read and set each config variable
Get-Content config.txt | ForEach-Object {
    $line = $_.Trim()
    if ($line -and $line -match '^([^=]+)=(.*)$') {
        $key = $matches[1]
        $value = $matches[2]
        Write-Host "Setting $key..."
        heroku config:set "${key}=${value}" --app your-app-name-eu
    }
}

# Clean up
Remove-Item config.txt
```

**Method 2: Manual Copy (Works on all platforms)**
```bash
# Get config from old app
heroku config --app your-old-app-name

# Copy each variable manually:
heroku config:set KEY1=value1 --app your-app-name-eu
heroku config:set KEY2=value2 --app your-app-name-eu
# ... repeat for each variable
```

**Method 3: Using Git Bash (if installed on Windows)**
```bash
# Get all config vars from old app (works in Git Bash)
heroku config --app your-old-app-name --shell | xargs heroku config:set --app your-app-name-eu
```

**Method 4: Export and Import (Recommended)**
```bash
# Export config from old app
heroku config --app your-old-app-name --shell > config.txt

# Then manually edit config.txt and set each variable:
# SECRET_KEY=your-secret-key
# DEBUG=False
# etc.

# Set all variables at once (PowerShell)
Get-Content config.txt | ForEach-Object {
    if ($_ -match '^([^=]+)=(.*)$') {
        heroku config:set "${_}" --app your-app-name-eu
    }
}
```

### Step 3: Add PostgreSQL Database to New App
```bash
heroku addons:create heroku-postgresql:mini --app your-app-name-eu
```

### Step 4: Migrate Database
```bash
# Create backup from old database
heroku pg:backups:capture --app your-old-app-name

# Download backup
heroku pg:backups:download --app your-old-app-name

# Restore to new database
heroku pg:backups:restore 'backup-url-or-file' DATABASE_URL --app your-app-name-eu --confirm your-app-name-eu
```

**Alternative method using pg:copy:**
```bash
# Copy database directly (if both apps are in same account)
heroku pg:copy your-old-app-name::DATABASE_URL DATABASE_URL --app your-app-name-eu --confirm your-app-name-eu
```

### Step 5: Update Environment Variables
Update `ALLOWED_HOSTS` and `CSRF_TRUSTED_ORIGINS` with the new app URL:
```bash
heroku config:set ALLOWED_HOSTS="your-app-name-eu.herokuapp.com" --app your-app-name-eu
heroku config:set CSRF_TRUSTED_ORIGINS="https://your-app-name-eu.herokuapp.com,https://your-frontend-domain.com" --app your-app-name-eu
```

### Step 6: Deploy Code to New App
```bash
# Add new remote
heroku git:remote -a your-app-name-eu

# Deploy
git push heroku main
```

### Step 7: Run Migrations (if needed)
```bash
# Since manage.py is in the backend directory, change directory first
heroku run bash -c "cd backend && python manage.py migrate" --app your-app-name-eu
```

**Or if your Procfile is in the root and changes to backend directory:**
```bash
heroku run bash -c "cd backend && python manage.py migrate" --app your-app-name-eu
```

**Other common Django commands:**
```bash
# Create superuser
heroku run bash -c "cd backend && python manage.py createsuperuser" --app your-app-name-eu

# Collect static files
heroku run bash -c "cd backend && python manage.py collectstatic --noinput" --app your-app-name-eu

# Django shell
heroku run bash -c "cd backend && python manage.py shell" --app your-app-name-eu
```

### Step 8: Update DNS/Frontend Configuration
Update your frontend API URL to point to the new EU app:
- Old: `https://your-old-app-name.herokuapp.com`
- New: `https://your-app-name-eu.herokuapp.com`

### Step 9: Verify and Switch Over
1. Test the new EU app thoroughly
2. Update DNS records if using custom domain
3. Update frontend environment variables
4. Once verified, you can delete the old US app (optional)

### Check Current Region
```bash
heroku info --app your-app-name
# Look for "Region" in the output
```

