# Cleanup Unused Redis Add-ons

## Problem
You have **4 Redis add-ons** installed, but Django Channels only needs **one**. Multiple Redis instances can cause confusion and WebSocket issues.

## Step 1: Check Which Redis is Currently Being Used

**Check which Redis addon is setting REDIS_URL:**
```bash
heroku config:get REDIS_URL -a leadflow-backend-eu
```

**Check all Redis-related environment variables:**
```bash
heroku config -a leadflow-backend-eu | Select-String -Pattern "REDIS"
```

**Windows PowerShell:**
```powershell
heroku config -a leadflow-backend-eu | Select-String -Pattern "REDIS"
```

## Step 2: Identify the Primary Redis Addon

Based on your screenshot, you have:
1. `redis-asymmetrical-21744` - Attached as `HEROKU_REDIS_BLACK` (Premium 0)
2. `redis-concentric-43903` - Attached as `HEROKU_REDIS_ROSE` (Mini)
3. `redis-curved-84664` - Attached as `HEROKU_REDIS_WHITE` (Premium 0)
4. `redis-trapezoidal-11793` - Attached as `REDIS` (Premium 0) ⭐ **This is likely the primary one**

**The one attached as `REDIS` is probably the one being used** because Heroku automatically sets `REDIS_URL` when an addon is attached with the standard name.

## Step 3: Remove Unused Redis Add-ons

**Keep only ONE Redis addon** - preferably the one attached as `REDIS` (redis-trapezoidal-11793).

### Remove the unused ones:

```bash
# Remove HEROKU_REDIS_BLACK
heroku addons:destroy redis-asymmetrical-21744 -a leadflow-backend-eu

# Remove HEROKU_REDIS_ROSE  
heroku addons:destroy redis-concentric-43903 -a leadflow-backend-eu

# Remove HEROKU_REDIS_WHITE
heroku addons:destroy redis-curved-84664 -a leadflow-backend-eu
```

**Or remove all at once:**
```bash
heroku addons:destroy redis-asymmetrical-21744 redis-concentric-43903 redis-curved-84664 -a leadflow-backend-eu
```

**Windows PowerShell:**
```powershell
heroku addons:destroy redis-asymmetrical-21744 -a leadflow-backend-eu
heroku addons:destroy redis-concentric-43903 -a leadflow-backend-eu
heroku addons:destroy redis-curved-84664 -a leadflow-backend-eu
```

## Step 4: Verify Configuration

**After removing unused addons, verify:**

1. **Check REDIS_URL is set:**
   ```bash
   heroku config:get REDIS_URL -a leadflow-backend-eu
   ```
   Should return a Redis URL starting with `rediss://` or `redis://`

2. **Check only one Redis addon remains:**
   ```bash
   heroku addons -a leadflow-backend-eu
   ```
   Should show only one Redis addon (the one attached as `REDIS`)

3. **Restart the app:**
   ```bash
   heroku restart -a leadflow-backend-eu
   ```

4. **Check logs for Redis connection:**
   ```bash
   heroku logs --tail -a leadflow-backend-eu | Select-String -Pattern "redis" -CaseSensitive:$false
   ```

## Step 5: Test WebSocket Connection

After cleanup:
1. Open your production site
2. Open browser console (F12)
3. Check for WebSocket connection errors
4. Test sending a notification - should work immediately

## Important Notes

- **Only keep ONE Redis addon** - Django Channels needs a single Redis instance
- The addon attached as `REDIS` is the standard one that sets `REDIS_URL`
- Removing unused addons will **save money** (~$50-60/month)
- After removing addons, restart your dynos to ensure clean connection

## If REDIS_URL is Not Set After Cleanup

If `REDIS_URL` is not set after keeping only one addon:

1. **Reattach the Redis addon with standard name:**
   ```bash
   heroku addons:attach redis-trapezoidal-11793 -a leadflow-backend-eu --as REDIS
   ```

2. **Or create a new Redis addon:**
   ```bash
   heroku addons:create heroku-redis:premium-0 -a leadflow-backend-eu
   ```
   This will automatically set `REDIS_URL`

## Cost Savings

**Before:** ~$73/month (4 Redis addons)
**After:** ~$15/month (1 Redis addon)
**Savings:** ~$58/month

