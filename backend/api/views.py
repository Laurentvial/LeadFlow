from django.shortcuts import render
from django.contrib.auth.models import User as DjangoUser
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from .models import Client
from .models import Note
from .models import UserDetails
from .models import Team
from .models import Event
from .models import TeamMember
from .models import Log
from .models import Asset
from .models import ClientAsset
from .models import RIB
from .models import ClientRIB
from .models import UsefulLink
from .models import ClientUsefulLink
from .models import Transaction
from .serializer import (
    UserSerializer, ClientSerializer, NoteSerializer,
    TeamSerializer, TeamDetailSerializer, UserDetailsSerializer, EventSerializer, TeamMemberSerializer,
    AssetSerializer, ClientAssetSerializer, RIBSerializer, ClientRIBSerializer, UsefulLinkSerializer, ClientUsefulLinkSerializer,
    TransactionSerializer
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
        user_data['role'] = user_details.role
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
        # clientId can be null if not provided - preserve it from validated_data
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
            clientId=validated_data.get('clientId')  # Can be None/null
        )

class NoteDeleteView(generics.DestroyAPIView):
    serializer_class = NoteSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = 'id'
    lookup_url_kwarg = 'pk'
    
    def get_queryset(self):
        user = self.request.user
        return Note.objects.filter(userId=user)

