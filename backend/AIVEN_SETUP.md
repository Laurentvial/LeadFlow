# Aiven Database Setup for Heroku

## Issue: DNS Resolution Error

The error `could not translate host name` typically means:
1. **DNS resolution failure** - Heroku can't resolve the Aiven hostname
2. **Network/firewall restrictions** - Aiven database may not allow connections from Heroku IPs
3. **Incorrect hostname** - The hostname might need to be accessed differently

## Solutions:

### Option 1: Use Aiven Connection Pooler (Recommended)

Aiven provides a connection pooler that's more reliable for cloud deployments:

1. **Get the connection pooler hostname** from your Aiven dashboard
   - It's usually similar to: `pg-xxxxx-pooler.aivencloud.com`
   - Port: `25060` (default pooler port)

2. **Update Heroku config:**
   ```powershell
   heroku config:set DB_HOST="your-pooler-hostname.aivencloud.com" -a leadflow-backend
   heroku config:set DB_PORT="25060" -a leadflow-backend
   ```

### Option 2: Configure Aiven Firewall

Aiven databases have firewall rules. You need to allow Heroku's IP ranges:

1. **Go to your Aiven project dashboard**
2. **Navigate to your PostgreSQL service**
3. **Go to "Network" or "Firewall" settings**
4. **Add Heroku IP ranges** (or allow all IPs `0.0.0.0/0` for testing)

**Heroku IP ranges** (these change, check Heroku docs for latest):
- You may need to allow all IPs: `0.0.0.0/0` (less secure but works)
- Or use Aiven's "Allow access from anywhere" option

### Option 3: Use Aiven Private Link (Advanced)

If you have Aiven Private Link configured, you might need different connection settings.

### Option 4: Check Hostname Format

Aiven hostnames can be:
- **Direct connection**: `pg-xxxxx-leadflow1640731334-choreo-o.f.aivencloud.com`
- **Pooler connection**: `pg-xxxxx-pooler.aivencloud.com`

Make sure you're using the correct one.

## Current Configuration Check

Check your current Heroku config:
```powershell
heroku config:get DB_HOST -a leadflow-backend
heroku config:get DB_PORT -a leadflow-backend
heroku config:get DB_NAME -a leadflow-backend
```

## Recommended Settings for Aiven

```powershell
# Use connection pooler (more reliable)
heroku config:set DB_HOST="your-pooler-hostname.aivencloud.com" -a leadflow-backend
heroku config:set DB_PORT="25060" -a leadflow-backend
heroku config:set DB_NAME="defaultdb" -a leadflow-backend  # or your actual DB name
heroku config:set DB_USER="avnadmin" -a leadflow-backend  # or your Aiven user
heroku config:set DB_PASSWORD="your-password" -a leadflow-backend
```

## Test Connection

After updating, test the connection:
```powershell
heroku run python backend/manage.py dbshell -a leadflow-backend
```

If `dbshell` works, migrations will work too:
```powershell
heroku run python backend/manage.py migrate -a leadflow-backend
```

## Troubleshooting

### If DNS still fails:

1. **Try using IP address instead of hostname:**
   - Get the IP from Aiven dashboard or by resolving the hostname
   - Set `DB_HOST` to the IP address

2. **Check Aiven service status:**
   - Make sure your Aiven PostgreSQL service is running
   - Check if there are any service alerts

3. **Verify credentials:**
   ```powershell
   heroku config -a leadflow-backend | Select-String "DB_"
   ```

4. **Test from local machine first:**
   - Try connecting from your local machine using the same credentials
   - If it works locally but not on Heroku, it's a firewall/network issue

## Alternative: Use Aiven Connection String

Aiven provides a connection string format. You can parse it:

**Aiven connection string format:**
```
postgres://avnadmin:password@pg-xxxxx.aivencloud.com:25060/defaultdb?sslmode=require
```

You can extract:
- Host: `pg-xxxxx.aivencloud.com`
- Port: `25060`
- Database: `defaultdb`
- User: `avnadmin`
- Password: `password`

