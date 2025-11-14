from django.shortcuts import render
from django.contrib.auth.models import User as DjangoUser
from django.shortcuts import get_object_or_404
from django.db import models
from rest_framework import generics, status
from .models import Contact
from .models import Note
from .models import UserDetails
from .models import Team
from .models import Event
from .models import TeamMember
from .models import Log
from .models import Role, Permission, PermissionRole, Status
from .serializer import (
    UserSerializer, ContactSerializer, NoteSerializer,
    TeamSerializer, TeamDetailSerializer, UserDetailsSerializer, EventSerializer, TeamMemberSerializer,
    RoleSerializer, PermissionSerializer, PermissionRoleSerializer, StatusSerializer
)
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
import uuid
import json


def get_client_ip(request):
    """Extract client IP address from request, checking multiple headers"""
    # Check various headers that might contain the real client IP
    # X-Forwarded-For can contain multiple IPs (client, proxy1, proxy2)
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        # Get the first IP (original client) and strip whitespace
        ip = x_forwarded_for.split(',')[0].strip()
        if ip:
            return ip
    
    # Check X-Real-IP header (used by some proxies)
    x_real_ip = request.META.get('HTTP_X_REAL_IP')
    if x_real_ip:
        ip = x_real_ip.strip()
        if ip:
            return ip
    
    # Check CF-Connecting-IP (Cloudflare)
    cf_connecting_ip = request.META.get('HTTP_CF_CONNECTING_IP')
    if cf_connecting_ip:
        ip = cf_connecting_ip.strip()
        if ip:
            return ip
    
    # Fallback to REMOTE_ADDR
    ip = request.META.get('REMOTE_ADDR', '')
    return ip.strip() if ip else 'Unknown'


def get_browser_info(request):
    """Extract browser information from request headers"""
    user_agent = request.META.get('HTTP_USER_AGENT', '')
    
    # Parse browser info from user agent
    browser_info = {
        'user_agent': user_agent,
    }
    
    # Try to extract browser name and version
    if user_agent:
        user_agent_lower = user_agent.lower()
        
        # Detect browser
        if 'chrome' in user_agent_lower and 'edg' not in user_agent_lower:
            browser_info['browser'] = 'Chrome'
            # Extract Chrome version
            try:
                chrome_index = user_agent_lower.find('chrome/')
                if chrome_index != -1:
                    version_part = user_agent[chrome_index + 7:chrome_index + 20]
                    version = version_part.split()[0].split('.')[0]
                    browser_info['browser_version'] = version
            except:
                pass
        elif 'firefox' in user_agent_lower:
            browser_info['browser'] = 'Firefox'
            try:
                firefox_index = user_agent_lower.find('firefox/')
                if firefox_index != -1:
                    version_part = user_agent[firefox_index + 8:firefox_index + 20]
                    version = version_part.split()[0].split('.')[0]
                    browser_info['browser_version'] = version
            except:
                pass
        elif 'safari' in user_agent_lower and 'chrome' not in user_agent_lower:
            browser_info['browser'] = 'Safari'
        elif 'edg' in user_agent_lower:
            browser_info['browser'] = 'Edge'
        elif 'opera' in user_agent_lower or 'opr' in user_agent_lower:
            browser_info['browser'] = 'Opera'
        
        # Detect OS
        if 'windows' in user_agent_lower:
            browser_info['os'] = 'Windows'
            if 'windows nt 10.0' in user_agent_lower:
                browser_info['os_version'] = '10'
            elif 'windows nt 11.0' in user_agent_lower:
                browser_info['os_version'] = '11'
        elif 'mac' in user_agent_lower or 'macintosh' in user_agent_lower:
            browser_info['os'] = 'macOS'
        elif 'linux' in user_agent_lower:
            browser_info['os'] = 'Linux'
        elif 'android' in user_agent_lower:
            browser_info['os'] = 'Android'
        elif 'ios' in user_agent_lower or 'iphone' in user_agent_lower or 'ipad' in user_agent_lower:
            browser_info['os'] = 'iOS'
    
    return browser_info


