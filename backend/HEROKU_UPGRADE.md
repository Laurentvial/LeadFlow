# Upgrading Heroku Dyno Configuration

## Current Configuration

Your app is currently on the **Basic** dyno type (as seen in logs: `run.4415 (Basic)`).

## Available Heroku Dyno Types

### 1. **Eco Dyno** (Free tier - deprecated, but still available)
- **Memory:** 512 MB RAM
- **CPU:** Shared, burstable
- **Cost:** Free (with limitations)
- **Best for:** Development/testing only

### 2. **Basic Dyno** (Current)
- **Memory:** 512 MB RAM
- **CPU:** Shared, burstable
- **Cost:** $5/month per dyno
- **Best for:** Small applications, low traffic
- **Limitations:** 
  - Sleeps after 30 minutes of inactivity (on free tier)
  - Limited CPU resources

### 3. **Standard-1X Dyno** (Recommended upgrade)
- **Memory:** 512 MB RAM
- **CPU:** Dedicated, guaranteed
- **Cost:** $25/month per dyno
- **Best for:** Production applications with moderate traffic
- **Benefits:**
  - Never sleeps
  - Better performance
  - More reliable

### 4. **Standard-2X Dyno**
- **Memory:** 1 GB RAM
- **CPU:** Dedicated, guaranteed (2x performance)
- **Cost:** $50/month per dyno
- **Best for:** Production applications with high traffic
- **Benefits:**
  - More memory for larger applications
  - Better performance for CPU-intensive tasks

### 5. **Performance-M Dyno**
- **Memory:** 2.5 GB RAM
- **CPU:** Dedicated, guaranteed (higher performance)
- **Cost:** $250/month per dyno
- **Best for:** High-traffic production applications

### 6. **Performance-L Dyno**
- **Memory:** 14 GB RAM
- **CPU:** Dedicated, guaranteed (highest performance)
- **Cost:** $500/month per dyno
- **Best for:** Enterprise-level applications

## How to Upgrade Your Dyno

### Option 1: Upgrade via Heroku CLI

**Upgrade to Standard-1X (Recommended):**
```powershell
heroku ps:resize web=standard-1x --app leadflow-backend-eu
```

**Upgrade to Standard-2X:**
```powershell
heroku ps:resize web=standard-2x --app leadflow-backend-eu
```

**Check current dyno type:**
```powershell
heroku ps --app leadflow-backend-eu
```

### Option 2: Upgrade via Heroku Dashboard

1. Go to https://dashboard.heroku.com/apps/leadflow-backend-eu
2. Click on **Settings** tab
3. Scroll to **Dyno formation**
4. Click **Change dyno type**
5. Select your desired dyno type
6. Click **Confirm**

## Recommended Upgrade Path

### For Production Use:
**Start with Standard-1X** ($25/month)
- Never sleeps
- Better performance
- Good for most production applications

**Upgrade to Standard-2X** if you need:
- More memory (1 GB)
- Better CPU performance
- Handling more concurrent requests

### For Development/Testing:
**Keep Basic** ($5/month) or use **Eco** (free with limitations)

## Database Upgrade Options

You may also want to upgrade your PostgreSQL database:

### Current: `heroku-postgresql:mini`
- **Size:** 10,000 rows
- **Cost:** Free (with limitations)
- **Backups:** Manual only

### Upgrade Options:

**Standard-0** ($50/month):
- 10 GB storage
- Automatic backups
- Better performance

**Standard-1** ($200/month):
- 64 GB storage
- Point-in-time recovery
- Better performance

**Upgrade database:**
```powershell
heroku addons:upgrade heroku-postgresql:standard-0 --app leadflow-backend-eu
```

## Cost Comparison

### Current Setup (Basic):
- Dyno: $5/month
- Database: Free (mini)
- **Total: ~$5/month**

### Recommended Production Setup:
- Dyno: $25/month (Standard-1X)
- Database: $50/month (Standard-0)
- **Total: ~$75/month**

### High-Performance Setup:
- Dyno: $50/month (Standard-2X)
- Database: $200/month (Standard-1)
- **Total: ~$250/month**

## After Upgrading

1. **Restart your dynos:**
```powershell
heroku restart --app leadflow-backend-eu
```

2. **Monitor performance:**
```powershell
# Check dyno metrics
heroku ps --app leadflow-backend-eu

# View logs
heroku logs --tail --app leadflow-backend-eu
```

3. **Test your application:**
```powershell
# Test health endpoint
Invoke-RestMethod -Uri "https://leadflow-backend-eu-8d20fb5efc7b.herokuapp.com/health/" -UseBasicParsing
```

## Scaling Dynos

You can also scale horizontally (add more dynos):

```powershell
# Run 2 web dynos for better availability
heroku ps:scale web=2 --app leadflow-backend-eu

# Scale back to 1
heroku ps:scale web=1 --app leadflow-backend-eu
```

**Note:** Each dyno costs the same amount, so 2 Standard-1X dynos = $50/month.

## Monitoring and Optimization

### Check Dyno Metrics:
```powershell
heroku ps --app leadflow-backend-eu
```

### View Resource Usage:
- Go to Heroku Dashboard → Metrics tab
- Monitor memory usage, response times, throughput

### Optimize Before Upgrading:
1. Enable query optimization
2. Use caching (Redis addon)
3. Optimize database queries
4. Use CDN for static files

## Quick Commands Reference

```powershell
# Check current dyno type
heroku ps --app leadflow-backend-eu

# Upgrade to Standard-1X
heroku ps:resize web=standard-1x --app leadflow-backend-eu

# Upgrade to Standard-2X
heroku ps:resize web=standard-2x --app leadflow-backend-eu

# Scale to 2 dynos
heroku ps:scale web=2 --app leadflow-backend-eu

# Restart after upgrade
heroku restart --app leadflow-backend-eu

# Check addons (database)
heroku addons --app leadflow-backend-eu

# Upgrade database
heroku addons:upgrade heroku-postgresql:standard-0 --app leadflow-backend-eu
```

## Important Notes

- **Dyno changes take effect immediately** after restart
- **Database upgrades** may require a brief maintenance window
- **Costs are prorated** - you only pay for the time you use
- **Downgrades** are also possible if you need to reduce costs
- **Free tier limitations:** Eco dynos sleep after 30 minutes of inactivity

