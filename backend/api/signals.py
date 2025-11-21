from django.db.models.signals import post_save
from django.db.models import Q
from django.dispatch import receiver
from .models import Status, Role, Permission, PermissionRole
import uuid

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
    
    # Create permissions for all components and actions with this status
    permissions_for_status = []
    for component in PREDEFINED_COMPONENTS:
        for action in ACTIONS:
            # Get or create permission for this status
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
    permissions_to_link = []
    for component in PREDEFINED_COMPONENTS:
        for action in ACTIONS:
            # Get or create permission without status
            permission, _ = Permission.objects.get_or_create(
                component=component,
                field_name=None,
                action=action,
                status=None,
                defaults={'id': generate_unique_id(Permission)}
            )
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

