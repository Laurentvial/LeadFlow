import json
import asyncio
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import User as DjangoUser
from rest_framework_simplejwt.tokens import UntypedToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from jwt import decode as jwt_decode
from django.conf import settings
from .models import ChatRoom, Message, Notification
import uuid


class NotificationConsumer(AsyncWebsocketConsumer):
    """WebSocket consumer for real-time notifications"""
    
    async def connect(self):
        """Handle WebSocket connection"""
        # Close old connections at the start
        from django.db import close_old_connections
        close_old_connections()
        
        import logging
        logger = logging.getLogger(__name__)
        
        # Get token from query string
        query_string = self.scope.get('query_string', b'').decode('utf-8')
        logger.info(f"[NotificationConsumer] Connection attempt. Query string: {query_string[:100]}")
        
        token = query_string.split('token=')[-1].split('&')[0] if 'token=' in query_string else ''
        
        if not token:
            logger.warning("[NotificationConsumer] No token provided, closing connection")
            close_old_connections()
            await self.close()
            return
        
        # Authenticate user
        try:
            # Decode and validate token
            UntypedToken(token)
            decoded_data = jwt_decode(token, settings.SECRET_KEY, algorithms=["HS256"])
            user_id = decoded_data.get('user_id')
            
            logger.info(f"[NotificationConsumer] Token decoded successfully. User ID: {user_id}")
            
            if not user_id:
                logger.warning("[NotificationConsumer] No user_id in token, closing connection")
                close_old_connections()
                await self.close()
                return
            
            # Get user
            self.user = await database_sync_to_async(DjangoUser.objects.get)(id=user_id)
            close_old_connections()  # Close after database query
            self.user_id = user_id
            
            logger.info(f"[NotificationConsumer] User found: {self.user.username}")
            
            # Check if channel_layer is available
            if not self.channel_layer:
                logger.error("[NotificationConsumer] No channel_layer available!")
                await self.close()
                return
            
            # Join user's notification group
            self.group_name = f'notifications_{self.user_id}'
            try:
                await self.channel_layer.group_add(
                    self.group_name,
                    self.channel_name
                )
                logger.info(f"[NotificationConsumer] Joined group: {self.group_name}")
            except Exception as e:
                logger.error(f"[NotificationConsumer] Error joining group {self.group_name}: {e}")
                await self.close()
                return
            
            # Also join chat message group for receiving message popups
            self.chat_message_group = f'chat_message_{self.user_id}'
            try:
                await self.channel_layer.group_add(
                    self.chat_message_group,
                    self.channel_name
                )
                logger.info(f"[NotificationConsumer] Joined group: {self.chat_message_group}")
            except Exception as e:
                logger.error(f"[NotificationConsumer] Error joining group {self.chat_message_group}: {e}")
                await self.close()
                return
            
            await self.accept()
            logger.info("[NotificationConsumer] Connection accepted")
            
            # Send unread notifications count
            unread_count = await database_sync_to_async(
                Notification.objects.filter(user=self.user, is_read=False).count
            )()
            
            # Close database connections after database operations
            from django.db import close_old_connections
            close_old_connections()
            
            await self.send(text_data=json.dumps({
                'type': 'connection_established',
                'unread_count': unread_count
            }))
            logger.info(f"[NotificationConsumer] Sent unread count: {unread_count}")
            
        except (InvalidToken, TokenError) as e:
            logger.error(f"[NotificationConsumer] Token error: {str(e)}")
            close_old_connections()
            await self.close()
        except DjangoUser.DoesNotExist as e:
            logger.error(f"[NotificationConsumer] User not found: {e}")
            close_old_connections()
            await self.close()
        except asyncio.CancelledError:
            # Connection was cancelled, this is normal when client disconnects
            logger.debug("[NotificationConsumer] Connection cancelled")
            close_old_connections()
            await self.close()
        except Exception as e:
            logger.error(f"[NotificationConsumer] Unexpected error: {type(e).__name__}: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            close_old_connections()
            await self.close()
    
    async def disconnect(self, close_code):
        """Handle WebSocket disconnection"""
        # Close database connections when WebSocket disconnects
        from django.db import close_old_connections
        close_old_connections()
        
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(
                self.group_name,
                self.channel_name
            )
        if hasattr(self, 'chat_message_group'):
            await self.channel_layer.group_discard(
                self.chat_message_group,
                self.channel_name
            )
        
        # Ensure connections are closed
        close_old_connections()
        from django.db import connections
        for conn in connections.all():
            try:
                conn.close()
            except:
                pass
    
    async def receive(self, text_data):
        """Handle messages received from WebSocket"""
        try:
            data = json.loads(text_data)
            message_type = data.get('type')
            
            if message_type == 'mark_read':
                # Mark notification as read
                notification_id = data.get('notification_id')
                if notification_id:
                    await database_sync_to_async(
                        Notification.objects.filter(
                            id=notification_id,
                            user=self.user
                        ).update
                    )(is_read=True)
                    
                    # Send updated unread count
                    unread_count = await database_sync_to_async(
                        Notification.objects.filter(user=self.user, is_read=False).count
                    )()
                    await self.send(text_data=json.dumps({
                        'type': 'unread_count_updated',
                        'unread_count': unread_count
                    }))
                    
                    # Close database connections after database operations
                    from django.db import close_old_connections
                    close_old_connections()
            
            elif message_type == 'mark_all_read':
                # Mark all notifications as read
                await database_sync_to_async(
                    Notification.objects.filter(user=self.user, is_read=False).update
                )(is_read=True)
                
                await self.send(text_data=json.dumps({
                    'type': 'unread_count_updated',
                    'unread_count': 0
                }))
                
        except json.JSONDecodeError:
            pass
    
    async def send_notification(self, event):
        """Send notification to WebSocket"""
        await self.send(text_data=json.dumps({
            'type': 'notification',
            'notification': event['notification'],
            'unread_count': event.get('unread_count', 0)
        }))
    
    async def notification_updated(self, event):
        """Send notification update to WebSocket"""
        await self.send(text_data=json.dumps({
            'type': 'notification_updated',
            'notification': event['notification'],
            'unread_count': event.get('unread_count', 0)
        }))
    
    async def new_message(self, event):
        """Send new message notification to WebSocket"""
        await self.send(text_data=json.dumps({
            'type': 'new_message',
            'message': event['message'],
            'chat_room_id': event.get('chat_room_id'),
            'is_new_chat_room': event.get('is_new_chat_room', False)
        }))
    
    async def new_chat_room(self, event):
        """Send new chat room notification to WebSocket"""
        await self.send(text_data=json.dumps({
            'type': 'new_chat_room',
            'chat_room': event['chat_room']
        }))
    
    async def event_notification(self, event):
        """Send event notification to WebSocket"""
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"[NotificationConsumer] Sending event_notification to user {self.user_id}: {event.get('notification', {}).get('notification_type', 'unknown')}")
        
        await self.send(text_data=json.dumps({
            'type': 'event_notification',
            'notification': event['notification']
        }))
        
        logger.info(f"[NotificationConsumer] Event notification sent successfully")


