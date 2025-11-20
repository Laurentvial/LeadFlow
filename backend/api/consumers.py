import json
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
        # Get token from query string
        token = self.scope.get('query_string', b'').decode('utf-8').split('token=')[-1].split('&')[0]
        
        if not token:
            await self.close()
            return
        
        # Authenticate user
        try:
            # Decode and validate token
            UntypedToken(token)
            decoded_data = jwt_decode(token, settings.SECRET_KEY, algorithms=["HS256"])
            user_id = decoded_data.get('user_id')
            
            if not user_id:
                await self.close()
                return
            
            # Get user
            self.user = await database_sync_to_async(DjangoUser.objects.get)(id=user_id)
            self.user_id = user_id
            
            # Join user's notification group
            self.group_name = f'notifications_{self.user_id}'
            await self.channel_layer.group_add(
                self.group_name,
                self.channel_name
            )
            
            await self.accept()
            
            # Send unread notifications count
            unread_count = await database_sync_to_async(
                Notification.objects.filter(user=self.user, is_read=False).count
            )()
            await self.send(text_data=json.dumps({
                'type': 'connection_established',
                'unread_count': unread_count
            }))
            
        except (InvalidToken, TokenError, DjangoUser.DoesNotExist) as e:
            await self.close()
    
    async def disconnect(self, close_code):
        """Handle WebSocket disconnection"""
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(
                self.group_name,
                self.channel_name
            )
    
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


class ChatConsumer(AsyncWebsocketConsumer):
    """WebSocket consumer for real-time chat"""
    
    async def connect(self):
        """Handle WebSocket connection"""
        self.room_id = self.scope['url_route']['kwargs']['room_id']
        self.room_group_name = f'chat_{self.room_id}'
        
        # Get token from query string
        token = self.scope.get('query_string', b'').decode('utf-8').split('token=')[-1].split('&')[0]
        
        if not token:
            await self.close()
            return
        
        # Authenticate user
        try:
            UntypedToken(token)
            decoded_data = jwt_decode(token, settings.SECRET_KEY, algorithms=["HS256"])
            user_id = decoded_data.get('user_id')
            
            if not user_id:
                await self.close()
                return
            
            self.user = await database_sync_to_async(DjangoUser.objects.get)(id=user_id)
            
            # Check if user is participant of the chat room
            chat_room = await database_sync_to_async(ChatRoom.objects.get)(id=self.room_id)
            participants = await database_sync_to_async(list)(chat_room.participants.all())
            
            if self.user not in participants:
                await self.close()
                return
            
            # Join room group
            await self.channel_layer.group_add(
                self.room_group_name,
                self.channel_name
            )
            
            await self.accept()
            
        except (InvalidToken, TokenError, DjangoUser.DoesNotExist, ChatRoom.DoesNotExist) as e:
            await self.close()
    
    async def disconnect(self, close_code):
        """Handle WebSocket disconnection"""
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )
    
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
        """Create notifications for chat room participants (except sender)"""
        participants = await database_sync_to_async(list)(chat_room.participants.all())
        
        for participant in participants:
            if participant.id != self.user.id:
                # Create notification
                notification_id = uuid.uuid4().hex[:12]
                while await database_sync_to_async(Notification.objects.filter(id=notification_id).exists)():
                    notification_id = uuid.uuid4().hex[:12]
                
                notification = await database_sync_to_async(Notification.objects.create)(
                    id=notification_id,
                    user=participant,
                    type='message',
                    title='Nouveau message',
                    message=f"{message.sender.first_name or message.sender.username}: {message.content[:50]}",
                    message_id=message.id,
                    data={
                        'chat_room_id': chat_room.id,
                        'sender_id': message.sender.id,
                        'sender_name': f"{message.sender.first_name} {message.sender.last_name}".strip() or message.sender.username,
                    }
                )
                
                # Send notification via WebSocket
                await self.channel_layer.group_send(
                    f'notifications_{participant.id}',
                    {
                        'type': 'send_notification',
                        'notification': {
                            'id': notification.id,
                            'type': notification.type,
                            'title': notification.title,
                            'message': notification.message,
                            'message_id': notification.message_id,
                            'data': notification.data,
                            'is_read': notification.is_read,
                            'created_at': notification.created_at.isoformat(),
                        },
                        'unread_count': await database_sync_to_async(
                            Notification.objects.filter(user=participant, is_read=False).count
                        )()
                    }
                )

