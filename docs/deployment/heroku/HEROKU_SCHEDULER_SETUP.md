# Heroku Scheduler Setup for Event Notifications

This guide explains how to configure Heroku Scheduler to run the `check_event_notifications` command every 10 minutes (minimum interval). The command sends reminders 30 minutes and 10 minutes before events.

## Step 1: Add Heroku Scheduler Addon

### Option A: Using Heroku Dashboard (Recommended)

1. Go to your Heroku Dashboard: https://dashboard.heroku.com
2. Select your app (e.g., `leadflow-backend-eu`)
3. Click on the **"Resources"** tab
4. In the "Add-ons" section, search for **"Heroku Scheduler"**
5. Click **"Install Heroku Scheduler"**
6. Select the free plan (or paid plan if needed)
7. Click **"Submit Order Form"**

### Option B: Using Heroku CLI

```bash
heroku addons:create scheduler:standard -a leadflow-backend-eu
```

**Note:** Replace `leadflow-backend-eu` with your actual Heroku app name.

## Step 2: Configure the Scheduled Job

### Option A: Using Heroku Dashboard

1. After installing the addon, click on **"Heroku Scheduler"** in your addons list
2. Click **"Create job"**
3. Configure the job:
   - **Schedule:** Select `Every 10 minutes` (Heroku Scheduler minimum interval)
   - **Run Command:** `cd backend && python manage.py check_event_notifications`
   - **Dyno Size:** Standard-1X (recommended) or Eco (if on free tier)
4. Click **"Save Job"**

**Important:** Heroku Scheduler's minimum interval is 10 minutes. The command is optimized for this:
- Checks for events 30 minutes before (with 2-minute window)
- Checks for events 10 minutes before (with 2-minute window)
- Running every 10 minutes ensures all reminders are sent reliably

### Option B: Using Heroku CLI

```bash
# Create a scheduled job (runs every 10 minutes - minimum interval)
heroku addons:open scheduler -a leadflow-backend-eu
```

Then follow the dashboard instructions above.

## Step 3: Verify the Setup

### Test the Command Manually First

Before relying on the scheduler, test the command manually:

```bash
heroku run bash -c "cd backend && python manage.py check_event_notifications" -a leadflow-backend-eu
```

You should see output like:
```
Checking for event notifications at 2024-01-15 10:00:00+00:00
5-minute window: 2024-01-15 10:03:00+00:00 to 2024-01-15 10:07:00+00:00
30-minute window: 2024-01-15 10:28:00+00:00 to 2024-01-15 10:32:00+00:00
Found 0 events in 30-minute window
Found 0 events in 5-minute window
Processed 0 30-minute notifications and 0 5-minute notifications
```

### Check Scheduler Logs

After the scheduler runs, check the logs:

```bash
heroku logs --tail -a leadflow-backend-eu | grep "check_event_notifications"
```

Or view all recent logs:

```bash
heroku logs --tail -a leadflow-backend-eu
```

## Step 4: Monitor Scheduled Jobs

### View Scheduled Jobs

```bash
heroku addons:open scheduler -a leadflow-backend-eu
```

This opens the Heroku Scheduler dashboard where you can:
- See all scheduled jobs
- View job execution history
- Edit or delete jobs
- See when jobs last ran

### Check Job Status

In the Heroku Scheduler dashboard, you'll see:
- **Last Run:** When the job last executed
- **Next Run:** When it will run next
- **Status:** Success/Failure indicators

## Important Notes

### Heroku Scheduler Limitations

1. **Minimum Interval:** Heroku Scheduler can only run jobs every 10 minutes minimum (not every minute)
2. **Reliability:** The command uses a 2-minute window, so running every 10 minutes will still catch events reliably
3. **Cost:** Heroku Scheduler is free, but the dyno that runs the job will consume dyno hours

### Alternative: More Frequent Execution

If you need more frequent execution (every minute), consider:

1. **Using a separate worker dyno** with a custom scheduler script
2. **Using APScheduler** within your Django app
3. **Using Celery Beat** with Redis (requires Celery setup)

### Recommended Configuration

Running every 10 minutes is optimal because:
- The command checks a 2-minute window around the target time
- Events are checked 30 minutes and 10 minutes before their start time
- The 10-minute reminder aligns perfectly with the scheduler's 10-minute interval
- The wider window ensures events aren't missed even with slight timing variations

## Troubleshooting

### Job Not Running

1. **Check if scheduler addon is installed:**
   ```bash
   heroku addons -a leadflow-backend-eu
   ```

2. **Verify the job exists:**
   ```bash
   heroku addons:open scheduler -a leadflow-backend-eu
   ```

3. **Check logs for errors:**
   ```bash
   heroku logs --tail -a leadflow-backend-eu
   ```

### Command Fails

1. **Test the command manually:**
   ```bash
   heroku run bash -c "cd backend && python manage.py check_event_notifications" -a leadflow-backend-eu
   ```

2. **Check for missing dependencies:**
   ```bash
   heroku run bash -c "cd backend && python manage.py check_event_notifications" -a leadflow-backend-eu
   ```

3. **Verify database connection:**
   ```bash
   heroku run bash -c "cd backend && python manage.py dbshell" -a leadflow-backend-eu
   ```

### Notifications Not Being Sent

1. **Check WebSocket/Redis connection:**
   ```bash
   heroku config:get REDIS_URL -a leadflow-backend-eu
   ```

2. **Verify events exist:**
   ```bash
   heroku run bash -c "cd backend && python manage.py shell" -a leadflow-backend-eu
   ```
   Then in the shell:
   ```python
   from api.models import Event
   from django.utils import timezone
   from datetime import timedelta
   
   # Check events in next 35 minutes
   now = timezone.now()
   future = now + timedelta(minutes=35)
   events = Event.objects.filter(datetime__gte=now, datetime__lte=future)
   print(f"Found {events.count()} events")
   for event in events:
       print(f"Event {event.id}: {event.datetime}, User: {event.userId}")
   ```

## Quick Reference Commands

```bash
# Add scheduler addon
heroku addons:create scheduler:standard -a leadflow-backend-eu

# Open scheduler dashboard
heroku addons:open scheduler -a leadflow-backend-eu

# Test command manually
heroku run bash -c "cd backend && python manage.py check_event_notifications" -a leadflow-backend-eu

# View logs
heroku logs --tail -a leadflow-backend-eu

# Check addons
heroku addons -a leadflow-backend-eu
```

## Command to Use in Scheduler

When configuring the job in Heroku Scheduler dashboard, use:

```
cd backend && python manage.py check_event_notifications
```

This ensures the command runs from the correct directory where `manage.py` is located.

