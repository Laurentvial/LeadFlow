from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from api.models import Event, Notification
from api.views import send_event_notification
import traceback


class Command(BaseCommand):
    help = 'Check for upcoming events and send notifications 5 minutes before'

    def handle(self, *args, **options):
        now = timezone.now()
        
        self.stdout.write(f'Checking for event notifications at {now}')
        
        # Use wider windows (2 minutes) to account for scheduling delays
        # This makes the command more reliable if it doesn't run exactly every minute
        # DISABLED: Check for events 30 minutes from now (with 2 minute window)
        # thirty_min_from_now = now + timedelta(minutes=30)
        # thirty_min_window_start = thirty_min_from_now - timedelta(minutes=2)
        # thirty_min_window_end = thirty_min_from_now + timedelta(minutes=2)
        
        # DISABLED: Check for events 10 minutes from now (with 2 minute window)
        # ten_min_from_now = now + timedelta(minutes=10)
        # ten_min_window_start = ten_min_from_now - timedelta(minutes=2)
        # ten_min_window_end = ten_min_from_now + timedelta(minutes=2)
        
        # Check for events 5 minutes from now (with wider 3 minute window to account for 10-minute scheduler interval)
        five_min_from_now = now + timedelta(minutes=5)
        five_min_window_start = five_min_from_now - timedelta(minutes=3)
        five_min_window_end = five_min_from_now + timedelta(minutes=3)
        
        self.stdout.write(f'5-minute window: {five_min_window_start} to {five_min_window_end}')
        # self.stdout.write(f'10-minute window: {ten_min_window_start} to {ten_min_window_end}')
        # self.stdout.write(f'30-minute window: {thirty_min_window_start} to {thirty_min_window_end}')
        
        # DISABLED: Find events in the 30-minute window (only future events)
        # events_30min = Event.objects.filter(
        #     datetime__gte=thirty_min_window_start,
        #     datetime__lte=thirty_min_window_end,
        #     datetime__gt=now  # Ensure event is in the future
        # ).select_related('userId', 'contactId')
        
        # DISABLED: Find events in the 10-minute window (only future events)
        # events_10min = Event.objects.filter(
        #     datetime__gte=ten_min_window_start,
        #     datetime__lte=ten_min_window_end,
        #     datetime__gt=now  # Ensure event is in the future
        # ).select_related('userId', 'contactId')
        
        # Find events in the 5-minute window (only future events)
        events_5min = Event.objects.filter(
            datetime__gte=five_min_window_start,
            datetime__lte=five_min_window_end,
            datetime__gt=now  # Ensure event is in the future
        ).select_related('userId', 'contactId')
        
        # self.stdout.write(f'Found {events_30min.count()} events in 30-minute window')
        # for event in events_30min:
        #     self.stdout.write(f'  - Event {event.id}: datetime={event.datetime}, userId={event.userId.id if event.userId else None}')
        
        # self.stdout.write(f'Found {events_10min.count()} events in 10-minute window')
        # for event in events_10min:
        #     self.stdout.write(f'  - Event {event.id}: datetime={event.datetime}, userId={event.userId.id if event.userId else None}')
        
        self.stdout.write(f'Found {events_5min.count()} events in 5-minute window')
        for event in events_5min:
            self.stdout.write(f'  - Event {event.id}: datetime={event.datetime}, userId={event.userId.id if event.userId else None}')
        
        # DISABLED: Send 30-minute notifications
        # count_30min = 0
        # for event in events_30min:
        #     if event.userId:
        #         # Check if we already sent a 30-minute notification for this event
        #         # Check all event notifications for this event and verify notification_type in data
        #         all_event_notifications = Notification.objects.filter(
        #             user=event.userId,
        #             event_id=event.id,
        #             type='event'
        #         )
        #         already_sent = False
        #         for notif in all_event_notifications:
        #             if notif.data and notif.data.get('notification_type') == '30min_before':
        #                 already_sent = True
        #                 self.stdout.write(
        #                     f'Skipping 30-minute notification for event {event.id} - already sent (notification ID: {notif.id})'
        #                 )
        #                 break
        #         
        #         if already_sent:
        #             continue
        #         
        #         try:
        #             send_event_notification(event, notification_type='30min_before', minutes_before=30)
        #             count_30min += 1
        #             self.stdout.write(
        #                 self.style.SUCCESS(
        #                     f'Sent 30-minute notification for event {event.id} (user: {event.userId.username or event.userId.email})'
        #                 )
        #             )
        #         except Exception as e:
        #             self.stdout.write(
        #                 self.style.ERROR(
        #                     f'Error sending 30-minute notification for event {event.id}: {str(e)}'
        #                 )
        #             )
        #             self.stdout.write(traceback.format_exc())
        
        # DISABLED: Send 10-minute notifications
        # count_10min = 0
        # for event in events_10min:
        #     if event.userId:
        #         # Check if we already sent a 10-minute notification for this event
        #         all_event_notifications = Notification.objects.filter(
        #             user=event.userId,
        #             event_id=event.id,
        #             type='event'
        #         )
        #         already_sent = False
        #         for notif in all_event_notifications:
        #             if notif.data and notif.data.get('notification_type') == '10min_before':
        #                 already_sent = True
        #                 self.stdout.write(
        #                     f'Skipping 10-minute notification for event {event.id} - already sent (notification ID: {notif.id})'
        #                 )
        #                 break
        #         
        #         if already_sent:
        #             continue
        #         
        #         try:
        #             send_event_notification(event, notification_type='10min_before', minutes_before=10)
        #             count_10min += 1
        #             self.stdout.write(
        #                 self.style.SUCCESS(
        #                     f'Sent 10-minute notification for event {event.id} (user: {event.userId.username or event.userId.email})'
        #                 )
        #             )
        #         except Exception as e:
        #             self.stdout.write(
        #                 self.style.ERROR(
        #                     f'Error sending 10-minute notification for event {event.id}: {str(e)}'
        #                 )
        #             )
        #             self.stdout.write(traceback.format_exc())
        
        # Send 5-minute notifications
        count_5min = 0
        for event in events_5min:
            if event.userId:
                # Check if we already sent a 5-minute notification for this event
                all_event_notifications = Notification.objects.filter(
                    user=event.userId,
                    event_id=event.id,
                    type='event'
                )
                already_sent = False
                for notif in all_event_notifications:
                    if notif.data and notif.data.get('notification_type') == '5min_before':
                        already_sent = True
                        self.stdout.write(
                            f'Skipping 5-minute notification for event {event.id} - already sent (notification ID: {notif.id})'
                        )
                        break
                
                if already_sent:
                    continue
                
                try:
                    send_event_notification(event, notification_type='5min_before', minutes_before=5)
                    count_5min += 1
                    self.stdout.write(
                        self.style.SUCCESS(
                            f'Sent 5-minute notification for event {event.id} (user: {event.userId.username or event.userId.email})'
                        )
                    )
                except Exception as e:
                    self.stdout.write(
                        self.style.ERROR(
                            f'Error sending 5-minute notification for event {event.id}: {str(e)}'
                        )
                    )
                    self.stdout.write(traceback.format_exc())
        
        self.stdout.write(
            self.style.SUCCESS(
                f'Processed {count_5min} 5-minute notifications'
            )
        )

