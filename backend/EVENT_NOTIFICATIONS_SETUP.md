# Event Notifications Setup

This document explains how to set up event notifications that are sent via WebSocket when:
1. A user is assigned to an event
2. 30 minutes before an event
3. 5 minutes before an event

## Features

- **Real-time notifications**: When a user is assigned to an event, they receive an immediate WebSocket notification
- **Scheduled reminders**: Notifications are sent 30 minutes and 5 minutes before event start time
- **Popup notifications**: Frontend displays popup notifications for event assignments and reminders
- **Database persistence**: Notifications are also stored in the database for history

## Backend Implementation

### 1. Notification Function

The `send_event_notification()` function in `backend/api/views.py` handles sending notifications:
- Creates WebSocket notifications via Django Channels
- Creates database notifications for persistence
- Supports different notification types: 'assigned', '30min_before', '5min_before'

### 2. Event Creation/Update

When events are created or updated:
- If a user is assigned (or assignment changes), a notification is automatically sent
- The notification includes event details, contact information, and datetime

### 3. Scheduled Notifications

A Django management command `check_event_notifications` checks for upcoming events:
- Runs periodically (should be scheduled via cron or task scheduler)
- Finds events 30 minutes and 5 minutes before their datetime
- Sends notifications to assigned users

## Frontend Implementation

### Components

- **EventPopup**: Displays event notification popups with event details
- **EventPopupWrapper**: Wrapper component that listens for event notifications
- **UnreadMessagesContext**: Extended to handle event notifications via WebSocket

### WebSocket Handling

The frontend listens for `event_notification` messages via WebSocket and displays popups automatically.

## Setup Instructions

### 1. Run Migrations (if needed)

```bash
cd backend
python manage.py migrate
```

### 2. Schedule the Management Command

The `check_event_notifications` command needs to run periodically (recommended: every minute).

#### Option A: Using Cron (Linux/Mac)

Add to crontab (`crontab -e`):

```bash
# Run every minute
* * * * * cd /path/to/LeadFlow/backend && python manage.py check_event_notifications
```

#### Option B: Using Windows Task Scheduler

1. Open Task Scheduler
2. Create Basic Task
3. Set trigger to "Daily" and repeat every 1 minute
4. Set action to run: `python manage.py check_event_notifications`
5. Set "Start in" directory to your backend folder

#### Option C: Using Heroku Scheduler

Add to your `Procfile`:

```
scheduler: python manage.py check_event_notifications
```

Then add Heroku Scheduler addon and configure it to run every minute.

#### Option D: Using Celery (Advanced)

For production environments, consider using Celery with periodic tasks:

```python
# In your Celery configuration
from celery.schedules import crontab

app.conf.beat_schedule = {
    'check-event-notifications': {
        'task': 'api.tasks.check_event_notifications',
        'schedule': crontab(minute='*'),  # Every minute
    },
}
```

### 3. Test the Setup

1. **Test assignment notification:**
   - Create or update an event with a user assigned
   - The user should receive an immediate notification popup

2. **Test scheduled notifications:**
   - Create an event scheduled for 35 minutes from now
   - Wait 5 minutes (or manually run the command)
   - The user should receive a 30-minute reminder
   - Wait another 25 minutes (or manually run the command)
   - The user should receive a 5-minute reminder

### 4. Manual Testing

You can manually run the command to test:

```bash
cd backend
python manage.py check_event_notifications
```

## Notification Types

### Assignment Notification (`assigned`)
- Sent immediately when a user is assigned to an event
- Title: "Nouvel événement assigné"
- Includes event datetime and contact information

### 30-Minute Reminder (`30min_before`)
- Sent 30 minutes before event start
- Title: "Rappel événement"
- Message: "Votre événement commence dans 30 minutes"

### 5-Minute Reminder (`5min_before`)
- Sent 5 minutes before event start
- Title: "Rappel événement"
- Message: "Votre événement commence dans 5 minutes"

## Preventing Duplicate Notifications

The current implementation may send duplicate notifications if the command runs multiple times within the notification window. To prevent this in production:

1. **Add a flag to Event model** to track which notifications have been sent
2. **Check notification history** before sending
3. **Use a more sophisticated scheduling system** (e.g., Celery with proper task deduplication)

## Troubleshooting

### Notifications not appearing

1. Check WebSocket connection in browser console
2. Verify the management command is running
3. Check Django logs for errors
4. Verify event datetime is in the future

### Duplicate notifications

- This is expected if the command runs multiple times within the window
- Consider implementing deduplication logic

### Timezone issues

- Ensure Django `USE_TZ = True` in settings
- Events should use timezone-aware datetimes
- The management command uses `timezone.now()` which respects timezone settings

## Files Modified/Created

### Backend
- `backend/api/views.py` - Added `send_event_notification()` function and updated event_create/event_update
- `backend/api/consumers.py` - Added `event_notification` handler
- `backend/api/management/commands/check_event_notifications.py` - New management command

### Frontend
- `frontend/src/components/EventPopup.tsx` - New component
- `frontend/src/components/EventPopupWrapper.tsx` - New wrapper component
- `frontend/src/styles/EventPopup.css` - New styles
- `frontend/src/contexts/UnreadMessagesContext.tsx` - Extended to handle event notifications
- `frontend/src/App.tsx` - Added EventPopupWrapper

