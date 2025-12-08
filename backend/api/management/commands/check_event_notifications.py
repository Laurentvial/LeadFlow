from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from api.models import Event
from api.views import send_event_notification


class Command(BaseCommand):
    help = 'Check for upcoming events and send notifications 30 minutes and 5 minutes before'

    def handle(self, *args, **options):
        now = timezone.now()
        
        # Only check future events
        # Check for events 30 minutes from now (with 1 minute window to account for timing)
        thirty_min_from_now = now + timedelta(minutes=30)
        thirty_min_window_start = thirty_min_from_now - timedelta(minutes=1)
        thirty_min_window_end = thirty_min_from_now + timedelta(minutes=1)
        
        # Check for events 5 minutes from now (with 1 minute window)
        five_min_from_now = now + timedelta(minutes=5)
        five_min_window_start = five_min_from_now - timedelta(minutes=1)
        five_min_window_end = five_min_from_now + timedelta(minutes=1)
        
        # Find events in the 30-minute window (only future events)
        events_30min = Event.objects.filter(
            datetime__gte=thirty_min_window_start,
            datetime__lte=thirty_min_window_end,
            datetime__gt=now  # Ensure event is in the future
        ).select_related('userId', 'contactId')
        
        # Find events in the 5-minute window (only future events)
        events_5min = Event.objects.filter(
            datetime__gte=five_min_window_start,
            datetime__lte=five_min_window_end,
            datetime__gt=now  # Ensure event is in the future
        ).select_related('userId', 'contactId')
        
        # Send 30-minute notifications
        count_30min = 0
        for event in events_30min:
            if event.userId:
                # Check if we already sent a 30-minute notification for this event
                # We'll use the notification data field to track this
                # For simplicity, we'll send it every time the command runs within the window
                # In production, you might want to add a flag to Event model or check notification history
                try:
                    send_event_notification(event, notification_type='30min_before', minutes_before=30)
                    count_30min += 1
                    self.stdout.write(
                        self.style.SUCCESS(
                            f'Sent 30-minute notification for event {event.id} (user: {event.userId.username})'
                        )
                    )
                except Exception as e:
                    self.stdout.write(
                        self.style.ERROR(
                            f'Error sending 30-minute notification for event {event.id}: {str(e)}'
                        )
                    )
        
        # Send 5-minute notifications
        count_5min = 0
        for event in events_5min:
            if event.userId:
                try:
                    send_event_notification(event, notification_type='5min_before', minutes_before=5)
                    count_5min += 1
                    self.stdout.write(
                        self.style.SUCCESS(
                            f'Sent 5-minute notification for event {event.id} (user: {event.userId.username})'
                        )
                    )
                except Exception as e:
                    self.stdout.write(
                        self.style.ERROR(
                            f'Error sending 5-minute notification for event {event.id}: {str(e)}'
                        )
                    )
        
        self.stdout.write(
            self.style.SUCCESS(
                f'Processed {count_30min} 30-minute notifications and {count_5min} 5-minute notifications'
            )
        )

