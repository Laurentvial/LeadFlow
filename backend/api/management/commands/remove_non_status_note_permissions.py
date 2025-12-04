"""
Management command to remove permissions where component is not 'statuses' or 'note_categories' 
but has statusId set.
Only 'statuses' and 'note_categories' components should have status-specific permissions.
"""
from django.core.management.base import BaseCommand
from api.models import Permission, PermissionRole


class Command(BaseCommand):
    help = 'Remove permissions where component is not statuses/note_categories but has statusId'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be removed without actually doing it',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        
        # Find permissions where component is NOT 'statuses' or 'note_categories' but has statusId
        invalid_permissions = Permission.objects.filter(
            status__isnull=False
        ).exclude(component__in=['statuses', 'note_categories'])
        
        count = invalid_permissions.count()
        
        if count == 0:
            self.stdout.write(
                self.style.SUCCESS(
                    'No invalid permissions found. All permissions with statusId are for "statuses" or "note_categories" components.'
                )
            )
            return
        
        self.stdout.write(
            self.style.WARNING(
                f'Found {count} permission(s) where component is not "statuses" or "note_categories" but has statusId:'
            )
        )
        
        # Group by component for better display
        by_component = {}
        for perm in invalid_permissions:
            component = perm.component
            if component not in by_component:
                by_component[component] = []
            by_component[component].append(perm)
        
        # Show permissions grouped by component
        total_role_associations = 0
        for component, perms in sorted(by_component.items()):
            self.stdout.write(f'\n  Component: {component} ({len(perms)} permission(s)):')
            perm_ids = []
            for perm in perms[:20]:  # Show first 20 per component
                status_info = f" - Status: {perm.status.name}" if perm.status else ""
                field_info = f" - Field: {perm.field_name}" if perm.field_name else ""
                self.stdout.write(
                    f'    - {perm.action} (ID: {perm.id}){status_info}{field_info}'
                )
                perm_ids.append(perm.id)
            if len(perms) > 20:
                self.stdout.write(f'    ... and {len(perms) - 20} more')
                # Get remaining IDs
                remaining_perms = perms[20:]
                perm_ids.extend([p.id for p in remaining_perms])
            
            # Count role associations for this component
            role_count = PermissionRole.objects.filter(permission_id__in=perm_ids).count()
            total_role_associations += role_count
            if role_count > 0:
                self.stdout.write(f'    -> Linked to {role_count} role(s)')
        
        if total_role_associations > 0:
            self.stdout.write(
                self.style.WARNING(
                    f'\nThese permissions are associated with {total_role_associations} role(s) total. '
                    'These associations will also be removed.'
                )
            )
        
        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    f'\n\nDry run mode: No changes made. '
                    f'Would remove {count} permission(s). Remove --dry-run to apply changes.'
                )
            )
        else:
            # Get all permission IDs
            permission_ids = list(invalid_permissions.values_list('id', flat=True))
            
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
                    f'Successfully removed {deleted_perms[0]} permission(s) '
                    'where component is not "statuses" or "note_categories" but has statusId.'
                )
            )

