from django.db.models.signals import post_save
from django.db.models import Q
from django.dispatch import receiver
from .models import Status, Role, Permission, PermissionRole, NotificationPreference, Notification
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
import uuid
import logging

logger = logging.getLogger(__name__)

# Predefined components that should have permissions
PREDEFINED_COMPONENTS = [
    'dashboard',
    'contacts',
    'fosse',
    'users',
    'teams',
    'planning',
    'permissions',
    'statuses',
    'mails',
]

# All available actions
ACTIONS = ['view', 'create', 'edit', 'delete']


def generate_unique_id(model_class):
    """Generate a unique 12-character ID for a model"""
    while True:
        new_id = uuid.uuid4().hex[:12]
        if not model_class.objects.filter(id=new_id).exists():
            return new_id


@receiver(post_save, sender=Status)
def create_permissions_for_new_status(sender, instance, created, **kwargs):
    """
    When a new Status is created, automatically create permissions for roles.
    Creates permissions for all components and actions with the new status,
    then links appropriate roles to these permissions based on status type:
    - For 'lead' status: roles where is_teleoperateur=True OR (is_teleoperateur=False AND is_confirmateur=False)
    - For 'client' status: roles where is_confirmateur=True OR (is_teleoperateur=False AND is_confirmateur=False)
    - For other status types: all roles
    """
    if not created:
        return  # Only process new statuses
    
    # Filter roles based on status type
    status_type = instance.type
    if status_type == 'lead':
        # Create permissions for roles where is_teleoperateur=True OR (is_teleoperateur=False AND is_confirmateur=False)
        roles = Role.objects.filter(
            Q(is_teleoperateur=True) | Q(is_teleoperateur=False, is_confirmateur=False)
        )
    elif status_type == 'client':
        # Create permissions for roles where is_confirmateur=True OR (is_teleoperateur=False AND is_confirmateur=False)
        roles = Role.objects.filter(
            Q(is_confirmateur=True) | Q(is_teleoperateur=False, is_confirmateur=False)
        )
    else:
        # For other status types (e.g., 'contact'), create permissions for all roles
        roles = Role.objects.all()
    
    if not roles.exists():
        return  # No matching roles exist, nothing to do
    
    # Create permissions for components that are allowed to have statusId
    # Only 'statuses' and 'note_categories' components can have status-specific permissions
    STATUS_ALLOWED_COMPONENTS = ['statuses', 'note_categories']
    permissions_for_status = []
    for component in PREDEFINED_COMPONENTS:
        # Only create status-specific permissions for allowed components
        if component not in STATUS_ALLOWED_COMPONENTS:
            continue
            
        for action in ACTIONS:
            # Get or create permission for this status (only for allowed components)
            permission, _ = Permission.objects.get_or_create(
                component=component,
                field_name=None,
                action=action,
                status=instance,
                defaults={'id': generate_unique_id(Permission)}
            )
            permissions_for_status.append(permission)
    
    # Link filtered roles to these permissions
    for role in roles:
        for permission in permissions_for_status:
            # Check if PermissionRole already exists (shouldn't happen, but be safe)
            PermissionRole.objects.get_or_create(
                role=role,
                permission=permission,
                defaults={'id': generate_unique_id(PermissionRole)}
            )


@receiver(post_save, sender=Role)
def create_permissions_for_new_role(sender, instance, created, **kwargs):
    """
    When a new Role is created, automatically link it to all existing permissions.
    Also creates permissions without status for all components/actions if they don't exist,
    ensuring the new role has access to everything by default.
    """
    if not created:
        return  # Only process new roles
    
    # First, ensure permissions without status exist for all components and actions
    # Use get_or_create to prevent duplicates
    permissions_to_link = []
    for component in PREDEFINED_COMPONENTS:
        for action in ACTIONS:
            # Get or create permission without status (prevents duplicates)
            # The unique_together constraint ensures no duplicates can be created
            permission, created = Permission.objects.get_or_create(
                component=component,
                field_name=None,
                action=action,
                status=None,
                defaults={'id': generate_unique_id(Permission)}
            )
            # Only add if it was created or already exists (get_or_create returns the object either way)
            permissions_to_link.append(permission)
    
    # Also get all existing permissions with statuses
    existing_permissions = Permission.objects.filter(status__isnull=False)
    permissions_to_link.extend(existing_permissions)
    
    # Link the new role to all permissions (both with and without status)
    for permission in permissions_to_link:
        # Check if PermissionRole already exists (shouldn't happen, but be safe)
        PermissionRole.objects.get_or_create(
            role=instance,
            permission=permission,
            defaults={'id': generate_unique_id(PermissionRole)}
        )
    
    # Create default notification preferences for the new role
    NotificationPreference.objects.get_or_create(
        role=instance,
        defaults={
            'id': generate_unique_id(NotificationPreference),
            'notify_message_received': True,
            'notify_sensitive_contact_modification': True,
            'notify_contact_edit': True
        }
    )


@receiver(post_save, sender=Notification)
def send_notification_via_websocket(sender, instance, created, **kwargs):
    """
    When a Notification is created, send it via WebSocket to the user.
    Skip event notifications as they are handled separately by send_event_notification.
    """
    if not created:
        return  # Only send for new notifications
    
    # Skip event notifications - they're handled by send_event_notification function
    if instance.type == 'event':
        return
    
    # Skip message notifications - they're handled by chat WebSocket
    if instance.type == 'message':
        return
    
    try:
        channel_layer = get_channel_layer()
        if not channel_layer:
            logger.warning("[send_notification_via_websocket] No channel layer available")
            return
        
        # Serialize notification data
        notification_data = {
            'id': instance.id,
            'type': instance.type,
            'title': instance.title,
            'message': instance.message,
            'message_id': instance.message_id if instance.message_id else None,
            'email_id': instance.email_id if instance.email_id else None,
            'contact_id': instance.contact_id if instance.contact_id else None,
            'event_id': instance.event_id if instance.event_id else None,
            'data': instance.data if instance.data else {},
            'is_read': instance.is_read,
            'created_at': instance.created_at.isoformat(),
        }
        
        # Get unread count for this user
        unread_count = Notification.objects.filter(user=instance.user, is_read=False).count()
        
        # Send via WebSocket
        async_to_sync(channel_layer.group_send)(
            f'notifications_{instance.user.id}',
            {
                'type': 'send_notification',
                'notification': notification_data,
                'unread_count': unread_count,
            }
        )
        
        logger.info(f"[send_notification_via_websocket] Sent notification {instance.id} to user {instance.user.id}")
        
    except Exception as e:
        # Log but don't fail - notification is already saved in database
        logger.error(f"[send_notification_via_websocket] Error sending notification {instance.id} via WebSocket: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())