def get_user_data_for_log(django_user, user_details=None):
    """Helper function to extract user data for logging"""
    user_data = {
        'id': str(django_user.id),
        'username': django_user.username,
        'email': django_user.email or '',
        'first_name': django_user.first_name or '',
        'last_name': django_user.last_name or '',
    }
    
    # Get UserDetails if not provided
    if user_details is None:
        try:
            user_details = UserDetails.objects.get(django_user=django_user)
        except UserDetails.DoesNotExist:
            return user_data
    
    if user_details:
        user_data['user_details_id'] = user_details.id
        user_data['role'] = user_details.role.id if user_details.role else None
        user_data['roleName'] = user_details.role.name if user_details.role else None
        if user_details.phone:
            user_data['phone'] = user_details.phone
        
        # Get team ID if user is in a team
        team_member = user_details.team_memberships.first()
        if team_member:
            user_data['teamId'] = team_member.team.id
    
    return user_data


def get_team_data_for_log(team):
    """Helper function to extract team data for logging"""
    team_data = {
        'id': team.id,
        'name': team.name,
    }
    
    # Get team members count
    team_members_count = team.team_members.count()
    if team_members_count > 0:
        team_data['members_count'] = team_members_count
    
    return team_data


def create_log_entry(event_type, user_id, request, old_value=None, new_value=None):
    """Create a log entry for an activity"""
    # Generate log ID
    log_id = uuid.uuid4().hex[:12]
    while Log.objects.filter(id=log_id).exists():
        log_id = uuid.uuid4().hex[:12]
    
    # Extract details from request
    details = {
        'ip_address': get_client_ip(request),
        'browser': get_browser_info(request),
    }
    
    # Create log entry
    Log.objects.create(
        id=log_id,
        event_type=event_type,
        user_id=user_id if user_id else None,
        details=details,
        old_value=old_value if old_value else {},
        new_value=new_value if new_value else {}
    )


class UserCreateView(generics.CreateAPIView):
    queryset = DjangoUser.objects.all()
    serializer_class = UserSerializer
    permission_classes = [AllowAny]
    
    def perform_create(self, serializer):
        # Save the user (this will trigger the serializer's create method)
        user = serializer.save()
        
        # Get the user who created this (if authenticated, otherwise None)
        created_by_user = self.request.user if self.request.user.is_authenticated else None
        
        # Prepare new_value with user data using helper function
        new_value = get_user_data_for_log(user)
        
        # Create log entry
        create_log_entry(
            event_type='createUser',
            user_id=created_by_user,
            request=self.request,
            old_value={},  # No old value for creation
            new_value=new_value
        )

class NoteListCreateView(generics.ListCreateAPIView):
    serializer_class = NoteSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return Note.objects.filter(userId=user)

    def perform_create(self, serializer):
        # serializer is already validated at this point
        # contactId can be null if not provided - preserve it from validated_data
        # If not provided, it will be None/null which is allowed
        validated_data = serializer.validated_data
        note_id = validated_data.get('id')
        # Generate a unique ID if not provided
        if not note_id:
            # Generate a 12-character unique ID
            note_id = uuid.uuid4().hex[:12]
            # Ensure uniqueness (small chance of collision, but unlikely)
            while Note.objects.filter(id=note_id).exists():
                note_id = uuid.uuid4().hex[:12]
        serializer.save(
            id=note_id,
            userId=self.request.user, 
            contactId=validated_data.get('contactId')  # Can be None/null
        )

class NoteDeleteView(generics.DestroyAPIView):
    serializer_class = NoteSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = 'id'
    lookup_url_kwarg = 'pk'
    
    def get_queryset(self):
        user = self.request.user
        return Note.objects.filter(userId=user)

