"""
Management command to find and remove duplicate permissions.
A permission should be unique by component, field_name, action, and status.
"""
from django.core.management.base import BaseCommand
from django.db.models import Count
from api.models import Permission, PermissionRole
from api.signals import generate_unique_id
from collections import defaultdict


class Command(BaseCommand):
    help = 'Find and remove duplicate permissions (same component, field_name, action, status)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be removed without actually doing it',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        
        # Find duplicates using aggregation
        duplicates = Permission.objects.values(
            'component', 'field_name', 'action', 'status'
        ).annotate(
            count=Count('id')
        ).filter(count__gt=1)
        
        if not duplicates.exists():
            self.stdout.write(
                self.style.SUCCESS('No duplicate permissions found. All permissions are unique.')
            )
            return
        
        self.stdout.write(
            self.style.WARNING(
                f'Found {duplicates.count()} duplicate permission group(s):'
            )
        )
        
        # Group duplicates and decide which to keep (keep the one with most role associations)
        duplicate_groups = []
        total_duplicates_to_remove = 0
        total_role_associations_to_remove = 0
        
        for dup_group in duplicates:
            component = dup_group['component']
            field_name = dup_group['field_name']
            action = dup_group['action']
            status_id = dup_group['status']
            
            # Get all permissions matching this combination
            matching_perms = Permission.objects.filter(
                component=component,
                field_name=field_name,
                action=action,
                status_id=status_id
            )
            
            # Count role associations for each
            perm_with_roles = []
            for perm in matching_perms:
                role_count = PermissionRole.objects.filter(permission_id=perm.id).count()
                perm_with_roles.append({
                    'permission': perm,
                    'role_count': role_count
                })
            
            # Sort by role count (descending) - keep the one with most roles
            perm_with_roles.sort(key=lambda x: x['role_count'], reverse=True)
            
            # Keep the first one (most role associations), remove the rest
            keep_perm = perm_with_roles[0]
            remove_perms = perm_with_roles[1:]
            
            duplicate_groups.append({
                'component': component,
                'field_name': field_name,
                'action': action,
                'status_id': status_id,
                'keep': keep_perm,
                'remove': remove_perms
            })
            
            total_duplicates_to_remove += len(remove_perms)
            for rp in remove_perms:
                total_role_associations_to_remove += rp['role_count']
        
        # Display duplicates
        for group in duplicate_groups:
            status_info = f"statusId={group['status_id']}" if group['status_id'] else "statusId=null"
            field_info = f"fieldName={group['field_name']}" if group['field_name'] else "fieldName=null"
            self.stdout.write(
                f'\n  {group["component"]} ({group["action"]}) - {field_info}, {status_info}:'
            )
            self.stdout.write(
                f'    KEEP: ID {group["keep"]["permission"].id} ({group["keep"]["role_count"]} role(s))'
            )
            for rp in group['remove']:
                self.stdout.write(
                    f'    REMOVE: ID {rp["permission"].id} ({rp["role_count"]} role(s))'
                )
        
        self.stdout.write(
            self.style.WARNING(
                f'\n\nTotal: {total_duplicates_to_remove} duplicate permission(s) to remove, '
                f'affecting {total_role_associations_to_remove} role association(s).'
            )
        )
        
        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    '\nDry run mode: No changes made. Remove --dry-run to apply changes.'
                )
            )
        else:
            # Migrate role associations from duplicates to the kept permission, then remove duplicates
            removed_count = 0
            migrated_associations = 0
            
            for group in duplicate_groups:
                keep_perm = group['keep']['permission']
                keep_perm_id = keep_perm.id
                
                for rp in group['remove']:
                    remove_perm = rp['permission']
                    remove_perm_id = remove_perm.id
                    
                    # Get all role associations for the duplicate
                    duplicate_roles = PermissionRole.objects.filter(permission_id=remove_perm_id)
                    
                    # Migrate role associations to the kept permission
                    for perm_role in duplicate_roles:
                        # Check if this role already has the kept permission
                        existing = PermissionRole.objects.filter(
                            role_id=perm_role.role_id,
                            permission_id=keep_perm_id
                        ).exists()
                        
                        if not existing:
                            # Create new association with kept permission
                            PermissionRole.objects.create(
                                id=generate_unique_id(PermissionRole),
                                role_id=perm_role.role_id,
                                permission_id=keep_perm_id
                            )
                            migrated_associations += 1
                        # Delete the duplicate association
                        perm_role.delete()
                    
                    # Remove the duplicate permission
                    remove_perm.delete()
                    removed_count += 1
            
            self.stdout.write(
                self.style.SUCCESS(
                    f'\nSuccessfully removed {removed_count} duplicate permission(s).'
                )
            )
            self.stdout.write(
                self.style.SUCCESS(
                    f'Migrated {migrated_associations} role association(s) to kept permissions.'
                )
            )

