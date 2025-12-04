"""
Management command to create statuses permissions with null statusId.
These are needed for managing statuses in the Settings tab.
"""
from django.core.management.base import BaseCommand
from api.models import Permission, Role, PermissionRole
import uuid


class Command(BaseCommand):
    help = 'Create statuses permissions with null statusId for managing statuses'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be created without actually doing it',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        
        # Actions needed for statuses management
        actions = ['view', 'create', 'edit', 'delete']
        
        # Check which permissions already exist
        existing_perms = Permission.objects.filter(
            component='statuses',
            status__isnull=True
        )
        existing_actions = set(existing_perms.values_list('action', flat=True))
        
        # Find which permissions need to be created
        missing_actions = [action for action in actions if action not in existing_actions]
        
        if not missing_actions:
            self.stdout.write(
                self.style.SUCCESS(
                    'All statuses permissions with null statusId already exist. Nothing to create.'
                )
            )
            return
        
        self.stdout.write(
            self.style.WARNING(
                f'Missing statuses permissions (with null statusId): {", ".join(missing_actions)}'
            )
        )
        
        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    f'\nDry run mode: Would create {len(missing_actions)} permission(s). '
                    'Remove --dry-run to create them.'
                )
            )
            return
        
        # Create missing permissions
        created_count = 0
        for action in missing_actions:
            # Generate unique ID
            permission_id = uuid.uuid4().hex[:12]
            while Permission.objects.filter(id=permission_id).exists():
                permission_id = uuid.uuid4().hex[:12]
            
            # Create permission
            permission = Permission.objects.create(
                id=permission_id,
                component='statuses',
                action=action,
                field_name=None,
                status=None
            )
            created_count += 1
            self.stdout.write(
                self.style.SUCCESS(f'Created permission: statuses ({action}) - ID: {permission_id}')
            )
        
        self.stdout.write(
            self.style.SUCCESS(
                f'\nSuccessfully created {created_count} statuses permission(s) with null statusId.'
            )
        )
        
        # Note: These permissions are not automatically assigned to any roles
        # They need to be assigned manually through the Permissions tab

