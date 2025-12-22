# Fix Aiven DNS Resolution Error on Heroku

## Problem
Heroku cannot resolve the Aiven hostname: `pg-6a22f4ddd5634b84bb2ed73ed3b8257d-leadflow1640731334-choreo-o.f.aivencloud.com`

## Solution Steps

### Step 1: Configure Aiven Firewall (REQUIRED)

**Aiven databases block connections by default.** You must allow Heroku IPs:

1. **Go to Aiven Console**: https://console.aiven.io/
2. **Select your project** → **PostgreSQL service**
3. **Go to "Network" or "Firewall" tab**
4. **Add firewall rule**:
   - **Option A (Easiest for testing)**: Allow all IPs `0.0.0.0/0`
   - **Option B (More secure)**: Add Heroku's IP ranges (check Heroku docs for current ranges)

**Important**: Aiven requires explicit firewall rules. Without this, connections will fail with DNS errors.

### Step 2: Use Connection Pooler (Recommended)

Aiven connection poolers are more reliable for cloud deployments:

1. **In Aiven Console**, find your **Connection Pooler** hostname
   - Look for "Connection Pooler" section in your service
   - Hostname format: `pg-xxxxx-pooler.aivencloud.com`
   - Port: Usually `25060`

2. **Update Heroku config with pooler**:
   ```powershell
   heroku config:set DB_HOST="your-pooler-hostname-pooler.aivencloud.com" -a leadflow-backend
   heroku config:set DB_PORT="25060" -a leadflow-backend
   ```

### Step 3: Verify Current Config

Your current config:
```
DB_HOST: pg-6a22f4ddd5634b84bb2ed73ed3b8257d-leadflow1640731334-choreo-o.f.aivencloud.com
DB_PORT: 12623
DB_NAME: defaultdb
DB_USER: avnadmin
```

### Step 4: Test Connection After Firewall Update

After updating Aiven firewall, test:

```powershell
heroku run python backend/manage.py dbshell -a leadflow-backend
```

If that works, run migrations:
```powershell
heroku run python backend/manage.py migrate -a leadflow-backend
```

## Alternative: Use Aiven Connection String

If you have the full connection string from Aiven:

1. **Get connection string** from Aiven Console (usually in "Connection Information")
2. **Parse it** - format is:
   ```
   postgres://avnadmin:password@hostname:port/defaultdb?sslmode=require
   ```
3. **Set individual variables** on Heroku

## Quick Fix Commands

**If you want to try the pooler approach:**

```powershell
# First, get the pooler hostname from Aiven Console, then:
heroku config:set DB_HOST="your-pooler-hostname-pooler.aivencloud.com" -a leadflow-backend
heroku config:set DB_PORT="25060" -a leadflow-backend
```

**Then deploy and test:**
```powershell
git push heroku main
heroku run python backend/manage.py migrate -a leadflow-backend
```

## Most Likely Fix

**The #1 issue is the Aiven firewall.** Go to Aiven Console → Your PostgreSQL Service → Network/Firewall → Add rule to allow `0.0.0.0/0` (or specific Heroku IPs).

After that, the connection should work immediately.

