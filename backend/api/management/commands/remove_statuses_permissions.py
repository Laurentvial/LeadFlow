"""
Management command to remove permissions where component is 'statuses' and statusId is null.
These are general statuses management permissions that should not exist.
"""
from django.core.management.base import BaseCommand
from api.models import Permission, PermissionRole


class Command(BaseCommand):
    help = 'Remove permissions where component is statuses and statusId is null'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be removed without actually doing it',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        
        # Find all permissions where component is 'statuses' and status is null
        invalid_permissions = Permission.objects.filter(
            component='statuses',
            status__isnull=True
        )
        
        count = invalid_permissions.count()
        
        if count == 0:
            self.stdout.write(
                self.style.SUCCESS('No statuses permissions with null statusId found. All good!')
            )
            return
        
        self.stdout.write(
            self.style.WARNING(
                f'Found {count} permission(s) where component is "statuses" and statusId is null:'
            )
        )
        
        # Show the permissions
        for perm in invalid_permissions[:50]:  # Show first 50
            self.stdout.write(
                f'  - {perm.component} ({perm.action}) - ID: {perm.id}'
            )
        
        if count > 50:
            self.stdout.write(f'  ... and {count - 50} more')
        
        # Count PermissionRole associations
        permission_ids = list(invalid_permissions.values_list('id', flat=True))
        role_associations = PermissionRole.objects.filter(permission_id__in=permission_ids).count()
        
        if role_associations > 0:
            self.stdout.write(
                self.style.WARNING(
                    f'\nThese permissions are associated with {role_associations} role(s). '
                    'These associations will also be removed.'
                )
            )
        
        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    '\nDry run mode: No changes made. Remove --dry-run to apply changes.'
                )
            )
        else:
            # First, remove PermissionRole associations
            deleted_roles = PermissionRole.objects.filter(permission_id__in=permission_ids).delete()
            self.stdout.write(
                self.style.SUCCESS(
                    f'\nRemoved {deleted_roles[0]} PermissionRole association(s).'
                )
            )
            
            # Then remove the permissions
            deleted_perms = invalid_permissions.delete()
            self.stdout.write(
                self.style.SUCCESS(
                    f'Successfully removed {deleted_perms[0]} permission(s) where component is "statuses" and statusId is null.'
                )
            )

