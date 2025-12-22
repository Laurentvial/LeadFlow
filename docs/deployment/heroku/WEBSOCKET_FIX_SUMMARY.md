# WebSocket Notification Fix Summary

## Problem
Live notifications were not appearing in production without page refresh, even though WebSocket infrastructure was set up. This affected:
- Regular notifications (system, contact, email, etc.)
- Message notifications (chat messages)

## Root Cause
When notifications were created in the database (for contacts, emails, etc.), they were **not being sent via WebSocket**. Only event notifications were being sent via WebSocket through the `send_event_notification` function.

## Solution Implemented

### 1. Added Signal Handler for Notifications
**File:** `backend/api/signals.py`

Added a Django signal handler that automatically sends notifications via WebSocket when they're created:

```python
@receiver(post_save, sender=Notification)
def send_notification_via_websocket(sender, instance, created, **kwargs):
    """
    When a Notification is created, send it via WebSocket to the user.
    Skip event notifications as they are handled separately by send_event_notification.
    """
```

**What it does:**
- Listens for new Notification objects being created
- Skips event and message notifications (handled separately)
- Sends notification via WebSocket channel layer to the user's notification group
- Includes unread count in the message

### 2. How It Works

```
Notification Created (Database)
    ↓
Django Signal Fires (post_save)
    ↓
send_notification_via_websocket() called
    ↓
Channel Layer (Redis) → Group: notifications_{user_id}
    ↓
NotificationConsumer.send_notification() receives message
    ↓
WebSocket sends to frontend
    ↓
Frontend receives and displays notification
```

## Files Modified

1. **backend/api/signals.py**
   - Added `send_notification_via_websocket` signal handler
   - Added imports for `Notification`, `get_channel_layer`, `async_to_sync`, `logging`

## Deployment Steps

### 1. Deploy Backend Changes
```bash
git add backend/api/signals.py
git commit -m "Add WebSocket signal handler for notifications"
git push heroku main
```

### 2. Verify Deployment
```bash
# Check logs for signal handler activity
heroku logs --tail -a leadflow-backend-eu | grep send_notification_via_websocket
```

### 3. Test Notifications
1. Create a notification (e.g., update a contact)
2. Check browser console - should see notification appear immediately
3. Check Heroku logs - should see `[send_notification_via_websocket] Sent notification`

## Verification Checklist

- [ ] Signal handler code deployed to Heroku
- [ ] Redis addon is installed and running
- [ ] WebSocket connection is active (check browser console)
- [ ] Test notification appears immediately without refresh
- [ ] Heroku logs show notification sending messages

## Testing

### Test 1: Message Notifications
1. Open app in two browser windows/tabs
2. In Tab 1: Send a chat message to a user
3. In Tab 2: Should see message popup appear immediately without refresh

### Test 2: Create a System Notification
```python
# In Django shell on Heroku
from api.models import Notification
from django.contrib.auth.models import User

user = User.objects.first()
notification = Notification.objects.create(
    user=user,
    type='system',
    title='Test Notification',
    message='This should appear immediately via WebSocket'
)
```

**Expected:** Notification appears in browser immediately without refresh.

### Test 3: Update a Contact
1. Update a contact that triggers a notification
2. Check if notification appears in real-time
3. Verify in Heroku logs that signal fired

### Test 4: Check Logs
```bash
heroku logs --tail -a leadflow-backend-eu | grep -i notification
```

Should see:
- `[send_notification_via_websocket] Sent notification {id} to user {user_id}`

## Troubleshooting

If notifications still don't appear:

1. **Check signal is registered:**
   - Verify `api/signals.py` is imported in `api/apps.py`
   - Check `ready()` method imports signals

2. **Check channel layer:**
   - Verify Redis is running: `heroku addons -a your-app`
   - Check `REDIS_URL` is set: `heroku config:get REDIS_URL -a your-app`

3. **Check WebSocket connection:**
   - Browser console should show WebSocket connected
   - Network tab should show WebSocket connection with status 101

4. **Check notification type:**
   - Event notifications use `send_event_notification()` function
   - Message notifications use chat WebSocket
   - Other notifications use the signal handler

See `WEBSOCKET_TROUBLESHOOTING.md` for detailed troubleshooting steps.

## Notes

- **Event notifications** (`type='event'`): Handled by `send_event_notification()` function, not the signal
- **Message notifications** (`type='message'`): Handled by chat WebSocket via `chat_message_{user_id}` group, not the signal
  - Messages are sent to `chat_message_{user_id}` group (different from `notifications_{user_id}`)
  - The `NotificationConsumer` joins both groups, so it receives both regular notifications and message notifications
  - Message notifications are NOT stored in the database (only sent via WebSocket)
  - Frontend receives them as `'new_message'` type messages
- **Other notifications** (system, contact, email, etc.): Handled by the signal handler
- If channel layer is not available, notification is still saved to database but not sent via WebSocket

## Message Notifications Flow

```
Chat Message Created
    ↓
views.py: chat_messages() sends to chat_message_{user_id} group
    ↓
NotificationConsumer.new_message() receives (via chat_message group)
    ↓
WebSocket sends 'new_message' type to frontend
    ↓
UnreadMessagesContext receives and shows popup
```

**Note:** Message notifications work because they use the same Redis channel layer infrastructure. When Redis is properly configured, both regular notifications and message notifications work correctly.

