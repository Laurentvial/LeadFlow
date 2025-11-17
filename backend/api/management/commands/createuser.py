from django.core.management.base import BaseCommand
from django.contrib.auth.models import User as DjangoUser
from api.models import UserDetails, Role, Team, TeamMember
import uuid


class Command(BaseCommand):
    help = 'Create a new user in the CRM system'

    def add_arguments(self, parser):
        parser.add_argument('email', type=str, help='User email (will be used as username)')
        parser.add_argument('password', type=str, help='User password')
        parser.add_argument('--first-name', type=str, default='', help='First name')
        parser.add_argument('--last-name', type=str, default='', help='Last name')
        parser.add_argument('--phone', type=str, default='', help='Phone number')
        parser.add_argument('--role-id', type=str, default=None, help='Role ID (optional)')
        parser.add_argument('--team-id', type=str, default=None, help='Team ID (optional)')

    def handle(self, *args, **options):
        email = options['email'].strip()
        password = options['password']
        first_name = options.get('first_name', '').strip()
        last_name = options.get('last_name', '').strip()
        phone = options.get('phone', '').strip()
        role_id = options.get('role_id')
        team_id = options.get('team_id')

        # Validate email is provided
        if not email:
            self.stdout.write(self.style.ERROR('Email is required'))
            return

        # Check if user already exists
        if DjangoUser.objects.filter(username__iexact=email).exists():
            self.stdout.write(self.style.ERROR(f'A user with email "{email}" already exists'))
            return

        # Create Django User
        try:
            user = DjangoUser.objects.create_user(
                username=email,
                email=email,
                password=password,
                first_name=first_name,
                last_name=last_name
            )
            self.stdout.write(self.style.SUCCESS(f'Created Django user: {email}'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Error creating Django user: {str(e)}'))
            return

        # Generate UserDetails ID
        max_id = 0
        for id_val in UserDetails.objects.values_list('id', flat=True):
            try:
                int_id = int(id_val)
                if int_id > max_id:
                    max_id = int_id
            except (ValueError, TypeError):
                continue

        new_id = max_id + 1
        user_details_id = str(new_id)

        # If the ID exceeds 12 characters, use a truncated UUID instead
        if len(user_details_id) > 12:
            while True:
                user_details_id = uuid.uuid4().hex[:12]
                if not UserDetails.objects.filter(id=user_details_id).exists():
                    break

        # Get role if role_id provided
        role = None
        if role_id:
            try:
                role = Role.objects.get(id=role_id)
                self.stdout.write(self.style.SUCCESS(f'Assigned role: {role.name}'))
            except Role.DoesNotExist:
                self.stdout.write(self.style.WARNING(f'Role with ID "{role_id}" not found, user created without role'))

        # Create UserDetails entry
        try:
            user_details = UserDetails.objects.create(
                id=user_details_id,
                django_user=user,
                role=role,
                phone=phone
            )
            self.stdout.write(self.style.SUCCESS(f'Created UserDetails with ID: {user_details_id}'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Error creating UserDetails: {str(e)}'))
            user.delete()  # Clean up Django user if UserDetails creation fails
            return

        # Create TeamMember if team_id provided
        if team_id:
            try:
                team = Team.objects.get(id=team_id)
                team_member_id = uuid.uuid4().hex[:12]
                while TeamMember.objects.filter(id=team_member_id).exists():
                    team_member_id = uuid.uuid4().hex[:12]
                TeamMember.objects.create(
                    id=team_member_id,
                    user=user_details,
                    team=team
                )
                self.stdout.write(self.style.SUCCESS(f'Added user to team: {team.name}'))
            except Team.DoesNotExist:
                self.stdout.write(self.style.WARNING(f'Team with ID "{team_id}" not found, user created without team'))

        self.stdout.write(self.style.SUCCESS(f'\nUser successfully created!\nEmail: {email}\nUser ID: {user.id}\nUserDetails ID: {user_details_id}'))

