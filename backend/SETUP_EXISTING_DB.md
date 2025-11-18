# Setting Up Heroku with Your Existing Database

## Step 1: Get Your Database Credentials

If you have a `.env` file in your `backend` directory, you can read the values from there. Otherwise, you'll need to get them from your database provider.

Common database environment variable names:
- `DB_HOST` - Database host/URL
- `DB_NAME` - Database name
- `DB_USER` - Database username
- `DB_PASSWORD` - Database password
- `DB_PORT` - Database port (usually 5432 for PostgreSQL)

## Step 2: Set Environment Variables on Heroku

Run these commands, replacing the values with your actual database credentials:

```powershell
# Set database credentials
heroku config:set DB_HOST="your-database-host.com" -a leadflow-backend
heroku config:set DB_NAME="your-database-name" -a leadflow-backend
heroku config:set DB_USER="your-database-user" -a leadflow-backend
heroku config:set DB_PASSWORD="your-database-password" -a leadflow-backend
heroku config:set DB_PORT="5432" -a leadflow-backend

# Set other required variables
heroku config:set SECRET_KEY="$(python -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())')" -a leadflow-backend
heroku config:set DEBUG="False" -a leadflow-backend
heroku config:set ALLOWED_HOSTS="leadflow-backend.herokuapp.com,leadflow-backend-88fb1042b069.herokuapp.com" -a leadflow-backend
heroku config:set CSRF_TRUSTED_ORIGINS="https://leadflow-backend.herokuapp.com,https://leadflow-backend-88fb1042b069.herokuapp.com" -a leadflow-backend
```

## Step 3: Verify Configuration

Check that all variables are set correctly:

```powershell
heroku config -a leadflow-backend
```

**Note:** The password will be hidden for security, but you should see all other variables.

## Step 4: Test Database Connection

Test the database connection by running migrations:

```powershell
heroku run python backend/manage.py migrate -a leadflow-backend
```

If this succeeds, your database connection is working!

## Step 5: Deploy Updated Settings

Make sure your latest settings.py changes are deployed:

```powershell
cd backend
git add backend/settings.py
git commit -m "Update database configuration to prioritize custom DB credentials"
git push heroku main
```

## Troubleshooting

### If you get connection errors:

1. **Check firewall/security groups:** Make sure your database allows connections from Heroku's IP ranges
   - Heroku dynos use dynamic IPs, so you may need to allow all IPs or use a connection pooler

2. **Check SSL requirements:** Some databases require SSL connections
   - The settings.py already includes `'sslmode': 'require'` for custom databases

3. **Verify credentials:** Double-check your database credentials are correct
   ```powershell
   heroku config:get DB_HOST -a leadflow-backend
   heroku config:get DB_NAME -a leadflow-backend
   heroku config:get DB_USER -a leadflow-backend
   ```

4. **Check database provider:** Some providers (like AWS RDS) require specific connection settings

### Common Database Providers:

**AWS RDS:**
- Host format: `your-db.xxxxx.us-east-1.rds.amazonaws.com`
- Usually requires SSL

**DigitalOcean:**
- Host format: `your-db-do-user-xxxxx.db.ondigitalocean.com`
- Usually requires SSL

**Supabase:**
- Host format: `db.xxxxx.supabase.co`
- Port: `5432` or `6543` (connection pooler)
- Requires SSL

**Railway/Render:**
- Usually provides a connection string format
- May need to parse it into individual components

## Quick Setup Script

If you have your credentials ready, you can run this PowerShell script (replace the values):

```powershell
$dbHost = "your-database-host.com"
$dbName = "your-database-name"
$dbUser = "your-database-user"
$dbPassword = "your-database-password"
$dbPort = "5432"

heroku config:set DB_HOST="$dbHost" -a leadflow-backend
heroku config:set DB_NAME="$dbName" -a leadflow-backend
heroku config:set DB_USER="$dbUser" -a leadflow-backend
heroku config:set DB_PASSWORD="$dbPassword" -a leadflow-backend
heroku config:set DB_PORT="$dbPort" -a leadflow-backend
```