class ContactView(generics.ListAPIView):
    queryset = Contact.objects.all()
    serializer_class = ContactSerializer
    permission_classes = [IsAuthenticated]  # Explicitly set permission
    
    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        return Response({'contacts': response.data})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def contact_create(request):
    # Validate required fields
    if not request.data.get('firstName'):
        return Response({'error': 'Le prénom est requis'}, status=status.HTTP_400_BAD_REQUEST)
    if not request.data.get('lastName'):
        return Response({'error': 'Le nom est requis'}, status=status.HTTP_400_BAD_REQUEST)
    if not request.data.get('email'):
        return Response({'error': 'L\'email est requis'}, status=status.HTTP_400_BAD_REQUEST)
    
    # Check if email already exists
    email = request.data.get('email', '').strip()
    if email and Contact.objects.filter(email=email).exists():
        return Response({'error': 'Un contact avec cet email existe déjà'}, status=status.HTTP_400_BAD_REQUEST)
    
    # Generate contact ID
    contact_id = uuid.uuid4().hex[:12]
    while Contact.objects.filter(id=contact_id).exists():
        contact_id = uuid.uuid4().hex[:12]
    
    # Helper function to safely get date
    def get_date(value):
        if not value or value == '':
            return None
        return value
    
    # Map frontend field names to model field names
    # Informations personnelles
    contact_data = {
        'id': contact_id,
        'civility': request.data.get('civility', '') or '',
        'fname': request.data.get('firstName', '') or '',
        'lname': request.data.get('lastName', '') or '',
        'phone': request.data.get('phone', '') or '',
        'mobile': request.data.get('mobile', '') or '',
        'email': request.data.get('email', '') or '',
        'birth_date': get_date(request.data.get('birthDate')),
        'birth_place': request.data.get('birthPlace', '') or '',
        'address': request.data.get('address', '') or '',
        'postal_code': request.data.get('postalCode', '') or '',
        'city': request.data.get('city', '') or '',
        'nationality': request.data.get('nationality', '') or '',
        'successor': request.data.get('successor', '') or '',
        # managed_by will be set separately to ensure it's a valid user ID
    }
    
    # Handle managed_by separately to ensure it's a valid user ID
    # The frontend sends UserDetails.id (string), we need to convert it to DjangoUser.id
    managed_by_value = request.data.get('managerId', '') or request.data.get('managed_by', '') or ''
    if managed_by_value:
        try:
            # First try to find UserDetails by ID (this is what the frontend sends)
            user_details = UserDetails.objects.filter(id=managed_by_value).first()
            if user_details and user_details.django_user:
                # Use DjangoUser.id for managed_by
                contact_data['managed_by'] = str(user_details.django_user.id)
            else:
                # Fallback: try to find DjangoUser directly by ID (for backward compatibility)
                try:
                    user_id = int(managed_by_value)
                    from django.contrib.auth.models import User as DjangoUser
                    if DjangoUser.objects.filter(id=user_id).exists():
                        contact_data['managed_by'] = str(user_id)
                    else:
                        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
                except (ValueError, TypeError):
                    # Try to find by username
                    from django.contrib.auth.models import User as DjangoUser
                    user = DjangoUser.objects.filter(username=managed_by_value).first()
                    if user:
                        contact_data['managed_by'] = str(user.id)
                    else:
                        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': f'Error finding user: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)
    else:
        contact_data['managed_by'] = ''
    
    try:
        contact = Contact.objects.create(**contact_data)
        
        serializer = ContactSerializer(contact, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Error creating contact: {error_details}")
        return Response({'error': str(e), 'details': error_details}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def contact_detail(request, contact_id):
    contact = get_object_or_404(Contact, id=contact_id)
    
    if request.method == 'GET':
        serializer = ContactSerializer(contact, context={'request': request})
        return Response({'contact': serializer.data})
    
    if request.method == 'PATCH':
        # Helper functions
        def get_date(value):
            if not value:
                return None
            try:
                from datetime import datetime
                # Handle both YYYY-MM-DD and DD/MM/YYYY formats
                if '/' in str(value):
                    parts = str(value).split('/')
                    if len(parts) == 3:
                        day, month, year = parts
                        return datetime.strptime(f"{year}-{month}-{day}", "%Y-%m-%d").date()
                return datetime.strptime(str(value), "%Y-%m-%d").date()
            except:
                return None
        
        # Update personal information fields
        if 'civility' in request.data:
            contact.civility = request.data.get('civility', '') or ''
        if 'firstName' in request.data:
            contact.fname = request.data.get('firstName', '') or ''
        if 'lastName' in request.data:
            contact.lname = request.data.get('lastName', '') or ''
        if 'phone' in request.data:
            contact.phone = request.data.get('phone', '') or ''
        if 'mobile' in request.data:
            contact.mobile = request.data.get('mobile', '') or ''
        if 'email' in request.data:
            contact.email = request.data.get('email', '') or ''
        if 'birthDate' in request.data:
            contact.birth_date = get_date(request.data.get('birthDate'))
        if 'birthPlace' in request.data:
            contact.birth_place = request.data.get('birthPlace', '') or ''
        if 'address' in request.data:
            contact.address = request.data.get('address', '') or ''
        if 'postalCode' in request.data:
            contact.postal_code = request.data.get('postalCode', '') or ''
        if 'city' in request.data:
            contact.city = request.data.get('city', '') or ''
        if 'nationality' in request.data:
            contact.nationality = request.data.get('nationality', '') or ''
        if 'successor' in request.data:
            contact.successor = request.data.get('successor', '') or ''
        
        # Update managed_by if provided (should be user ID)
        # The frontend may send UserDetails.id (string) or DjangoUser.id
        if 'managed_by' in request.data:
            managed_by_value = request.data.get('managed_by', '') or ''
            if managed_by_value:
                # First try to find UserDetails by ID (this is what the frontend sends)
                user_details = UserDetails.objects.filter(id=managed_by_value).first()
                if user_details and user_details.django_user:
                    # Use DjangoUser.id for managed_by
                    contact.managed_by = str(user_details.django_user.id)
                else:
                    # Fallback: try to find DjangoUser directly by ID (for backward compatibility)
                    try:
                        user_id = int(managed_by_value)
                        from django.contrib.auth.models import User as DjangoUser
                        if DjangoUser.objects.filter(id=user_id).exists():
                            contact.managed_by = str(user_id)
                        else:
                            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
                    except (ValueError, TypeError):
                        # Try to find by username
                        from django.contrib.auth.models import User as DjangoUser
                        user = DjangoUser.objects.filter(username=managed_by_value).first()
                        if user:
                            contact.managed_by = str(user.id)
                        else:
                            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
            else:
                contact.managed_by = ''
        
        # Update source if provided
        if 'source' in request.data:
            contact.source = request.data.get('source', '') or ''
        
        # Update team if provided
        if 'team' in request.data:
            team_id = request.data.get('team')
            if team_id and team_id != 'none' and team_id != '':
                try:
                    team = Team.objects.get(id=team_id)
                    contact.team = team
                except Team.DoesNotExist:
                    return Response({'error': 'Team not found'}, status=status.HTTP_404_NOT_FOUND)
            else:
                # Si team est 'none' ou vide, supprimer l'équipe
                contact.team = None
        elif 'teamId' in request.data:
            team_id = request.data.get('teamId')
            if team_id and team_id != 'none':
                try:
                    team = Team.objects.get(id=team_id)
                    contact.team = team
                except Team.DoesNotExist:
                    return Response({'error': 'Team not found'}, status=status.HTTP_404_NOT_FOUND)
            else:
                # Si teamId est 'none' ou vide, supprimer l'équipe
                contact.team = None
        
        contact.save()
        serializer = ContactSerializer(contact, context={'request': request})
        return Response({'contact': serializer.data})


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def contact_delete(request, contact_id):
    contact = get_object_or_404(Contact, id=contact_id)
    contact.delete()
    return Response({'message': 'Contact supprimé avec succès'}, status=status.HTTP_200_OK)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_current_user(request):
    django_user = request.user
    try:
        # Try to get the user details profile
        user_details = UserDetails.objects.get(django_user=django_user)
        # Use UserDetailsSerializer to ensure consistent format with other endpoints
        serializer = UserDetailsSerializer(user_details)
        return Response(serializer.data)
    except UserDetails.DoesNotExist:
        # If custom user doesn't exist, return Django user data with default role
        # Still include first_name and last_name from Django Auth
        return Response({
            'id': str(django_user.id),
            'username': django_user.username,
            'email': django_user.email or '',
            'firstName': django_user.first_name or '',
            'lastName': django_user.last_name or '',
            'role': None,
            'roleName': None,
            'phone': '',
            'active': True,
            'permissions': [],  # No permissions if no role
        })

# Teams endpoints
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def team_list(request):
    teams = Team.objects.all()
    serializer = TeamSerializer(teams, many=True)
    return Response({'teams': serializer.data})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def team_create(request):
    serializer = TeamSerializer(data=request.data)
    if serializer.is_valid():
        # Generate team ID
        team_id = uuid.uuid4().hex[:12]
        while Team.objects.filter(id=team_id).exists():
            team_id = uuid.uuid4().hex[:12]
        team = serializer.save(id=team_id)
        
        # Create log entry
        new_value = get_team_data_for_log(team)
        create_log_entry(
            event_type='createTeam',
            user_id=request.user,
            request=request,
            old_value={},  # No old value for creation
            new_value=new_value
        )
        
        return Response(TeamSerializer(team).data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def team_delete(request, team_id):
    team = get_object_or_404(Team, id=team_id)
    
    # Get old value before deletion for logging
    old_value = get_team_data_for_log(team)
    
    # Delete the team
    team.delete()
    
    # Create log entry
    create_log_entry(
        event_type='deleteTeam',
        user_id=request.user,
        request=request,
        old_value=old_value,
        new_value={}  # No new value for deletion
    )
    
    return Response(status=status.HTTP_204_NO_CONTENT)

@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def team_detail(request, team_id):
    team = get_object_or_404(Team, id=team_id)
    
    if request.method == 'PATCH':
        # Get old value before update for logging
        old_value = get_team_data_for_log(team)
        
        # Update team name
        if 'name' in request.data:
            team.name = request.data['name']
            team.save()
        
        # Refresh team to get updated timestamp
        team.refresh_from_db()
        
        # Get new value after update for logging
        new_value = get_team_data_for_log(team)
        
        # Create log entry
        create_log_entry(
            event_type='editTeam',
            user_id=request.user,
            request=request,
            old_value=old_value,
            new_value=new_value
        )
        
        serializer = TeamSerializer(team)
        return Response(serializer.data)
    
    serializer = TeamDetailSerializer({
        'team': team,
        'team_members': team.team_members.all()
    })
    return Response(serializer.data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_list(request):
    users = UserDetails.objects.all()
    serializer = UserDetailsSerializer(users, many=True)
    return Response({'users': serializer.data})



@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def user_delete(request, user_id):
    user_details = get_object_or_404(UserDetails, id=user_id)
    
    # Get old value before deletion for logging
    old_value = {}
    if user_details.django_user:
        old_value = get_user_data_for_log(user_details.django_user, user_details)
    
    # Delete the user
    if user_details.django_user:
        user_details.django_user.delete()
    
    # Create log entry
    create_log_entry(
        event_type='deleteUser',
        user_id=request.user,
        request=request,
        old_value=old_value,
        new_value={}  # No new value for deletion
    )
    
    return Response(status=status.HTTP_204_NO_CONTENT)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def user_toggle_active(request, user_id):
    user_details = get_object_or_404(UserDetails, id=user_id)
    # Toggle the active status
    user_details.active = not user_details.active
    user_details.save()
    return Response({'active': user_details.active})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def user_reset_password(request, user_id):
    """Reset password for a user"""
    user_details = get_object_or_404(UserDetails, id=user_id)
    django_user = user_details.django_user
    
    if not django_user:
        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
    
    # Get new password from request, or use default
    new_password = request.data.get('password', 'Access@123')
    
    # Validate password length
    if len(new_password) < 6:
        return Response({'error': 'Password must be at least 6 characters long'}, status=status.HTTP_400_BAD_REQUEST)
    
    # Get old value for logging (without password for security)
    old_value = get_user_data_for_log(django_user, user_details)
    
    # Reset password using Django's set_password which properly hashes it
    django_user.set_password(new_password)
    django_user.save()
    
    # Get new value for logging (password is not included in user data)
    new_value = get_user_data_for_log(django_user, user_details)
    # Add indicator that password was reset
    new_value['password_reset'] = True
    
    # Create log entry
    create_log_entry(
        event_type='resetPassword',
        user_id=request.user,
        request=request,
        old_value=old_value,
        new_value=new_value
    )
    
    return Response({'message': 'Password reset successfully'}, status=status.HTTP_200_OK)

@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def user_update(request, user_id):
    user_details = get_object_or_404(UserDetails, id=user_id)
    django_user = user_details.django_user
    
    if not django_user:
        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
    
    # Get old value before update for logging
    old_value = get_user_data_for_log(django_user, user_details)
    
    # Update Django User fields
    if 'first_name' in request.data:
        django_user.first_name = request.data['first_name']
    if 'last_name' in request.data:
        django_user.last_name = request.data['last_name']
    if 'username' in request.data:
        django_user.username = request.data['username']
    if 'email' in request.data:
        django_user.email = request.data['email']
    django_user.save()
    
    # Update UserDetails fields
    if 'roleId' in request.data or 'role' in request.data:
        role_id = request.data.get('roleId') or request.data.get('role')
        if role_id:
            try:
                role = Role.objects.get(id=role_id)
                user_details.role = role
            except Role.DoesNotExist:
                return Response({'error': 'Role not found'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            user_details.role = None
    if 'phone' in request.data:
        user_details.phone = request.data['phone'] or ''
    
    # Update team membership using TeamMember table
    if 'teamId' in request.data:
        team_id = request.data['teamId']
        # Remove user from all teams first (using TeamMember relationship)
        TeamMember.objects.filter(user=user_details).delete()
        
        # If a team is specified, create a new TeamMember relationship
        if team_id:
            try:
                team = Team.objects.get(id=team_id)
                # Generate TeamMember ID
                team_member_id = uuid.uuid4().hex[:12]
                while TeamMember.objects.filter(id=team_member_id).exists():
                    team_member_id = uuid.uuid4().hex[:12]
                TeamMember.objects.create(
                    id=team_member_id,
                    user=user_details,
                    team=team
                )
            except Team.DoesNotExist:
                return Response({'error': 'Team not found'}, status=status.HTTP_400_BAD_REQUEST)
        # If team_id is None or empty, user is removed from all teams (already done above)
    
    user_details.save()
    
    # Refresh user_details to get updated team membership
    user_details.refresh_from_db()
    
    # Get new value after update for logging
    new_value = get_user_data_for_log(django_user, user_details)
    
    # Create log entry
    create_log_entry(
        event_type='editUser',
        user_id=request.user,
        request=request,
        old_value=old_value,
        new_value=new_value
    )
    
    # Return updated user data
    serializer = UserDetailsSerializer(user_details)
    return Response(serializer.data)

# Events endpoints
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def event_list(request):
    events = Event.objects.filter(userId=request.user).order_by('datetime')
    serializer = EventSerializer(events, many=True)
    return Response({'events': serializer.data})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def event_create(request):
    serializer = EventSerializer(data=request.data)
    if serializer.is_valid():
        # Generate event ID
        event_id = uuid.uuid4().hex[:12]
        while Event.objects.filter(id=event_id).exists():
            event_id = uuid.uuid4().hex[:12]
        
        # Get contact if contactId provided
        contact = None
        contact_id = request.data.get('contactId')
        if contact_id:
            try:
                contact = Contact.objects.get(id=contact_id)
            except Contact.DoesNotExist:
                pass
        
        event = serializer.save(
            id=event_id,
            userId=request.user,
            contactId=contact
        )
        return Response(EventSerializer(event).data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def event_update(request, event_id):
    event = get_object_or_404(Event, id=event_id, userId=request.user)
    serializer = EventSerializer(event, data=request.data, partial=True)
    if serializer.is_valid():
        # Get contact if contactId provided
        contact = None
        contact_id = request.data.get('contactId')
        if contact_id:
            try:
                contact = Contact.objects.get(id=contact_id)
            except Contact.DoesNotExist:
                pass
        elif contact_id == '' or contact_id is None:
            contact = None
        
        # Update event with new data
        event = serializer.save(contactId=contact)
        return Response(EventSerializer(event).data, status=status.HTTP_200_OK)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def event_delete(request, event_id):
    event = get_object_or_404(Event, id=event_id, userId=request.user)
    event.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def team_add_member(request, team_id):
    team = get_object_or_404(Team, id=team_id)
    user_id = request.data.get('userId')
    
    if not user_id:
        return Response({'error': 'userId is required'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        user_details = UserDetails.objects.get(id=user_id)
        
        # Check if user is already in the team
        if TeamMember.objects.filter(user=user_details, team=team).exists():
            return Response({'error': 'User is already in this team'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Generate TeamMember ID
        import uuid
        team_member_id = uuid.uuid4().hex[:12]
        while TeamMember.objects.filter(id=team_member_id).exists():
            team_member_id = uuid.uuid4().hex[:12]
        
        # Create TeamMember relationship
        team_member = TeamMember.objects.create(
            id=team_member_id,
            user=user_details,
            team=team
        )
        
        
        serializer = TeamMemberSerializer(team_member)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    except UserDetails.DoesNotExist:
        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def team_remove_member(request, team_id):
    team = get_object_or_404(Team, id=team_id)
    user_id = request.data.get('userId')
    
    if not user_id:
        return Response({'error': 'userId is required'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        user_details = UserDetails.objects.get(id=user_id)
        team_member = TeamMember.objects.get(user=user_details, team=team)
        
        # If user is teamleader, change role to something else (e.g., 'gestionnaire')
        if user_details.role and user_details.role.name.lower() == 'teamleader':
            try:
                gestionnaire_role = Role.objects.get(name__iexact='gestionnaire')
                user_details.role = gestionnaire_role
                user_details.save()
            except Role.DoesNotExist:
                pass  # If gestionnaire role doesn't exist, just remove from team
        
        # Remove TeamMember relationship
        team_member.delete()
        
        
        return Response(status=status.HTTP_204_NO_CONTENT)
    except UserDetails.DoesNotExist:
        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
    except TeamMember.DoesNotExist:
        return Response({'error': 'User not found in this team'}, status=status.HTTP_404_NOT_FOUND)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def team_set_leader(request, team_id):
    team = get_object_or_404(Team, id=team_id)
    user_id = request.data.get('userId')
    
    if not user_id:
        return Response({'error': 'userId is required'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        # Get team members through TeamMember
        team_members = TeamMember.objects.filter(team=team)
        user_ids_in_team = [tm.user.id for tm in team_members]
        
        # Remove leader status from all team members (change role from teamleader to gestionnaire)
        try:
            teamleader_role = Role.objects.get(name__iexact='teamleader')
            gestionnaire_role = Role.objects.get(name__iexact='gestionnaire')
            UserDetails.objects.filter(
                id__in=user_ids_in_team, 
                role=teamleader_role
            ).update(role=gestionnaire_role)
        except Role.DoesNotExist:
            pass  # If roles don't exist, skip
        
        # Set new leader (change role to teamleader)
        user_details = UserDetails.objects.get(id=user_id)
        
        # Verify user is in the team
        if not TeamMember.objects.filter(user=user_details, team=team).exists():
            return Response({'error': 'User not found in this team'}, status=status.HTTP_404_NOT_FOUND)
        
        try:
            teamleader_role = Role.objects.get(name__iexact='teamleader')
            user_details.role = teamleader_role
            user_details.save()
        except Role.DoesNotExist:
            return Response({'error': 'Teamleader role not found'}, status=status.HTTP_400_BAD_REQUEST)
        
        serializer = UserDetailsSerializer(user_details)
        return Response(serializer.data, status=status.HTTP_200_OK)
    except UserDetails.DoesNotExist:
        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

# Roles endpoints
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def role_list(request):
    """List all roles"""
    roles = Role.objects.all().order_by('name')
    serializer = RoleSerializer(roles, many=True)
    return Response({'roles': serializer.data})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def role_create(request):
    """Create a new role"""
    serializer = RoleSerializer(data=request.data)
    if serializer.is_valid():
        # Generate role ID
        role_id = uuid.uuid4().hex[:12]
        while Role.objects.filter(id=role_id).exists():
            role_id = uuid.uuid4().hex[:12]
        role = serializer.save(id=role_id)
        return Response(RoleSerializer(role).data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['PUT', 'PATCH'])
@permission_classes([IsAuthenticated])
def role_update(request, role_id):
    """Update a role"""
    role = get_object_or_404(Role, id=role_id)
    serializer = RoleSerializer(role, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(RoleSerializer(role).data, status=status.HTTP_200_OK)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def role_delete(request, role_id):
    """Delete a role"""
    role = get_object_or_404(Role, id=role_id)
    role.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)

# Permissions endpoints
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def permission_list(request):
    """List all permissions"""
    permissions = Permission.objects.all().order_by('component', 'field_name')
    serializer = PermissionSerializer(permissions, many=True)
    return Response({'permissions': serializer.data})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def permission_create(request):
    """Create a new permission"""
    serializer = PermissionSerializer(data=request.data)
    if serializer.is_valid():
        # Generate permission ID
        permission_id = uuid.uuid4().hex[:12]
        while Permission.objects.filter(id=permission_id).exists():
            permission_id = uuid.uuid4().hex[:12]
        
        # Ensure action is provided, default to 'view'
        action = request.data.get('action', 'view')
        if action not in ['view', 'create', 'edit', 'delete']:
            action = 'view'
        
        # The serializer will handle statusId conversion to status
        permission = serializer.save(id=permission_id, action=action)
        return Response(PermissionSerializer(permission).data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['PUT', 'PATCH'])
@permission_classes([IsAuthenticated])
def permission_update(request, permission_id):
    """Update a permission"""
    permission = get_object_or_404(Permission, id=permission_id)
    
    # The serializer will handle statusId conversion to status
    serializer = PermissionSerializer(permission, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(PermissionSerializer(permission).data, status=status.HTTP_200_OK)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def permission_delete(request, permission_id):
    """Delete a permission"""
    permission = get_object_or_404(Permission, id=permission_id)
    permission.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)

# Permission-Role endpoints
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def permission_role_list(request):
    """List all permission-role relationships"""
    permission_roles = PermissionRole.objects.all().select_related('role', 'permission')
    serializer = PermissionRoleSerializer(permission_roles, many=True)
    return Response({'permissionRoles': serializer.data})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def permission_role_create(request):
    """Assign a permission to a role"""
    role_id = request.data.get('roleId')
    permission_id = request.data.get('permissionId')
    
    if not role_id or not permission_id:
        return Response({'error': 'roleId and permissionId are required'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        role = Role.objects.get(id=role_id)
        permission = Permission.objects.get(id=permission_id)
        
        # Check if relationship already exists
        if PermissionRole.objects.filter(role=role, permission=permission).exists():
            return Response({'error': 'Permission already assigned to this role'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Generate permission role ID
        permission_role_id = uuid.uuid4().hex[:12]
        while PermissionRole.objects.filter(id=permission_role_id).exists():
            permission_role_id = uuid.uuid4().hex[:12]
        
        permission_role = PermissionRole.objects.create(
            id=permission_role_id,
            role=role,
            permission=permission
        )
        
        serializer = PermissionRoleSerializer(permission_role)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    except Role.DoesNotExist:
        return Response({'error': 'Role not found'}, status=status.HTTP_404_NOT_FOUND)
    except Permission.DoesNotExist:
        return Response({'error': 'Permission not found'}, status=status.HTTP_404_NOT_FOUND)

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def permission_role_delete(request, permission_role_id):
    """Remove a permission from a role"""
    permission_role = get_object_or_404(PermissionRole, id=permission_role_id)
    permission_role.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)

# Statuses endpoints
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def status_list(request):
    """List all statuses"""
    status_type = request.query_params.get('type', None)
    statuses = Status.objects.all()
    if status_type:
        statuses = statuses.filter(type=status_type)
    statuses = statuses.order_by('order_index', 'name')
    serializer = StatusSerializer(statuses, many=True)
    return Response({'statuses': serializer.data})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def status_create(request):
    """Create a new status"""
    serializer = StatusSerializer(data=request.data)
    if serializer.is_valid():
        # Generate status ID
        status_id = uuid.uuid4().hex[:12]
        while Status.objects.filter(id=status_id).exists():
            status_id = uuid.uuid4().hex[:12]
        
        # Auto-assign orderIndex: get the max orderIndex for the same type and add 1
        status_type = serializer.validated_data.get('type', 'lead')
        max_order = Status.objects.filter(type=status_type).aggregate(
            max_order=models.Max('order_index')
        )['max_order'] or -1
        order_index = max_order + 1
        
        status_obj = serializer.save(id=status_id, order_index=order_index)
        return Response(StatusSerializer(status_obj).data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['PUT', 'PATCH'])
@permission_classes([IsAuthenticated])
def status_update(request, status_id):
    """Update a status"""
    status_obj = get_object_or_404(Status, id=status_id)
    serializer = StatusSerializer(status_obj, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(StatusSerializer(status_obj).data, status=status.HTTP_200_OK)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def status_delete(request, status_id):
    """Delete a status"""
    status_obj = get_object_or_404(Status, id=status_id)
    status_obj.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def status_reorder(request):
    """Update orderIndex for multiple statuses"""
    try:
        statuses_data = request.data.get('statuses', [])
        if not isinstance(statuses_data, list):
            return Response(
                {'error': 'statuses must be a list'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        for item in statuses_data:
            status_id = item.get('id')
            order_index = item.get('orderIndex')
            
            if not status_id or order_index is None:
                continue
                
            try:
                status_obj = Status.objects.get(id=status_id)
                status_obj.order_index = order_index
                status_obj.save()
            except Status.DoesNotExist:
                continue
        
        return Response({'success': True}, status=status.HTTP_200_OK)
    except Exception as e:
        return Response(
            {'error': str(e)}, 
            status=status.HTTP_400_BAD_REQUEST
        )

