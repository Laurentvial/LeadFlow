"""
Management command to remove permissions that are not linked to any role.
These are orphaned permissions that serve no purpose.
"""
from django.core.management.base import BaseCommand
from api.models import Permission, PermissionRole


class Command(BaseCommand):
    help = 'Remove permissions that are not linked to any role'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be removed without actually doing it',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        
        # Get all permission IDs that are linked to roles
        linked_permission_ids = set(
            PermissionRole.objects.values_list('permission_id', flat=True).distinct()
        )
        
        # Find permissions that are NOT linked to any role
        all_permissions = Permission.objects.all()
        orphaned_permissions = [
            perm for perm in all_permissions 
            if perm.id not in linked_permission_ids
        ]
        
        count = len(orphaned_permissions)
        
        if count == 0:
            self.stdout.write(
                self.style.SUCCESS('No orphaned permissions found. All permissions are linked to at least one role.')
            )
            return
        
        self.stdout.write(
            self.style.WARNING(
                f'Found {count} orphaned permission(s) not linked to any role:'
            )
        )
        
        # Group by component for better display
        by_component = {}
        for perm in orphaned_permissions:
            component = perm.component
            if component not in by_component:
                by_component[component] = []
            by_component[component].append(perm)
        
        # Show permissions grouped by component
        for component, perms in sorted(by_component.items()):
            self.stdout.write(f'\n  Component: {component} ({len(perms)} permission(s)):')
            for perm in perms[:10]:  # Show first 10 per component
                status_info = f" - Status: {perm.status.name}" if perm.status else ""
                field_info = f" - Field: {perm.field_name}" if perm.field_name else ""
                self.stdout.write(
                    f'    - {perm.action} (ID: {perm.id}){status_info}{field_info}'
                )
            if len(perms) > 10:
                self.stdout.write(f'    ... and {len(perms) - 10} more')
        
        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    f'\n\nDry run mode: No changes made. '
                    f'Would remove {count} permission(s). Remove --dry-run to apply changes.'
                )
            )
        else:
            # Get IDs for deletion
            orphaned_ids = [perm.id for perm in orphaned_permissions]
            
            # Delete the orphaned permissions
            deleted_count = Permission.objects.filter(id__in=orphaned_ids).delete()[0]
            
            self.stdout.write(
                self.style.SUCCESS(
                    f'\nSuccessfully removed {deleted_count} orphaned permission(s) '
                    'that were not linked to any role.'
                )
            )

