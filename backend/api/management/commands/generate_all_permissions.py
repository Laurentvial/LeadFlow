"""
Management command to generate all base permissions (without status) for all components and actions.
This ensures all permissions exist in the database and links them to all existing roles.
"""
from django.core.management.base import BaseCommand
from api.models import Permission, Role, PermissionRole
import uuid


def generate_unique_id(model_class):
    """Generate a unique 12-character ID for a model"""
    while True:
        new_id = uuid.uuid4().hex[:12]
        if not model_class.objects.filter(id=new_id).exists():
            return new_id


class Command(BaseCommand):
    help = 'Generate all base permissions (without status) for all predefined components and actions'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be created without actually doing it',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        
        # Predefined components from signals.py
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
        
        created_count = 0
        skipped_count = 0
        permissions_created = []
        
        self.stdout.write('Generating all base permissions (without status)...')
        self.stdout.write('')
        
        for component in PREDEFINED_COMPONENTS:
            for action in ACTIONS:
                # Check if permission already exists
                existing = Permission.objects.filter(
                    component=component,
                    field_name=None,
                    action=action,
                    status=None
                ).first()
                
                if existing:
                    skipped_count += 1
                    permissions_created.append(existing)  # Still need to link to roles
                    if not dry_run:
                        self.stdout.write(
                            self.style.WARNING(
                                f'Skipped (exists): {component} ({action})'
                            )
                        )
                else:
                    if dry_run:
                        self.stdout.write(
                            self.style.WARNING(
                                f'Would create: {component} ({action})'
                            )
                        )
                        created_count += 1
                    else:
                        # Generate unique ID
                        permission_id = generate_unique_id(Permission)
                        
                        # Create permission
                        permission = Permission.objects.create(
                            id=permission_id,
                            component=component,
                            field_name=None,
                            action=action,
                            status=None
                        )
                        permissions_created.append(permission)
                        created_count += 1
                        self.stdout.write(
                            self.style.SUCCESS(
                                f'Created: {component} ({action}) - ID: {permission_id}'
                            )
                        )
        
        # Link permissions to all existing roles
        roles = Role.objects.all()
        role_relations_created = 0
        role_relations_skipped = 0
        
        if roles.exists():
            self.stdout.write('')
            self.stdout.write('Linking permissions to roles...')
            self.stdout.write('')
            
            for role in roles:
                for permission in permissions_created:
                    if dry_run:
                        # Check if relation would already exist
                        existing_relation = PermissionRole.objects.filter(
                            role=role,
                            permission=permission
                        ).exists()
                        if not existing_relation:
                            role_relations_created += 1
                        else:
                            role_relations_skipped += 1
                    else:
                        # Get or create PermissionRole relation
                        permission_role, created = PermissionRole.objects.get_or_create(
                            role=role,
                            permission=permission,
                            defaults={'id': generate_unique_id(PermissionRole)}
                        )
                        if created:
                            role_relations_created += 1
                            self.stdout.write(
                                self.style.SUCCESS(
                                    f'Linked: {role.name} -> {permission.component} ({permission.action})'
                                )
                            )
                        else:
                            role_relations_skipped += 1
        
        self.stdout.write('')
        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    f'\nDry run complete:\n'
                    f'  - Would create {created_count} permission(s), {skipped_count} already exist(s)\n'
                    f'  - Would create {role_relations_created} PermissionRole relation(s), '
                    f'{role_relations_skipped} already exist(s)\n'
                    f'Remove --dry-run to create them.'
                )
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    f'\nSuccessfully completed:\n'
                    f'  - Created {created_count} permission(s), {skipped_count} already existed\n'
                    f'  - Created {role_relations_created} PermissionRole relation(s), '
                    f'{role_relations_skipped} already existed'
                )
            )