class ChatConsumer(AsyncWebsocketConsumer):
    """WebSocket consumer for real-time chat"""
    
    async def connect(self):
        """Handle WebSocket connection"""
        # Close old connections at the start
        from django.db import close_old_connections
        close_old_connections()
        
        self.room_id = self.scope['url_route']['kwargs']['room_id']
        self.room_group_name = f'chat_{self.room_id}'
        
        # Get token from query string
        token = self.scope.get('query_string', b'').decode('utf-8').split('token=')[-1].split('&')[0]
        
        if not token:
            close_old_connections()
            await self.close()
            return
        
        # Authenticate user
        try:
            UntypedToken(token)
            decoded_data = jwt_decode(token, settings.SECRET_KEY, algorithms=["HS256"])
            user_id = decoded_data.get('user_id')
            
            if not user_id:
                close_old_connections()
                await self.close()
                return
            
            self.user = await database_sync_to_async(DjangoUser.objects.get)(id=user_id)
            close_old_connections()  # Close after database query
            
            # Check if user is participant of the chat room
            chat_room = await database_sync_to_async(ChatRoom.objects.get)(id=self.room_id)
            participants = await database_sync_to_async(list)(chat_room.participants.all())
            close_old_connections()  # Close after database query
            
            if self.user not in participants:
                close_old_connections()
                await self.close()
                return
            
            # Join room group
            await self.channel_layer.group_add(
                self.room_group_name,
                self.channel_name
            )
            
            # Join active chat group to indicate user is viewing this chat room
            self.active_chat_group = f'chat_active_{self.user.id}_{self.room_id}'
            await self.channel_layer.group_add(
                self.active_chat_group,
                self.channel_name
            )
            
            await self.accept()
            
            # Mark all messages in this room as read when user connects
            await database_sync_to_async(Message.objects.filter(
                chat_room=chat_room
            ).exclude(sender=self.user).update)(is_read=True)
            
            # Close database connections after database operations
            from django.db import close_old_connections
            close_old_connections()
            
        except asyncio.CancelledError:
            # Connection was cancelled, this is normal when client disconnects
            import logging
            logger = logging.getLogger(__name__)
            logger.debug("[ChatConsumer] Connection cancelled")
            await self.close()
        except (InvalidToken, TokenError, DjangoUser.DoesNotExist, ChatRoom.DoesNotExist) as e:
            close_old_connections()
            await self.close()
    
    async def disconnect(self, close_code):
        """Handle WebSocket disconnection"""
        # Close database connections when WebSocket disconnects
        from django.db import close_old_connections
        close_old_connections()
        
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )
        if hasattr(self, 'active_chat_group'):
            await self.channel_layer.group_discard(
                self.active_chat_group,
                self.channel_name
            )
        
        # Ensure connections are closed
        close_old_connections()
    
    async def receive(self, text_data):
        """Handle messages received from WebSocket"""
        try:
            data = json.loads(text_data)
            message_type = data.get('type')
            
            if message_type == 'chat_message':
                content = data.get('content', '').strip()
                if not content:
                    return
                
                # Create message in database
                chat_room = await database_sync_to_async(ChatRoom.objects.get)(id=self.room_id)
                
                message_id = uuid.uuid4().hex[:12]
                while await database_sync_to_async(Message.objects.filter(id=message_id).exists)():
                    message_id = uuid.uuid4().hex[:12]
                
                message = await database_sync_to_async(Message.objects.create)(
                    id=message_id,
                    chat_room=chat_room,
                    sender=self.user,
                    content=content
                )
                
                # Update chat room timestamp
                await database_sync_to_async(chat_room.save)()
                
                # Close database connections after database operations
                from django.db import close_old_connections
                close_old_connections()
                
                # Serialize message
                message_data = {
                    'id': message.id,
                    'chatRoomId': message.chat_room.id,
                    'senderId': message.sender.id,
                    'senderName': f"{message.sender.first_name} {message.sender.last_name}".strip() or message.sender.username,
                    'content': message.content,
                    'isRead': message.is_read,
                    'createdAt': message.created_at.isoformat(),
                }
                
                # Send message to room group
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'chat_message',
                        'message': message_data,
                        'sender_id': self.user.id
                    }
                )
                
                # Create notifications for other participants
                await self.create_notifications_for_participants(chat_room, message)
                
                # Close database connections after all database operations
                from django.db import close_old_connections
                close_old_connections()
            
            elif message_type == 'typing':
                # Broadcast typing indicator
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'typing_indicator',
                        'user_id': self.user.id,
                        'username': f"{self.user.first_name} {self.user.last_name}".strip() or self.user.username,
                        'is_typing': data.get('is_typing', False)
                    }
                )
            
            elif message_type == 'mark_read':
                # Close database connections before mark_read operation
                from django.db import close_old_connections
                close_old_connections()
                # Mark messages as read
                chat_room = await database_sync_to_async(ChatRoom.objects.get)(id=self.room_id)
                await database_sync_to_async(
                    Message.objects.filter(
                        chat_room=chat_room,
                        is_read=False
                    ).exclude(sender=self.user).update
                )(is_read=True)
                
                # Broadcast read status
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'messages_read',
                        'user_id': self.user.id
                    }
                )
                
                # Close database connections after database operations
                from django.db import close_old_connections
                close_old_connections()
                
        except json.JSONDecodeError:
            pass
    
    async def chat_message(self, event):
        """Send chat message to WebSocket"""
        await self.send(text_data=json.dumps({
            'type': 'chat_message',
            'message': event['message'],
            'sender_id': event['sender_id']
        }))
    
    async def typing_indicator(self, event):
        """Send typing indicator to WebSocket"""
        # Don't send typing indicator to the user who is typing
        if event['user_id'] != self.user.id:
            await self.send(text_data=json.dumps({
                'type': 'typing',
                'user_id': event['user_id'],
                'username': event['username'],
                'is_typing': event['is_typing']
            }))
    
    async def messages_read(self, event):
        """Send read status to WebSocket"""
        await self.send(text_data=json.dumps({
            'type': 'messages_read',
            'user_id': event['user_id']
        }))
    
    async def create_notifications_for_participants(self, chat_room, message):
        """Send message notification via WebSocket (no database notification for messages)"""
        from channels.layers import get_channel_layer
        from .serializer import ChatRoomSerializer
        channel_layer = get_channel_layer()
        
        participants = await database_sync_to_async(list)(chat_room.participants.all())
        
        # Close connection after fetching participants
        from django.db import close_old_connections
        close_old_connections()
        
        for participant in participants:
            if participant.id != self.user.id:
                # Check if this is the first message the recipient receives in this room
                # (excluding messages they sent themselves)
                recipient_message_count = await database_sync_to_async(
                    lambda: Message.objects.filter(
                        chat_room=chat_room
                    ).exclude(sender=participant).count()
                )()
                is_first_message_for_recipient = recipient_message_count == 1
                
                import logging
                logger = logging.getLogger(__name__)
                logger.info(f"[ChatConsumer] Sending message to participant {participant.id}. "
                          f"Recipient message count: {recipient_message_count}, "
                          f"Is first message: {is_first_message_for_recipient}, "
                          f"Chat room ID: {chat_room.id}")
                
                # Check if participant is currently viewing this chat room by checking if active_chat_group exists
                # We'll send a test message to the active chat group and see if it's delivered
                # If the group has members, user is viewing the chat
                active_chat_group = f'chat_active_{participant.id}_{chat_room.id}'
                
                # Try to send a message to check if user is active in this chat
                # If user is active, mark message as read and don't send popup
                # We'll use a simple approach: send a "mark_read" message to active group
                # If no one receives it, send the popup notification
                await channel_layer.group_send(
                    active_chat_group,
                    {
                        'type': 'mark_message_read',
                        'message_id': message.id,
                    }
                )
                
                # Always send popup notification - frontend will decide whether to show it
                # based on whether user is viewing the chat
                await self.channel_layer.group_send(
                    f'chat_message_{participant.id}',
                    {
                        'type': 'new_message',
                        'message': {
                            'id': message.id,
                            'chatRoomId': chat_room.id,
                            'senderId': message.sender.id,
                            'senderName': f"{message.sender.first_name} {message.sender.last_name}".strip() or message.sender.username,
                            'content': message.content,
                            'createdAt': message.created_at.isoformat(),
                        },
                        'chat_room_id': chat_room.id,
                        'is_new_chat_room': is_first_message_for_recipient,
                    }
                )
                
                # If this is the first message for the recipient, also send a new_chat_room event
                # This ensures the chat appears in their list
                if is_first_message_for_recipient:
                    # Serialize chat room for the participant
                    # Create a simple mock request object for serializer context
                    class MockRequest:
                        def __init__(self, user):
                            self.user = user
                    
                    def serialize_chat_room():
                        mock_request = MockRequest(participant)
                        return ChatRoomSerializer(chat_room, context={'request': mock_request}).data
                    
                    chat_room_data = await database_sync_to_async(serialize_chat_room)()
                    
                    await self.channel_layer.group_send(
                        f'chat_message_{participant.id}',
                        {
                            'type': 'new_chat_room',
                            'chat_room': chat_room_data,
                        }
                    )