class ClientView(generics.ListAPIView):
    queryset = Client.objects.all()
    serializer_class = ClientSerializer
    permission_classes = [IsAuthenticated]  # Explicitly set permission
    
    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        return Response({'clients': response.data})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def client_create(request):
    # Validate required fields
    if not request.data.get('firstName'):
        return Response({'error': 'Le prénom est requis'}, status=status.HTTP_400_BAD_REQUEST)
    if not request.data.get('lastName'):
        return Response({'error': 'Le nom est requis'}, status=status.HTTP_400_BAD_REQUEST)
    if not request.data.get('email'):
        return Response({'error': 'L\'email est requis'}, status=status.HTTP_400_BAD_REQUEST)
    
    # Check if email already exists
    email = request.data.get('email', '').strip()
    if email and Client.objects.filter(email=email).exists():
        return Response({'error': 'Un client avec cet email existe déjà'}, status=status.HTTP_400_BAD_REQUEST)
    
    # Generate client ID
    client_id = uuid.uuid4().hex[:12]
    while Client.objects.filter(id=client_id).exists():
        client_id = uuid.uuid4().hex[:12]
    
    # Helper function to safely convert to decimal
    def to_decimal(value, default=0):
        if value is None or value == '':
            return default
        try:
            result = float(value)
            return result if result >= 0 else default
        except (ValueError, TypeError):
            return default
    
    # Helper function to safely get date
    def get_date(value):
        if not value or value == '':
            return None
        return value
    
    # Helper function to safely get list
    def get_list(value, default=None):
        if default is None:
            default = []
        if value is None:
            return default
        if isinstance(value, list):
            return value
        # Handle QueryDict (from FormData) - getlist returns a list
        if hasattr(value, '__iter__') and not isinstance(value, (str, bytes)):
            return list(value)
        return default
    
    # Map frontend field names to model field names
    # Informations personnelles
    client_data = {
        'id': client_id,
        'civility': request.data.get('civility', '') or '',
        'fname': request.data.get('firstName', '') or '',
        'lname': request.data.get('lastName', '') or '',
        'platform_access': request.data.get('platformAccess', True),
        'active': request.data.get('active', True),
        'template': request.data.get('template', '') or '',
        'support': request.data.get('support', '') or '',
        'password': request.data.get('password', 'Access@123') or 'Access@123',
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
    
    # Handle profile photo upload
    if 'profilePhoto' in request.FILES:
        client_data['profile_photo'] = request.FILES['profilePhoto']
    
    # Convert platformAccess and active from string to boolean if needed (FormData sends strings)
    if isinstance(client_data.get('platform_access'), str):
        client_data['platform_access'] = client_data['platform_access'].lower() == 'true'
    if isinstance(client_data.get('active'), str):
        client_data['active'] = client_data['active'].lower() == 'true'
    
    # Handle patrimonial data
    # Use getlist for FormData, get for JSON
    professions = request.data.getlist('professions') if hasattr(request.data, 'getlist') else get_list(request.data.get('professions'))
    objectives = request.data.getlist('objectives') if hasattr(request.data, 'getlist') else get_list(request.data.get('objectives'))
    experience = request.data.getlist('experience') if hasattr(request.data, 'getlist') else get_list(request.data.get('experience'))
    
    # Handle managed_by separately to ensure it's a valid user ID
    # The frontend sends UserDetails.id (string), we need to convert it to DjangoUser.id
    managed_by_value = request.data.get('managerId', '') or request.data.get('managed_by', '') or ''
    if managed_by_value:
        try:
            # First try to find UserDetails by ID (this is what the frontend sends)
            user_details = UserDetails.objects.filter(id=managed_by_value).first()
            if user_details and user_details.django_user:
                # Use DjangoUser.id for managed_by
                client_data['managed_by'] = str(user_details.django_user.id)
            else:
                # Fallback: try to find DjangoUser directly by ID (for backward compatibility)
                try:
                    user_id = int(managed_by_value)
                    from django.contrib.auth.models import User as DjangoUser
                    if DjangoUser.objects.filter(id=user_id).exists():
                        client_data['managed_by'] = str(user_id)
                    else:
                        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
                except (ValueError, TypeError):
                    # Try to find by username
                    from django.contrib.auth.models import User as DjangoUser
                    user = DjangoUser.objects.filter(username=managed_by_value).first()
                    if user:
                        client_data['managed_by'] = str(user.id)
                    else:
                        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': f'Error finding user: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)
    else:
        client_data['managed_by'] = ''
    
    client_data.update({
        # Fiche patrimoniale
        'professional_activity_status': request.data.get('professionalActivityStatus') or '',
        'professional_activity_comment': request.data.get('professionalActivityComment') or '',
        'professions': professions,
        'professions_comment': request.data.get('professionsComment') or '',
        'bank_name': request.data.get('bankName') or '',
        'current_account': to_decimal(request.data.get('currentAccount')),
        'livret_ab': to_decimal(request.data.get('livretAB')),
        'pea': to_decimal(request.data.get('pea')),
        'pel': to_decimal(request.data.get('pel')),
        'ldd': to_decimal(request.data.get('ldd')),
        'cel': to_decimal(request.data.get('cel')),
        'csl': to_decimal(request.data.get('csl')),
        'securities_account': to_decimal(request.data.get('securitiesAccount')),
        'life_insurance': to_decimal(request.data.get('lifeInsurance')),
        'savings_comment': request.data.get('savingsComment') or '',
        'total_wealth': to_decimal(request.data.get('totalWealth')),
        'objectives': objectives,
        'objectives_comment': request.data.get('objectivesComment') or '',
        'experience': experience,
        'experience_comment': request.data.get('experienceComment') or '',
        'tax_optimization': bool(request.data.get('taxOptimization', False)) if not isinstance(request.data.get('taxOptimization'), str) else request.data.get('taxOptimization', 'false').lower() == 'true',
        'tax_optimization_comment': request.data.get('taxOptimizationComment') or '',
        'annual_household_income': to_decimal(request.data.get('annualHouseholdIncome')),
    })
    
    try:
        client = Client.objects.create(**client_data)
        
        # Automatically assign default assets, RIBs, and useful links
        # Assign default assets
        default_assets = Asset.objects.filter(default=True)
        for asset in default_assets:
            # Check if client already has this asset (shouldn't happen for new client, but safety check)
            if not ClientAsset.objects.filter(client=client, asset=asset).exists():
                client_asset_id = uuid.uuid4().hex[:12]
                while ClientAsset.objects.filter(id=client_asset_id).exists():
                    client_asset_id = uuid.uuid4().hex[:12]
                ClientAsset.objects.create(
                    id=client_asset_id,
                    client=client,
                    asset=asset
                )
        
        # Assign default RIBs
        default_ribs = RIB.objects.filter(default=True)
        for rib in default_ribs:
            # Check if client already has this RIB (shouldn't happen for new client, but safety check)
            if not ClientRIB.objects.filter(client=client, rib=rib).exists():
                client_rib_id = uuid.uuid4().hex[:12]
                while ClientRIB.objects.filter(id=client_rib_id).exists():
                    client_rib_id = uuid.uuid4().hex[:12]
                ClientRIB.objects.create(
                    id=client_rib_id,
                    client=client,
                    rib=rib
                )
        
        # Assign default useful links
        default_useful_links = UsefulLink.objects.filter(default=True)
        for useful_link in default_useful_links:
            # Check if client already has this useful link (shouldn't happen for new client, but safety check)
            if not ClientUsefulLink.objects.filter(client=client, useful_link=useful_link).exists():
                client_useful_link_id = uuid.uuid4().hex[:12]
                while ClientUsefulLink.objects.filter(id=client_useful_link_id).exists():
                    client_useful_link_id = uuid.uuid4().hex[:12]
                ClientUsefulLink.objects.create(
                    id=client_useful_link_id,
                    client=client,
                    useful_link=useful_link
                )
        
        serializer = ClientSerializer(client, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Error creating client: {error_details}")
        return Response({'error': str(e), 'details': error_details}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def client_detail(request, client_id):
    client = get_object_or_404(Client, id=client_id)
    
    if request.method == 'GET':
        serializer = ClientSerializer(client, context={'request': request})
        return Response({'client': serializer.data})
    
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
            client.civility = request.data.get('civility', '') or ''
        if 'firstName' in request.data:
            client.fname = request.data.get('firstName', '') or ''
        if 'lastName' in request.data:
            client.lname = request.data.get('lastName', '') or ''
        if 'template' in request.data:
            client.template = request.data.get('template', '') or ''
        if 'support' in request.data:
            client.support = request.data.get('support', '') or ''
        if 'password' in request.data:
            client.password = request.data.get('password', '') or ''
        if 'phone' in request.data:
            client.phone = request.data.get('phone', '') or ''
        if 'mobile' in request.data:
            client.mobile = request.data.get('mobile', '') or ''
        if 'email' in request.data:
            client.email = request.data.get('email', '') or ''
        if 'birthDate' in request.data:
            client.birth_date = get_date(request.data.get('birthDate'))
        if 'birthPlace' in request.data:
            client.birth_place = request.data.get('birthPlace', '') or ''
        if 'address' in request.data:
            client.address = request.data.get('address', '') or ''
        if 'postalCode' in request.data:
            client.postal_code = request.data.get('postalCode', '') or ''
        if 'city' in request.data:
            client.city = request.data.get('city', '') or ''
        if 'nationality' in request.data:
            client.nationality = request.data.get('nationality', '') or ''
        if 'successor' in request.data:
            client.successor = request.data.get('successor', '') or ''
        
        # Handle profile photo upload or removal
        if 'profilePhoto' in request.FILES:
            client.profile_photo = request.FILES['profilePhoto']
        elif 'removeProfilePhoto' in request.data:
            # Handle both string and boolean values
            remove_photo = request.data.get('removeProfilePhoto')
            if isinstance(remove_photo, str):
                remove_photo = remove_photo.lower() == 'true'
            if remove_photo:
                # Delete the file if it exists
                if client.profile_photo:
                    client.profile_photo.delete(save=False)
                client.profile_photo = None
        
        # Update managed_by if provided (should be user ID)
        # The frontend may send UserDetails.id (string) or DjangoUser.id
        if 'managed_by' in request.data:
            managed_by_value = request.data.get('managed_by', '') or ''
            if managed_by_value:
                # First try to find UserDetails by ID (this is what the frontend sends)
                user_details = UserDetails.objects.filter(id=managed_by_value).first()
                if user_details and user_details.django_user:
                    # Use DjangoUser.id for managed_by
                    client.managed_by = str(user_details.django_user.id)
                else:
                    # Fallback: try to find DjangoUser directly by ID (for backward compatibility)
                    try:
                        user_id = int(managed_by_value)
                        from django.contrib.auth.models import User as DjangoUser
                        if DjangoUser.objects.filter(id=user_id).exists():
                            client.managed_by = str(user_id)
                        else:
                            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
                    except (ValueError, TypeError):
                        # Try to find by username
                        from django.contrib.auth.models import User as DjangoUser
                        user = DjangoUser.objects.filter(username=managed_by_value).first()
                        if user:
                            client.managed_by = str(user.id)
                        else:
                            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
            else:
                client.managed_by = ''
        
        # Update source if provided
        if 'source' in request.data:
            client.source = request.data.get('source', '') or ''
        
        # Update team if provided
        if 'team' in request.data:
            team_id = request.data.get('team')
            if team_id and team_id != 'none' and team_id != '':
                try:
                    team = Team.objects.get(id=team_id)
                    client.team = team
                except Team.DoesNotExist:
                    return Response({'error': 'Team not found'}, status=status.HTTP_404_NOT_FOUND)
            else:
                # Si team est 'none' ou vide, supprimer l'équipe
                client.team = None
        elif 'teamId' in request.data:
            team_id = request.data.get('teamId')
            if team_id and team_id != 'none':
                try:
                    team = Team.objects.get(id=team_id)
                    client.team = team
                except Team.DoesNotExist:
                    return Response({'error': 'Team not found'}, status=status.HTTP_404_NOT_FOUND)
            else:
                # Si teamId est 'none' ou vide, supprimer l'équipe
                client.team = None
        
        # Update platform_access if provided
        if 'platformAccess' in request.data:
            platform_access = request.data.get('platformAccess')
            # Handle both boolean and string values
            if isinstance(platform_access, str):
                client.platform_access = platform_access.lower() == 'true'
            else:
                client.platform_access = bool(platform_access)
        
        # Helper functions for patrimonial data
        def to_decimal(value, default=0):
            if value is None or value == '':
                return default
            try:
                return float(value)
            except (ValueError, TypeError):
                return default
        
        def get_list(value, default=None):
            if default is None:
                default = []
            if value is None:
                return default
            if isinstance(value, list):
                return value
            if hasattr(value, '__iter__') and not isinstance(value, (str, bytes)):
                return list(value)
            return default
        
        # Update patrimonial fields
        if 'professionalActivityStatus' in request.data:
            client.professional_activity_status = request.data.get('professionalActivityStatus', '') or ''
        if 'professionalActivityComment' in request.data:
            client.professional_activity_comment = request.data.get('professionalActivityComment', '') or ''
        if 'professions' in request.data:
            professions = get_list(request.data.get('professions'))
            client.professions = professions
        if 'professionsComment' in request.data:
            client.professions_comment = request.data.get('professionsComment', '') or ''
        if 'bankName' in request.data:
            client.bank_name = request.data.get('bankName', '') or ''
        if 'currentAccount' in request.data:
            client.current_account = to_decimal(request.data.get('currentAccount'))
        if 'livretAB' in request.data:
            client.livret_ab = to_decimal(request.data.get('livretAB'))
        if 'pea' in request.data:
            client.pea = to_decimal(request.data.get('pea'))
        if 'pel' in request.data:
            client.pel = to_decimal(request.data.get('pel'))
        if 'ldd' in request.data:
            client.ldd = to_decimal(request.data.get('ldd'))
        if 'cel' in request.data:
            client.cel = to_decimal(request.data.get('cel'))
        if 'csl' in request.data:
            client.csl = to_decimal(request.data.get('csl'))
        if 'securitiesAccount' in request.data:
            client.securities_account = to_decimal(request.data.get('securitiesAccount'))
        if 'lifeInsurance' in request.data:
            client.life_insurance = to_decimal(request.data.get('lifeInsurance'))
        if 'savingsComment' in request.data:
            client.savings_comment = request.data.get('savingsComment', '') or ''
        if 'totalWealth' in request.data:
            client.total_wealth = to_decimal(request.data.get('totalWealth'))
        if 'objectives' in request.data:
            objectives = get_list(request.data.get('objectives'))
            client.objectives = objectives
        if 'objectivesComment' in request.data:
            client.objectives_comment = request.data.get('objectivesComment', '') or ''
        if 'experience' in request.data:
            experience = get_list(request.data.get('experience'))
            client.experience = experience
        if 'experienceComment' in request.data:
            client.experience_comment = request.data.get('experienceComment', '') or ''
        if 'taxOptimization' in request.data:
            tax_opt = request.data.get('taxOptimization')
            if isinstance(tax_opt, str):
                client.tax_optimization = tax_opt.lower() == 'true'
            else:
                client.tax_optimization = bool(tax_opt)
        if 'taxOptimizationComment' in request.data:
            client.tax_optimization_comment = request.data.get('taxOptimizationComment', '') or ''
        if 'annualHouseholdIncome' in request.data:
            client.annual_household_income = to_decimal(request.data.get('annualHouseholdIncome'))
        
        client.save()
        serializer = ClientSerializer(client, context={'request': request})
        return Response({'client': serializer.data})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def client_toggle_active(request, client_id):
    client = get_object_or_404(Client, id=client_id)
    client.active = not client.active
    client.save()
    return Response({'active': client.active})

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def client_delete(request, client_id):
    client = get_object_or_404(Client, id=client_id)
    client.delete()
    return Response({'message': 'Client supprimé avec succès'}, status=status.HTTP_200_OK)

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
            'role': '0',  # Default role
            'phone': '',
            'active': True,
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
    if 'role' in request.data:
        user_details.role = request.data['role']
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
        
        # Get client if clientId provided
        client = None
        if request.data.get('clientId'):
            try:
                client = Client.objects.get(id=request.data['clientId'])
            except Client.DoesNotExist:
                pass
        
        event = serializer.save(
            id=event_id,
            userId=request.user,
            clientId=client
        )
        return Response(EventSerializer(event).data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def event_update(request, event_id):
    event = get_object_or_404(Event, id=event_id, userId=request.user)
    serializer = EventSerializer(event, data=request.data, partial=True)
    if serializer.is_valid():
        # Get client if clientId provided
        client = None
        if request.data.get('clientId'):
            try:
                client = Client.objects.get(id=request.data['clientId'])
            except Client.DoesNotExist:
                pass
        elif request.data.get('clientId') == '' or request.data.get('clientId') is None:
            client = None
        
        # Update event with new data
        event = serializer.save(clientId=client)
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
        if user_details.role == 'teamleader':
            user_details.role = 'gestionnaire'
            user_details.save()
        
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
        UserDetails.objects.filter(id__in=user_ids_in_team, role='teamleader').update(role='gestionnaire')
        
        # Set new leader (change role to teamleader)
        user_details = UserDetails.objects.get(id=user_id)
        
        # Verify user is in the team
        if not TeamMember.objects.filter(user=user_details, team=team).exists():
            return Response({'error': 'User not found in this team'}, status=status.HTTP_404_NOT_FOUND)
        
        user_details.role = 'teamleader'
        user_details.save()
        
        serializer = UserDetailsSerializer(user_details)
        return Response(serializer.data, status=status.HTTP_200_OK)
    except UserDetails.DoesNotExist:
        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

# Assets endpoints
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def asset_list(request):
    """Liste tous les assets disponibles"""
    assets = Asset.objects.all().order_by('type', 'name')
    serializer = AssetSerializer(assets, many=True)
    return Response({'assets': serializer.data})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def asset_create(request):
    """Créer un nouvel asset"""
    serializer = AssetSerializer(data=request.data)
    if serializer.is_valid():
        # Generate asset ID
        asset_id = uuid.uuid4().hex[:12]
        while Asset.objects.filter(id=asset_id).exists():
            asset_id = uuid.uuid4().hex[:12]
        asset = serializer.save(id=asset_id)
        return Response(AssetSerializer(asset).data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['PUT', 'PATCH'])
@permission_classes([IsAuthenticated])
def asset_update(request, asset_id):
    """Modifier un asset"""
    asset = get_object_or_404(Asset, id=asset_id)
    serializer = AssetSerializer(asset, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(AssetSerializer(asset).data, status=status.HTTP_200_OK)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def asset_delete(request, asset_id):
    """Supprimer un asset"""
    asset = get_object_or_404(Asset, id=asset_id)
    asset.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def client_assets(request, client_id):
    """Liste les assets d'un client"""
    client = get_object_or_404(Client, id=client_id)
    client_assets = ClientAsset.objects.filter(client=client).select_related('asset')
    serializer = ClientAssetSerializer(client_assets, many=True)
    return Response({'assets': serializer.data})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def client_asset_add(request, client_id):
    """Ajouter un asset à un client"""
    client = get_object_or_404(Client, id=client_id)
    asset_id = request.data.get('assetId')
    
    if not asset_id:
        return Response({'error': 'assetId is required'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        asset = Asset.objects.get(id=asset_id)
        
        # Check if client already has this asset
        if ClientAsset.objects.filter(client=client, asset=asset).exists():
            return Response({'error': 'Client already has this asset'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Generate ClientAsset ID
        client_asset_id = uuid.uuid4().hex[:12]
        while ClientAsset.objects.filter(id=client_asset_id).exists():
            client_asset_id = uuid.uuid4().hex[:12]
        
        # Create ClientAsset relationship
        client_asset = ClientAsset.objects.create(
            id=client_asset_id,
            client=client,
            asset=asset
        )
        
        serializer = ClientAssetSerializer(client_asset)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    except Asset.DoesNotExist:
        return Response({'error': 'Asset not found'}, status=status.HTTP_404_NOT_FOUND)

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def client_asset_remove(request, client_id, asset_id):
    """Retirer un asset d'un client"""
    client = get_object_or_404(Client, id=client_id)
    asset = get_object_or_404(Asset, id=asset_id)
    
    try:
        client_asset = ClientAsset.objects.get(client=client, asset=asset)
        client_asset.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    except ClientAsset.DoesNotExist:
        return Response({'error': 'Client asset relationship not found'}, status=status.HTTP_404_NOT_FOUND)

@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def client_asset_toggle_featured(request, client_id, asset_id):
    """Basculer le statut 'mis en avant' d'un asset pour un client"""
    client = get_object_or_404(Client, id=client_id)
    asset = get_object_or_404(Asset, id=asset_id)
    
    try:
        client_asset = ClientAsset.objects.get(client=client, asset=asset)
        client_asset.featured = not client_asset.featured
        client_asset.save()
        serializer = ClientAssetSerializer(client_asset)
        return Response(serializer.data, status=status.HTTP_200_OK)
    except ClientAsset.DoesNotExist:
        return Response({'error': 'Client asset relationship not found'}, status=status.HTTP_404_NOT_FOUND)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def client_assets_reset(request, client_id):
    """Réinitialiser les assets d'un client : retirer ceux qui ne sont pas default=True, ajouter ceux qui sont default=True"""
    client = get_object_or_404(Client, id=client_id)
    
    # Get all current client assets (convert to list to avoid query issues after deletion)
    current_client_assets = list(ClientAsset.objects.filter(client=client).select_related('asset'))
    current_asset_ids = {ca.asset.id for ca in current_client_assets}
    
    # Get all default assets
    default_assets = Asset.objects.filter(default=True)
    
    # Remove assets that are not default=True
    removed_count = 0
    for client_asset in current_client_assets:
        if not client_asset.asset.default:
            client_asset.delete()
            removed_count += 1
    
    # Add assets that are default=True and not already assigned
    added_count = 0
    for asset in default_assets:
        if asset.id not in current_asset_ids:
            # Generate ClientAsset ID
            client_asset_id = uuid.uuid4().hex[:12]
            while ClientAsset.objects.filter(id=client_asset_id).exists():
                client_asset_id = uuid.uuid4().hex[:12]
            
            # Create ClientAsset relationship
            ClientAsset.objects.create(
                id=client_asset_id,
                client=client,
                asset=asset
            )
            added_count += 1
    
    return Response({
        'message': 'Assets réinitialisés avec succès',
        'removed': removed_count,
        'added': added_count
    }, status=status.HTTP_200_OK)

# RIBs endpoints
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def rib_list(request):
    """Liste tous les RIBs disponibles"""
    ribs = RIB.objects.all().order_by('name')
    serializer = RIBSerializer(ribs, many=True)
    return Response({'ribs': serializer.data})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def rib_create(request):
    """Créer un nouveau RIB"""
    serializer = RIBSerializer(data=request.data)
    if serializer.is_valid():
        # Generate RIB ID
        rib_id = uuid.uuid4().hex[:12]
        while RIB.objects.filter(id=rib_id).exists():
            rib_id = uuid.uuid4().hex[:12]
        rib = serializer.save(id=rib_id)
        return Response(RIBSerializer(rib).data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['PUT', 'PATCH'])
@permission_classes([IsAuthenticated])
def rib_update(request, rib_id):
    """Modifier un RIB"""
    rib = get_object_or_404(RIB, id=rib_id)
    serializer = RIBSerializer(rib, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(RIBSerializer(rib).data, status=status.HTTP_200_OK)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def rib_delete(request, rib_id):
    """Supprimer un RIB"""
    rib = get_object_or_404(RIB, id=rib_id)
    rib.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def client_ribs(request, client_id):
    """Liste les RIBs d'un client"""
    client = get_object_or_404(Client, id=client_id)
    client_ribs = ClientRIB.objects.filter(client=client).select_related('rib')
    serializer = ClientRIBSerializer(client_ribs, many=True)
    return Response({'ribs': serializer.data})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def client_rib_add(request, client_id):
    """Ajouter un RIB à un client"""
    client = get_object_or_404(Client, id=client_id)
    rib_id = request.data.get('ribId')
    
    if not rib_id:
        return Response({'error': 'ribId is required'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        rib = RIB.objects.get(id=rib_id)
        
        # Check if client already has this RIB
        if ClientRIB.objects.filter(client=client, rib=rib).exists():
            return Response({'error': 'Client already has this RIB'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Generate ClientRIB ID
        client_rib_id = uuid.uuid4().hex[:12]
        while ClientRIB.objects.filter(id=client_rib_id).exists():
            client_rib_id = uuid.uuid4().hex[:12]
        
        # Create ClientRIB relationship
        client_rib = ClientRIB.objects.create(
            id=client_rib_id,
            client=client,
            rib=rib
        )
        
        serializer = ClientRIBSerializer(client_rib)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    except RIB.DoesNotExist:
        return Response({'error': 'RIB not found'}, status=status.HTTP_404_NOT_FOUND)

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def client_rib_remove(request, client_id, rib_id):
    """Retirer un RIB d'un client"""
    client = get_object_or_404(Client, id=client_id)
    rib = get_object_or_404(RIB, id=rib_id)
    
    try:
        client_rib = ClientRIB.objects.get(client=client, rib=rib)
        client_rib.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    except ClientRIB.DoesNotExist:
        return Response({'error': 'Client RIB relationship not found'}, status=status.HTTP_404_NOT_FOUND)

# Useful Links endpoints
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def useful_link_list(request):
    """Liste tous les liens utiles disponibles"""
    useful_links = UsefulLink.objects.all().order_by('name')
    serializer = UsefulLinkSerializer(useful_links, many=True, context={'request': request})
    return Response({'usefulLinks': serializer.data})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def useful_link_create(request):
    """Créer un nouveau lien utile"""
    serializer = UsefulLinkSerializer(data=request.data, context={'request': request})
    if serializer.is_valid():
        # Generate UsefulLink ID
        useful_link_id = uuid.uuid4().hex[:12]
        while UsefulLink.objects.filter(id=useful_link_id).exists():
            useful_link_id = uuid.uuid4().hex[:12]
        useful_link = serializer.save(id=useful_link_id)
        return Response(UsefulLinkSerializer(useful_link, context={'request': request}).data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['PUT', 'PATCH'])
@permission_classes([IsAuthenticated])
def useful_link_update(request, useful_link_id):
    """Modifier un lien utile"""
    useful_link = get_object_or_404(UsefulLink, id=useful_link_id)
    
    # Check if image should be removed
    remove_image = request.data.get('removeImage', '').lower() == 'true'
    if remove_image and useful_link.image:
        useful_link.image.delete(save=False)
    
    serializer = UsefulLinkSerializer(useful_link, data=request.data, partial=True, context={'request': request})
    if serializer.is_valid():
        useful_link = serializer.save()
        # If removeImage flag was set, ensure image is None
        if remove_image:
            useful_link.image = None
            useful_link.save()
        return Response(UsefulLinkSerializer(useful_link, context={'request': request}).data, status=status.HTTP_200_OK)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def useful_link_delete(request, useful_link_id):
    """Supprimer un lien utile"""
    useful_link = get_object_or_404(UsefulLink, id=useful_link_id)
    useful_link.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def client_useful_links(request, client_id):
    """Liste les liens utiles d'un client"""
    client = get_object_or_404(Client, id=client_id)
    client_useful_links = ClientUsefulLink.objects.filter(client=client).select_related('useful_link')
    serializer = ClientUsefulLinkSerializer(client_useful_links, many=True, context={'request': request})
    return Response({'usefulLinks': serializer.data})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def client_useful_link_add(request, client_id):
    """Ajouter un lien utile à un client"""
    client = get_object_or_404(Client, id=client_id)
    useful_link_id = request.data.get('usefulLinkId')
    
    if not useful_link_id:
        return Response({'error': 'usefulLinkId is required'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        useful_link = UsefulLink.objects.get(id=useful_link_id)
        
        # Check if client already has this useful link
        if ClientUsefulLink.objects.filter(client=client, useful_link=useful_link).exists():
            return Response({'error': 'Client already has this useful link'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Generate ClientUsefulLink ID
        client_useful_link_id = uuid.uuid4().hex[:12]
        while ClientUsefulLink.objects.filter(id=client_useful_link_id).exists():
            client_useful_link_id = uuid.uuid4().hex[:12]
        
        # Create ClientUsefulLink relationship
        client_useful_link = ClientUsefulLink.objects.create(
            id=client_useful_link_id,
            client=client,
            useful_link=useful_link
        )
        
        serializer = ClientUsefulLinkSerializer(client_useful_link, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    except UsefulLink.DoesNotExist:
        return Response({'error': 'Useful link not found'}, status=status.HTTP_404_NOT_FOUND)

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def client_useful_link_remove(request, client_id, useful_link_id):
    """Retirer un lien utile d'un client"""
    client = get_object_or_404(Client, id=client_id)
    useful_link = get_object_or_404(UsefulLink, id=useful_link_id)
    
    try:
        client_useful_link = ClientUsefulLink.objects.get(client=client, useful_link=useful_link)
        client_useful_link.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    except ClientUsefulLink.DoesNotExist:
        return Response({'error': 'Client useful link relationship not found'}, status=status.HTTP_404_NOT_FOUND)

# Transaction endpoints
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def client_transactions(request, client_id):
    """Liste les transactions d'un client"""
    client = get_object_or_404(Client, id=client_id)
    transactions = Transaction.objects.filter(client=client).order_by('-datetime', '-created_at')
    serializer = TransactionSerializer(transactions, many=True)
    return Response({'transactions': serializer.data})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def client_transaction_create(request, client_id):
    """Créer une transaction pour un client"""
    client = get_object_or_404(Client, id=client_id)
    
    # Validate required fields
    if not request.data.get('type'):
        return Response({'error': 'Le type de transaction est requis'}, status=status.HTTP_400_BAD_REQUEST)
    if not request.data.get('amount'):
        return Response({'error': 'Le montant est requis'}, status=status.HTTP_400_BAD_REQUEST)
    if not request.data.get('datetime'):
        return Response({'error': 'La date et heure sont requises'}, status=status.HTTP_400_BAD_REQUEST)
    
    # Generate transaction ID
    transaction_id = uuid.uuid4().hex[:12]
    while Transaction.objects.filter(id=transaction_id).exists():
        transaction_id = uuid.uuid4().hex[:12]
    
    # Parse datetime
    from django.utils.dateparse import parse_datetime
    datetime_str = request.data.get('datetime')
    transaction_datetime = parse_datetime(datetime_str)
    if not transaction_datetime:
        return Response({'error': 'Format de date invalide'}, status=status.HTTP_400_BAD_REQUEST)
    
    # Create transaction
    transaction = Transaction.objects.create(
        id=transaction_id,
        client=client,
        type=request.data.get('type'),
        amount=request.data.get('amount'),
        description=request.data.get('description', ''),
        status=request.data.get('status', 'en_cours'),
        datetime=transaction_datetime
    )
    
    serializer = TransactionSerializer(transaction)
    return Response(serializer.data, status=status.HTTP_201_CREATED)

@api_view(['PUT', 'PATCH'])
@permission_classes([IsAuthenticated])
def client_transaction_update(request, client_id, transaction_id):
    """Mettre à jour une transaction"""
    client = get_object_or_404(Client, id=client_id)
    transaction = get_object_or_404(Transaction, id=transaction_id, client=client)
    
    # Update fields
    if 'type' in request.data:
        transaction.type = request.data.get('type')
    if 'amount' in request.data:
        transaction.amount = request.data.get('amount')
    if 'description' in request.data:
        transaction.description = request.data.get('description', '')
    if 'status' in request.data:
        transaction.status = request.data.get('status')
    if 'datetime' in request.data:
        from django.utils.dateparse import parse_datetime
        datetime_str = request.data.get('datetime')
        transaction_datetime = parse_datetime(datetime_str)
        if transaction_datetime:
            transaction.datetime = transaction_datetime
    
    transaction.save()
    serializer = TransactionSerializer(transaction)
    return Response(serializer.data)

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def client_transaction_delete(request, client_id, transaction_id):
    """Supprimer une transaction"""
    client = get_object_or_404(Client, id=client_id)
    transaction = get_object_or_404(Transaction, id=transaction_id, client=client)
    transaction.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)
