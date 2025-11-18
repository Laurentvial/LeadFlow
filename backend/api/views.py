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
from .models import Role, Permission, PermissionRole, Status, Source, Document
from .serializer import (
    UserSerializer, ContactSerializer, NoteSerializer,
    TeamSerializer, TeamDetailSerializer, UserDetailsSerializer, EventSerializer, TeamMemberSerializer,
    RoleSerializer, PermissionSerializer, PermissionRoleSerializer, StatusSerializer, SourceSerializer, LogSerializer, DocumentSerializer
)
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
import uuid
from datetime import datetime, date, timedelta
from django.utils import timezone
from django.db.models import Count, Q, Sum
import boto3
from botocore.exceptions import ClientError
import os
from django.core.files.uploadedfile import InMemoryUploadedFile
from django.conf import settings
from django.http import StreamingHttpResponse, HttpResponse
from io import BytesIO
import csv
import io


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


def serialize_for_json(obj):
    """Convert datetime and date objects to strings for JSON serialization"""
    if isinstance(obj, dict):
        return {key: serialize_for_json(value) for key, value in obj.items()}
    elif isinstance(obj, list):
        return [serialize_for_json(item) for item in obj]
    elif isinstance(obj, (datetime, date)):
        return obj.isoformat()
    else:
        return obj

def clean_contact_data_for_log(contact_data, include_created_at=False):
    """Clean contact data for log storage - keep only relevant fields for users
    Always includes all fields even if empty to maintain consistent structure
    """
    if not isinstance(contact_data, dict):
        return contact_data
    
    # Fields to keep in specific order (only camelCase, user-friendly fields)
    # Excluded: teleoperatorId, statusColor, fullName, sourceId, statusId
    # Using statusName instead of statusId
    field_order = [
        'firstName',
        'lastName',
        'mobile',
        'source',  # Show source name instead of sourceId
        'statusName',  # Show status name instead of statusId
        'teleoperatorName',
        'creatorName',
        'confirmateurName',
        'civility',
        'email',
        'phone',
        'birthDate',
        'birthPlace',
        'nationality',
        'address',
        'addressComplement',
        'postalCode',
        'city',
        'campaign',
    ]
    
    # Add createdAt only if requested (for old_value, not for new_value)
    if include_created_at:
        field_order.append('createdAt')
    
    cleaned_data = {}
    for field in field_order:
        # Always include field, even if empty, to maintain full structure
        if field in contact_data:
            value = contact_data[field]
            # Convert None to empty string for consistency
            cleaned_data[field] = value if value is not None else ''
        else:
            # Field not present in data, set to empty string
            cleaned_data[field] = ''
    
    return cleaned_data

def create_log_entry(event_type, user_id, request, old_value=None, new_value=None, contact_id=None, creator_id=None):
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
    
    # Serialize old_value and new_value to handle datetime objects
    serialized_old_value = serialize_for_json(old_value) if old_value else {}
    serialized_new_value = serialize_for_json(new_value) if new_value else {}
    
    # Create log entry
    Log.objects.create(
        id=log_id,
        event_type=event_type,
        user_id=user_id if user_id else None,
        contact_id=contact_id if contact_id else None,
        creator_id=creator_id if creator_id else None,
        details=details,
        old_value=serialized_old_value,
        new_value=serialized_new_value
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
        # Allow filtering by contactId if provided as query parameter
        contact_id = self.request.query_params.get('contactId', None)
        if contact_id:
            # Return all notes for this contact (all users can see notes for contacts they have access to)
            return Note.objects.filter(contactId=contact_id).select_related('userId').order_by('-created_at')
        # If no contactId, return current user's notes (for backward compatibility)
        user = self.request.user
        return Note.objects.filter(userId=user).select_related('userId').order_by('-created_at')

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
    
    def get_queryset(self):
        """
        Filter contacts based on user's role data_access level:
        - own_only: 
            - If user is teleoperateur: Only contacts where user is teleoperator
            - If user is confirmateur: Only contacts where user is confirmateur
            - Otherwise: Contacts where user is teleoperator, confirmateur, or creator
        - team_only: Contacts where user is assigned OR contacts from users in the same team
        - all: All contacts (no filtering)
        """
        queryset = Contact.objects.all()
        user = self.request.user
        
        # Get user's role and data_access level
        try:
            user_details = UserDetails.objects.get(django_user=user)
            if user_details.role:
                data_access = user_details.role.data_access
                
                if data_access == 'own_only':
                    # Check if user is teleoperateur or confirmateur
                    is_teleoperateur = user_details.role.is_teleoperateur
                    is_confirmateur = user_details.role.is_confirmateur
                    
                    if is_teleoperateur and is_confirmateur:
                        # User is both: show contacts where user is teleoperator OR confirmateur
                        queryset = queryset.filter(
                            models.Q(teleoperator=user) |
                            models.Q(confirmateur=user)
                        )
                    elif is_teleoperateur:
                        # Teleoperateur with own_only: only show contacts where user is teleoperator
                        queryset = queryset.filter(teleoperator=user)
                    elif is_confirmateur:
                        # Confirmateur with own_only: only show contacts where user is confirmateur
                        queryset = queryset.filter(confirmateur=user)
                    else:
                        # Default behavior: show contacts where user is teleoperator, confirmateur, or creator
                        queryset = queryset.filter(
                            models.Q(teleoperator=user) |
                            models.Q(confirmateur=user) |
                            models.Q(creator=user)
                        )
                elif data_access == 'team_only':
                    # Get user's team members
                    team_member = user_details.team_memberships.first()
                    if team_member:
                        team = team_member.team
                        # Get all users in the same team
                        team_user_ids = TeamMember.objects.filter(team=team).values_list('user__django_user__id', flat=True)
                        # Show contacts where:
                        # - User is teleoperator, confirmateur, or creator
                        # - OR contact's teleoperator/confirmateur/creator is in the same team
                        queryset = queryset.filter(
                            models.Q(teleoperator=user) |
                            models.Q(confirmateur=user) |
                            models.Q(creator=user) |
                            models.Q(teleoperator__id__in=team_user_ids) |
                            models.Q(confirmateur__id__in=team_user_ids) |
                            models.Q(creator__id__in=team_user_ids)
                        )
                    else:
                        # User has no team, fall back to own_only behavior
                        queryset = queryset.filter(
                            models.Q(teleoperator=user) |
                            models.Q(confirmateur=user) |
                            models.Q(creator=user)
                        )
                # If data_access is 'all', show all contacts (no filtering)
        except UserDetails.DoesNotExist:
            # If user has no UserDetails, show no contacts (safety default)
            queryset = Contact.objects.none()
        
        return queryset
    
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
    if not request.data.get('mobile'):
        return Response({'error': 'Le portable est requis'}, status=status.HTTP_400_BAD_REQUEST)
    if not request.data.get('statusId'):
        return Response({'error': 'Le statut est requis'}, status=status.HTTP_400_BAD_REQUEST)
    
    # Check if email already exists (if provided)
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
        'address_complement': request.data.get('addressComplement', '') or '',
        'postal_code': request.data.get('postalCode', '') or '',
        'city': request.data.get('city', '') or '',
        'nationality': request.data.get('nationality', '') or '',
        'campaign': request.data.get('campaign', '') or '',
    }
    
    # Set creator to the current user
    contact_data['creator'] = request.user
    
    # Handle status
    status_id = request.data.get('statusId')
    if status_id:
        try:
            status_obj = Status.objects.filter(id=status_id).first()
            if status_obj:
                contact_data['status'] = status_obj
        except Exception:
            pass
    
    # Handle source
    source_id = request.data.get('sourceId')
    if source_id:
        try:
            source_obj = Source.objects.filter(id=source_id).first()
            if source_obj:
                contact_data['source'] = source_obj
        except Exception:
            pass
    
    # Handle teleoperator
    teleoperator_id = request.data.get('teleoperatorId')
    if teleoperator_id:
        try:
            teleoperator_user = DjangoUser.objects.filter(id=teleoperator_id).first()
            if teleoperator_user:
                contact_data['teleoperator'] = teleoperator_user
        except Exception:
            pass
    
    # Handle confirmateur
    confirmateur_id = request.data.get('confirmateurId')
    if confirmateur_id:
        try:
            confirmateur_user = DjangoUser.objects.filter(id=confirmateur_id).first()
            if confirmateur_user:
                contact_data['confirmateur'] = confirmateur_user
        except Exception:
            pass
    
    try:
        contact = Contact.objects.create(**contact_data)
        
        # Create log entry for contact creation
        serializer = ContactSerializer(contact, context={'request': request})
        contact_data_raw = serializer.data
        contact_data_for_log = clean_contact_data_for_log(contact_data_raw, include_created_at=False)
        
        create_log_entry(
            event_type='addContact',
            user_id=request.user if request.user.is_authenticated else None,
            request=request,
            old_value={},  # No old value for creation
            new_value=contact_data_for_log,
            contact_id=contact,
            creator_id=request.user if request.user.is_authenticated else None
        )
        
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Error creating contact: {error_details}")
        return Response({'error': str(e), 'details': error_details}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def csv_import_preview(request):
    """Preview CSV file and return headers and sample rows"""
    if 'file' not in request.FILES:
        return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)
    
    csv_file = request.FILES['file']
    
    # Check file extension
    if not csv_file.name.endswith('.csv'):
        return Response({'error': 'File must be a CSV file'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        # Read CSV file - accept any CSV format
        file_content = csv_file.read().decode('utf-8-sig')  # Handle BOM
        csv_reader = csv.DictReader(io.StringIO(file_content))
        
        # Get headers - accept any header names
        headers = csv_reader.fieldnames or []
        
        # Clean headers (remove whitespace, handle empty headers)
        cleaned_headers = []
        for i, header in enumerate(headers):
            if header and header.strip():
                cleaned_headers.append(header.strip())
            else:
                # If header is empty, create a placeholder
                cleaned_headers.append(f'Colonne_{i+1}')
        
        # Get first 5 rows as preview
        preview_rows = []
        csv_reader_preview = csv.DictReader(io.StringIO(file_content))
        for i, row in enumerate(csv_reader_preview):
            if i >= 5:
                break
            preview_rows.append(row)
        
        # Count total rows (excluding header)
        file_content_for_count = io.StringIO(file_content)
        total_rows = sum(1 for _ in csv.DictReader(file_content_for_count))
        
        return Response({
            'headers': cleaned_headers if cleaned_headers else headers,
            'preview': preview_rows,
            'totalRows': total_rows
        }, status=status.HTTP_200_OK)
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        return Response({'error': str(e), 'details': error_details}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def csv_import_contacts(request):
    """Import contacts from CSV with column mapping"""
    if 'file' not in request.FILES:
        return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)
    
    csv_file = request.FILES['file']
    
    # Parse column mapping JSON string if it's a string
    column_mapping_str = request.data.get('columnMapping', '{}')
    if isinstance(column_mapping_str, str):
        import json
        try:
            column_mapping = json.loads(column_mapping_str)
        except json.JSONDecodeError:
            column_mapping = {}
    else:
        column_mapping = column_mapping_str or {}
    
    default_status_id = request.data.get('defaultStatusId')
    default_source_id = request.data.get('defaultSourceId')
    default_teleoperator_id = request.data.get('defaultTeleoperatorId')
    
    # Validate required mappings - only firstName is required
    required_fields = ['firstName']
    missing_fields = [field for field in required_fields if field not in column_mapping or not column_mapping[field]]
    if missing_fields:
        return Response({
            'error': f'Missing required column mappings: {", ".join(missing_fields)}'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    if not default_status_id:
        return Response({'error': 'Default status is required'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        # Read CSV file
        file_content = csv_file.read().decode('utf-8-sig')  # Handle BOM
        csv_reader = csv.DictReader(io.StringIO(file_content))
        
        # Get status and source objects
        status_obj = Status.objects.filter(id=default_status_id).first()
        if not status_obj:
            return Response({'error': 'Invalid status ID'}, status=status.HTTP_400_BAD_REQUEST)
        
        source_obj = None
        if default_source_id:
            source_obj = Source.objects.filter(id=default_source_id).first()
        
        teleoperator_obj = None
        if default_teleoperator_id:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            teleoperator_obj = User.objects.filter(id=default_teleoperator_id).first()
        
        # Field mapping from frontend names to model field names
        field_mapping = {
            'civility': 'civility',
            'firstName': 'fname',
            'lastName': 'lname',
            'phone': 'phone',
            'mobile': 'mobile',
            'email': 'email',
            'birthDate': 'birth_date',
            'birthPlace': 'birth_place',
            'address': 'address',
            'addressComplement': 'address_complement',
            'postalCode': 'postal_code',
            'city': 'city',
            'nationality': 'nationality',
            'campaign': 'campaign',
        }
        
        results = {
            'success': [],
            'errors': [],
            'total': 0,
            'imported': 0,
            'failed': 0
        }
        
        # Helper function to parse date
        def parse_date(date_str):
            if not date_str or date_str.strip() == '':
                return None
            date_str = date_str.strip()
            # Try common date formats
            formats = ['%Y-%m-%d', '%d/%m/%Y', '%m/%d/%Y', '%d-%m-%Y', '%Y/%m/%d']
            for fmt in formats:
                try:
                    return datetime.strptime(date_str, fmt).date()
                except ValueError:
                    continue
            return None
        
        # Process each row
        for row_num, row in enumerate(csv_reader, start=2):  # Start at 2 (row 1 is header)
            results['total'] += 1
            try:
                # Build contact data from CSV row
                contact_data = {}
                
                # Map CSV columns to contact fields
                # Accept any column name from the CSV - no restrictions on header names
                for frontend_field, csv_column in column_mapping.items():
                    if not csv_column:
                        continue
                    
                    # Try exact match first, then case-insensitive, then trimmed match
                    csv_value = None
                    if csv_column in row:
                        csv_value = row[csv_column]
                    else:
                        # Try case-insensitive match
                        for key in row.keys():
                            if key and key.strip().lower() == csv_column.strip().lower():
                                csv_value = row[key]
                                break
                    
                    if csv_value is None:
                        continue
                    
                    value = csv_value.strip() if csv_value else ''
                    
                    # Map to model field name
                    if frontend_field in field_mapping:
                        model_field = field_mapping[frontend_field]
                        
                        # Handle date field
                        if model_field == 'birth_date':
                            contact_data[model_field] = parse_date(value)
                        else:
                            contact_data[model_field] = value
                
                # Validate required fields - only firstName is required
                if not contact_data.get('fname'):
                    results['errors'].append({
                        'row': row_num,
                        'error': 'First name is required'
                    })
                    results['failed'] += 1
                    continue
                
                # Check if email already exists (if provided)
                email = contact_data.get('email', '').strip()
                if email and Contact.objects.filter(email=email).exists():
                    results['errors'].append({
                        'row': row_num,
                        'error': f'Email {email} already exists',
                        'data': {'firstName': contact_data.get('fname'), 'lastName': contact_data.get('lname')}
                    })
                    results['failed'] += 1
                    continue
                
                # Generate contact ID
                contact_id = uuid.uuid4().hex[:12]
                while Contact.objects.filter(id=contact_id).exists():
                    contact_id = uuid.uuid4().hex[:12]
                
                contact_data['id'] = contact_id
                contact_data['creator'] = request.user
                contact_data['status'] = status_obj
                if source_obj:
                    contact_data['source'] = source_obj
                if teleoperator_obj:
                    contact_data['teleoperator'] = teleoperator_obj
                
                # Create contact
                contact = Contact.objects.create(**contact_data)
                
                # Create log entry
                serializer = ContactSerializer(contact, context={'request': request})
                contact_data_raw = serializer.data
                contact_data_for_log = clean_contact_data_for_log(contact_data_raw, include_created_at=False)
                
                create_log_entry(
                    event_type='addContact',
                    user_id=request.user if request.user.is_authenticated else None,
                    request=request,
                    old_value={},
                    new_value=contact_data_for_log,
                    contact_id=contact,
                    creator_id=request.user if request.user.is_authenticated else None
                )
                
                # Build name for display (only firstName is required)
                contact_name = contact_data.get('fname', '')
                if contact_data.get('lname'):
                    contact_name = f"{contact_data.get('fname')} {contact_data.get('lname')}"
                
                results['success'].append({
                    'row': row_num,
                    'contactId': contact.id,
                    'name': contact_name
                })
                results['imported'] += 1
                
            except Exception as e:
                import traceback
                error_details = traceback.format_exc()
                results['errors'].append({
                    'row': row_num,
                    'error': str(e),
                    'details': error_details
                })
                results['failed'] += 1
        
        return Response(results, status=status.HTTP_200_OK)
        
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        return Response({'error': str(e), 'details': error_details}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def contact_detail(request, contact_id):
    """
    Get or update a contact, respecting data_access restrictions.
    Users with own_only:
        - If teleoperateur: Can only access contacts where they are teleoperator
        - If confirmateur: Can only access contacts where they are confirmateur
        - Otherwise: Can access contacts where they are teleoperator, confirmateur, or creator
    Users with team_only can access contacts from their team.
    Users with all can access any contact.
    """
    contact = get_object_or_404(Contact, id=contact_id)
    user = request.user
    
    # Check data access restrictions
    try:
        user_details = UserDetails.objects.get(django_user=user)
        if user_details.role:
            data_access = user_details.role.data_access
            
            if data_access == 'own_only':
                # Check if user is teleoperateur or confirmateur
                is_teleoperateur = user_details.role.is_teleoperateur
                is_confirmateur = user_details.role.is_confirmateur
                
                if is_teleoperateur and is_confirmateur:
                    # User is both: allow if user is teleoperator OR confirmateur
                    if contact.teleoperator != user and contact.confirmateur != user:
                        return Response(
                            {'error': 'Vous n\'avez pas accès à ce contact'},
                            status=status.HTTP_403_FORBIDDEN
                        )
                elif is_teleoperateur:
                    # Teleoperateur with own_only: only allow if user is teleoperator
                    if contact.teleoperator != user:
                        return Response(
                            {'error': 'Vous n\'avez pas accès à ce contact'},
                            status=status.HTTP_403_FORBIDDEN
                        )
                elif is_confirmateur:
                    # Confirmateur with own_only: only allow if user is confirmateur
                    if contact.confirmateur != user:
                        return Response(
                            {'error': 'Vous n\'avez pas accès à ce contact'},
                            status=status.HTTP_403_FORBIDDEN
                        )
                else:
                    # Default behavior: only allow if user is teleoperator, confirmateur, or creator
                    if contact.teleoperator != user and contact.confirmateur != user and contact.creator != user:
                        return Response(
                            {'error': 'Vous n\'avez pas accès à ce contact'},
                            status=status.HTTP_403_FORBIDDEN
                        )
            elif data_access == 'team_only':
                # Check if user has access (either assigned to them or from their team)
                team_member = user_details.team_memberships.first()
                if team_member:
                    team = team_member.team
                    team_user_ids = TeamMember.objects.filter(team=team).values_list('user__django_user__id', flat=True)
                    # Allow if user is assigned OR if contact's assignees are in the same team
                    if (contact.teleoperator != user and contact.confirmateur != user and contact.creator != user and
                        (not contact.teleoperator or contact.teleoperator.id not in team_user_ids) and
                        (not contact.confirmateur or contact.confirmateur.id not in team_user_ids) and
                        (not contact.creator or contact.creator.id not in team_user_ids)):
                        return Response(
                            {'error': 'Vous n\'avez pas accès à ce contact'},
                            status=status.HTTP_403_FORBIDDEN
                        )
                else:
                    # User has no team, fall back to own_only behavior
                    if contact.teleoperator != user and contact.confirmateur != user and contact.creator != user:
                        return Response(
                            {'error': 'Vous n\'avez pas accès à ce contact'},
                            status=status.HTTP_403_FORBIDDEN
                        )
            # If data_access is 'all', allow access (no check needed)
    except UserDetails.DoesNotExist:
        # If user has no UserDetails, deny access (safety default)
        return Response(
            {'error': 'Vous n\'avez pas accès à ce contact'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    if request.method == 'GET':
        serializer = ContactSerializer(contact, context={'request': request})
        return Response({'contact': serializer.data})
    
    if request.method == 'PATCH':
        # Get old value BEFORE any modifications
        old_serializer = ContactSerializer(contact, context={'request': request})
        old_value_raw = old_serializer.data
        old_value = clean_contact_data_for_log(old_value_raw, include_created_at=False)
        
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
        
        # Update status if provided
        if 'statusId' in request.data:
            status_id = request.data.get('statusId')
            if status_id:
                try:
                    status_obj = Status.objects.filter(id=status_id).first()
                    if status_obj:
                        contact.status = status_obj
                except Exception:
                    pass
            else:
                contact.status = None
        
        # Update source if provided
        if 'sourceId' in request.data:
            source_id = request.data.get('sourceId')
            if source_id:
                try:
                    source_obj = Source.objects.filter(id=source_id).first()
                    if source_obj:
                        contact.source = source_obj
                except Exception:
                    pass
            else:
                contact.source = None
        
        # Update teleoperator if provided
        if 'teleoperatorId' in request.data:
            teleoperator_id = request.data.get('teleoperatorId')
            if teleoperator_id:
                try:
                    teleoperator_user = DjangoUser.objects.filter(id=teleoperator_id).first()
                    if teleoperator_user:
                        contact.teleoperator = teleoperator_user
                except Exception:
                    pass
            else:
                contact.teleoperator = None
        
        # Update confirmateur if provided
        if 'confirmateurId' in request.data:
            confirmateur_id = request.data.get('confirmateurId')
            if confirmateur_id:
                try:
                    confirmateur_user = DjangoUser.objects.filter(id=confirmateur_id).first()
                    if confirmateur_user:
                        contact.confirmateur = confirmateur_user
                except Exception:
                    pass
            else:
                contact.confirmateur = None
        
        # Update campaign if provided
        if 'campaign' in request.data:
            contact.campaign = request.data.get('campaign', '') or ''
        
        # Update addressComplement if provided
        if 'addressComplement' in request.data:
            contact.address_complement = request.data.get('addressComplement', '') or ''
        
        # Save the contact with all modifications
        contact.save()
        
        # Get new value after saving
        serializer = ContactSerializer(contact, context={'request': request})
        new_value_raw = serializer.data
        new_value = clean_contact_data_for_log(new_value_raw, include_created_at=False)
        
        # Create log entry for contact update
        create_log_entry(
            event_type='editContact',
            user_id=request.user if request.user.is_authenticated else None,
            request=request,
            old_value=old_value,
            new_value=new_value,
            contact_id=contact,
            creator_id=request.user if request.user.is_authenticated else None
        )
        
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
    try:
        user_details = get_object_or_404(UserDetails, id=user_id)
        django_user = user_details.django_user
        
        if not django_user:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Debug: Log received data
        print(f"Reset password request for user {user_id}")
        print(f"Request data: {request.data}")
        print(f"Request data type: {type(request.data)}")
        
        # Get new password from request, or use default
        new_password = request.data.get('password')
        
        # If password is not provided, use default
        if not new_password:
            new_password = 'Access@123'
        
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
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Error resetting password: {error_details}")
        return Response({'error': f'Failed to reset password: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

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
    user = request.user
    
    # Allow filtering by contactId if provided as query parameter
    contact_id = request.query_params.get('contactId', None)
    if contact_id:
        # Return all events for this contact (all users can see events for contacts they have access to)
        events = Event.objects.filter(contactId=contact_id).select_related('userId', 'contactId').order_by('datetime')
    else:
        # Filter events based on user's role data_access level
        # Events are filtered based on the contacts the user can access
        try:
            user_details = UserDetails.objects.get(django_user=user)
            if user_details.role:
                data_access = user_details.role.data_access
                
                if data_access == 'all':
                    # User has access to all contacts, so show all events (including events without contacts)
                    events = Event.objects.all().select_related('userId', 'contactId').order_by('datetime')
                elif data_access == 'team_only':
                    # Get user's team members
                    team_member = user_details.team_memberships.first()
                    if team_member:
                        team = team_member.team
                        # Get all users in the same team
                        team_user_ids = TeamMember.objects.filter(team=team).values_list('user__django_user__id', flat=True)
                        # Get contacts accessible to the user or their team
                        accessible_contact_ids = Contact.objects.filter(
                            models.Q(teleoperator=user) |
                            models.Q(confirmateur=user) |
                            models.Q(creator=user) |
                            models.Q(teleoperator__id__in=team_user_ids) |
                            models.Q(confirmateur__id__in=team_user_ids) |
                            models.Q(creator__id__in=team_user_ids)
                        ).values_list('id', flat=True)
                        # Return events for accessible contacts OR events created by team members (even without contactId)
                        events = Event.objects.filter(
                            models.Q(contactId__id__in=accessible_contact_ids) |
                            models.Q(contactId__isnull=True, userId__id__in=team_user_ids)
                        ).select_related('userId', 'contactId').order_by('datetime')
                    else:
                        # User has no team, fall back to own_only behavior
                        is_teleoperateur = user_details.role.is_teleoperateur
                        is_confirmateur = user_details.role.is_confirmateur
                        
                        if is_teleoperateur and is_confirmateur:
                            accessible_contact_ids = Contact.objects.filter(
                                models.Q(teleoperator=user) |
                                models.Q(confirmateur=user)
                            ).values_list('id', flat=True)
                        elif is_teleoperateur:
                            accessible_contact_ids = Contact.objects.filter(teleoperator=user).values_list('id', flat=True)
                        elif is_confirmateur:
                            accessible_contact_ids = Contact.objects.filter(confirmateur=user).values_list('id', flat=True)
                        else:
                            accessible_contact_ids = Contact.objects.filter(
                                models.Q(teleoperator=user) |
                                models.Q(confirmateur=user) |
                                models.Q(creator=user)
                            ).values_list('id', flat=True)
                        # Return events for accessible contacts OR events created by user (even without contactId)
                        events = Event.objects.filter(
                            models.Q(contactId__id__in=accessible_contact_ids) |
                            models.Q(contactId__isnull=True, userId=user)
                        ).select_related('userId', 'contactId').order_by('datetime')
                else:  # own_only
                    # Check if user is teleoperateur or confirmateur
                    is_teleoperateur = user_details.role.is_teleoperateur
                    is_confirmateur = user_details.role.is_confirmateur
                    
                    if is_teleoperateur and is_confirmateur:
                        # User is both: show events for contacts where user is teleoperator OR confirmateur
                        accessible_contact_ids = Contact.objects.filter(
                            models.Q(teleoperator=user) |
                            models.Q(confirmateur=user)
                        ).values_list('id', flat=True)
                    elif is_teleoperateur:
                        # Teleoperateur with own_only: only show events for contacts where user is teleoperator
                        accessible_contact_ids = Contact.objects.filter(teleoperator=user).values_list('id', flat=True)
                    elif is_confirmateur:
                        # Confirmateur with own_only: only show events for contacts where user is confirmateur
                        accessible_contact_ids = Contact.objects.filter(confirmateur=user).values_list('id', flat=True)
                    else:
                        # Default behavior: show events for contacts where user is teleoperator, confirmateur, or creator
                        accessible_contact_ids = Contact.objects.filter(
                            models.Q(teleoperator=user) |
                            models.Q(confirmateur=user) |
                            models.Q(creator=user)
                        ).values_list('id', flat=True)
                    # Return events for accessible contacts OR events created by user (even without contactId)
                    events = Event.objects.filter(
                        models.Q(contactId__id__in=accessible_contact_ids) |
                        models.Q(contactId__isnull=True, userId=user)
                    ).select_related('userId', 'contactId').order_by('datetime')
            else:
                # User has no role, show no events (safety default)
                events = Event.objects.none()
        except UserDetails.DoesNotExist:
            # If user has no UserDetails, show no events (safety default)
            events = Event.objects.none()
    
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
        
        # Get user if userId provided, otherwise use current user
        user = request.user
        user_id = request.data.get('userId')
        if user_id:
            try:
                user = DjangoUser.objects.get(id=user_id)
            except DjangoUser.DoesNotExist:
                pass  # Use current user as fallback
        
        event = serializer.save(
            id=event_id,
            userId=user,
            contactId=contact
        )
        return Response(EventSerializer(event).data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def event_update(request, event_id):
    # Allow updating if user owns the event OR if event is linked to a contact (for contact management)
    try:
        event = Event.objects.get(id=event_id)
        # Check if user owns the event OR if event has a contact (allows contact-related edits)
        if event.userId != request.user and not event.contactId:
            return Response({'detail': 'You do not have permission to update this event.'}, status=status.HTTP_403_FORBIDDEN)
    except Event.DoesNotExist:
        return Response({'detail': 'Event not found.'}, status=status.HTTP_404_NOT_FOUND)
    
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
        
        # Get user if userId provided, otherwise keep existing user
        user = event.userId
        user_id = request.data.get('userId')
        if user_id:
            try:
                user = DjangoUser.objects.get(id=user_id)
            except DjangoUser.DoesNotExist:
                pass  # Keep existing user as fallback
        
        # Update event with new data
        event = serializer.save(contactId=contact, userId=user)
        return Response(EventSerializer(event).data, status=status.HTTP_200_OK)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def event_delete(request, event_id):
    # Allow deleting if user owns the event OR if event is linked to a contact (for contact management)
    try:
        event = Event.objects.get(id=event_id)
        # Check if user owns the event OR if event has a contact (allows contact-related deletes)
        if event.userId != request.user and not event.contactId:
            return Response({'detail': 'You do not have permission to delete this event.'}, status=status.HTTP_403_FORBIDDEN)
    except Event.DoesNotExist:
        return Response({'detail': 'Event not found.'}, status=status.HTTP_404_NOT_FOUND)
    
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
    # Normalize the data - ensure type has a default value if not provided
    data = request.data.copy()
    if 'type' not in data or not data['type']:
        data['type'] = 'lead'
    
    # Ensure color is an empty string if not provided or None
    if 'color' not in data or data['color'] is None:
        data['color'] = ''
    
    serializer = StatusSerializer(data=data)
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
    
    # Log validation errors for debugging
    import logging
    logger = logging.getLogger(__name__)
    logger.error(f"Status creation validation failed: {serializer.errors}, data: {request.data}")
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

# Sources endpoints
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def source_list(request):
    """List all sources"""
    sources = Source.objects.all().order_by('name')
    serializer = SourceSerializer(sources, many=True)
    return Response({'sources': serializer.data})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def source_create(request):
    """Create a new source"""
    source_id = uuid.uuid4().hex[:12]
    while Source.objects.filter(id=source_id).exists():
        source_id = uuid.uuid4().hex[:12]
    
    # Get name from request data
    name = request.data.get('name', '').strip()
    if not name:
        return Response({'error': 'Le nom de la source est requis'}, status=status.HTTP_400_BAD_REQUEST)
    
    # Check if source with same name already exists
    if Source.objects.filter(name=name).exists():
        return Response({'error': 'Une source avec ce nom existe déjà'}, status=status.HTTP_400_BAD_REQUEST)
    
    # Create source directly (bypass serializer for creation to avoid issues)
    try:
        source = Source.objects.create(id=source_id, name=name)
        serializer = SourceSerializer(source)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Error creating source: {error_details}")
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def source_update(request, source_id):
    """Update a source"""
    source_obj = get_object_or_404(Source, id=source_id)
    serializer = SourceSerializer(source_obj, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(SourceSerializer(source_obj).data, status=status.HTTP_200_OK)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def source_delete(request, source_id):
    """Delete a source"""
    source_obj = get_object_or_404(Source, id=source_id)
    source_obj.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def contact_logs(request, contact_id):
    """Get all logs related to a contact"""
    try:
        # Verify contact exists
        contact = get_object_or_404(Contact, id=contact_id)
        
        # Get all logs for this contact
        logs = Log.objects.filter(contact_id=contact).order_by('-created_at')
        
        serializer = LogSerializer(logs, many=True)
        return Response({'logs': serializer.data}, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def contact_documents(request, contact_id):
    """Get all documents for a contact"""
    try:
        contact = get_object_or_404(Contact, id=contact_id)
        documents = Document.objects.filter(contact_id=contact).order_by('document_type')
        serializer = DocumentSerializer(documents, many=True)
        return Response({'documents': serializer.data}, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def document_upload(request):
    """Upload a file to Impossible Cloud and return the URL"""
    try:
        if 'file' not in request.FILES:
            return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)
        
        file = request.FILES['file']
        contact_id = request.data.get('contactId')
        document_type = request.data.get('documentType')
        
        if not contact_id or not document_type:
            return Response({'error': 'contactId and documentType are required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Configure S3 client for Impossible Cloud
        s3_client = boto3.client(
            's3',
            endpoint_url=os.getenv('IMPOSSIBLE_CLOUD_ENDPOINT', 'https://eu-central-2.storage.impossibleapi.net'),
            aws_access_key_id=os.getenv('IMPOSSIBLE_CLOUD_ACCESS_KEY'),
            aws_secret_access_key=os.getenv('IMPOSSIBLE_CLOUD_SECRET_KEY'),
            region_name=os.getenv('IMPOSSIBLE_CLOUD_REGION', 'eu-central-2')
        )
        
        bucket_name = os.getenv('IMPOSSIBLE_CLOUD_BUCKET', 'leadflow-documents')
        
        # Generate unique file path
        file_extension = os.path.splitext(file.name)[1]
        file_path = f"contacts/{contact_id}/{document_type}/{uuid.uuid4().hex[:12]}{file_extension}"
        
        # Upload file to Impossible Cloud
        file.seek(0)  # Reset file pointer
        s3_client.upload_fileobj(
            file,
            bucket_name,
            file_path,
            ExtraArgs={'ContentType': file.content_type}
        )
        
        # Generate public URL (using the endpoint URL format)
        endpoint = os.getenv('IMPOSSIBLE_CLOUD_ENDPOINT', 'https://eu-central-2.storage.impossibleapi.net')
        # Remove trailing slash if present
        endpoint = endpoint.rstrip('/')
        file_url = f"{endpoint}/{bucket_name}/{file_path}"
        
        return Response({
            'fileUrl': file_url,
            'fileName': file.name,
            'filePath': file_path
        }, status=status.HTTP_200_OK)
        
    except ClientError as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Error uploading to Impossible Cloud: {error_details}")
        return Response({'error': f'Failed to upload file: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Error uploading document: {error_details}")
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def document_create(request):
    """Create or update a document for a contact"""
    try:
        contact_id = request.data.get('contactId')
        document_type = request.data.get('documentType')
        file_url = request.data.get('fileUrl', '')
        file_name = request.data.get('fileName', '')
        
        if not contact_id or not document_type:
            return Response({'error': 'contactId and documentType are required'}, status=status.HTTP_400_BAD_REQUEST)
        
        contact = get_object_or_404(Contact, id=contact_id)
        
        # Check if document already exists
        document, created = Document.objects.get_or_create(
            contact_id=contact,
            document_type=document_type,
            defaults={
                'id': uuid.uuid4().hex[:12],
                'has_document': bool(file_url),
                'file_url': file_url,
                'file_name': file_name,
                'uploaded_by': request.user if request.user.is_authenticated else None
            }
        )
        
        if not created:
            # Update existing document
            document.has_document = bool(file_url)
            document.file_url = file_url
            document.file_name = file_name
            document.uploaded_by = request.user if request.user.is_authenticated else None
            document.save()
        
        serializer = DocumentSerializer(document)
        return Response(serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Error creating/updating document: {error_details}")
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def document_update(request, document_id):
    """Update a document"""
    try:
        document = get_object_or_404(Document, id=document_id)
        
        if 'hasDocument' in request.data:
            document.has_document = request.data.get('hasDocument', False)
        if 'fileUrl' in request.data:
            document.file_url = request.data.get('fileUrl', '')
        if 'fileName' in request.data:
            document.file_name = request.data.get('fileName', '')
        
        document.uploaded_by = request.user if request.user.is_authenticated else None
        document.save()
        
        serializer = DocumentSerializer(document)
        return Response(serializer.data, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def document_delete(request, document_id):
    """Delete a document"""
    try:
        document = get_object_or_404(Document, id=document_id)
        document.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

def _get_s3_client_and_path(document):
    """Helper function to get S3 client and file path from document"""
    if not document.file_url:
        return None, None, None
    
    file_url = document.file_url
    endpoint = os.getenv('IMPOSSIBLE_CLOUD_ENDPOINT', 'https://eu-central-2.storage.impossibleapi.net').rstrip('/')
    
    if file_url.startswith(endpoint):
        path_part = file_url[len(endpoint):].lstrip('/')
        parts = path_part.split('/', 1)
        if len(parts) == 2:
            bucket_name = parts[0]
            file_path = parts[1]
            
            s3_client = boto3.client(
                's3',
                endpoint_url=endpoint,
                aws_access_key_id=os.getenv('IMPOSSIBLE_CLOUD_ACCESS_KEY'),
                aws_secret_access_key=os.getenv('IMPOSSIBLE_CLOUD_SECRET_KEY'),
                region_name=os.getenv('IMPOSSIBLE_CLOUD_REGION', 'eu-central-2')
            )
            return s3_client, bucket_name, file_path
    
    return None, None, None

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def document_download(request, document_id):
    """Proxy file download from Impossible Cloud"""
    try:
        document = get_object_or_404(Document, id=document_id)
        
        s3_client, bucket_name, file_path = _get_s3_client_and_path(document)
        if not s3_client:
            return Response({'error': 'Invalid file URL format'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Get the object from S3
        s3_object = s3_client.get_object(Bucket=bucket_name, Key=file_path)
        
        # Create a streaming response directly from S3
        def file_iterator():
            chunk_size = 8192
            while True:
                chunk = s3_object['Body'].read(chunk_size)
                if not chunk:
                    break
                yield chunk
        
        # Create streaming response
        response = StreamingHttpResponse(
            file_iterator(),
            content_type=s3_object.get('ContentType', 'application/octet-stream')
        )
        
        # Set the filename for download
        file_name = document.file_name or 'document'
        response['Content-Disposition'] = f'attachment; filename="{file_name}"'
        if 'ContentLength' in s3_object:
            response['Content-Length'] = str(s3_object['ContentLength'])
        
        return response
        
    except ClientError as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Error downloading from S3: {error_details}")
        return Response({'error': f'Failed to download file: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Error downloading document: {error_details}")
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def document_view_url(request, document_id):
    """Generate a presigned URL for viewing a document"""
    try:
        document = get_object_or_404(Document, id=document_id)
        
        s3_client, bucket_name, file_path = _get_s3_client_and_path(document)
        if not s3_client:
            return Response({'error': 'Invalid file URL format'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Generate presigned URL (valid for 1 hour)
        presigned_url = s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': bucket_name, 'Key': file_path},
            ExpiresIn=3600
        )
        
        return Response({
            'viewUrl': presigned_url,
            'fileName': document.file_name
        }, status=status.HTTP_200_OK)
        
    except ClientError as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Error generating presigned URL: {error_details}")
        return Response({'error': f'Failed to generate view URL: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Error getting view URL: {error_details}")
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

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

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_stats(request):
    """Get dashboard statistics"""
    try:
        # Get filter parameters
        date_from = request.GET.get('dateFrom')
        date_to = request.GET.get('dateTo')
        team_id = request.GET.get('teamId')
        
        # Base querysets
        contacts_qs = Contact.objects.all()
        notes_qs = Note.objects.all()
        events_qs = Event.objects.all()
        users_qs = UserDetails.objects.filter(active=True)
        
        # Apply date filters
        if date_from:
            try:
                date_from_obj = datetime.strptime(date_from, '%Y-%m-%d').date()
                contacts_qs = contacts_qs.filter(created_at__date__gte=date_from_obj)
                notes_qs = notes_qs.filter(created_at__date__gte=date_from_obj)
                events_qs = events_qs.filter(created_at__date__gte=date_from_obj)
            except ValueError:
                pass
        
        if date_to:
            try:
                date_to_obj = datetime.strptime(date_to, '%Y-%m-%d').date()
                contacts_qs = contacts_qs.filter(created_at__date__lte=date_to_obj)
                notes_qs = notes_qs.filter(created_at__date__lte=date_to_obj)
                events_qs = events_qs.filter(created_at__date__lte=date_to_obj)
            except ValueError:
                pass
        
        # Apply team filter
        if team_id and team_id != 'all':
            try:
                team = Team.objects.get(id=team_id)
                team_members = TeamMember.objects.filter(team=team).values_list('user__django_user', flat=True)
                contacts_qs = contacts_qs.filter(
                    Q(creator__in=team_members) | 
                    Q(teleoperator__in=team_members) | 
                    Q(confirmateur__in=team_members)
                )
                notes_qs = notes_qs.filter(userId__in=team_members)
                events_qs = events_qs.filter(userId__in=team_members)
            except Team.DoesNotExist:
                pass
        
        # Calculate statistics
        now = timezone.now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        week_start = today_start - timedelta(days=today_start.weekday())
        month_start = today_start.replace(day=1)
        
        # Total counts
        total_contacts = contacts_qs.count()
        total_notes = notes_qs.count()
        total_events = events_qs.count()
        total_users = users_qs.count()
        
        # Contacts by status type
        contacts_by_status_type = contacts_qs.values('status__type').annotate(count=Count('id'))
        leads_count = sum(item['count'] for item in contacts_by_status_type if item['status__type'] == 'lead')
        contacts_count = sum(item['count'] for item in contacts_by_status_type if item['status__type'] == 'contact')
        clients_count = sum(item['count'] for item in contacts_by_status_type if item['status__type'] == 'client')
        
        # Recent activity
        contacts_today = contacts_qs.filter(created_at__gte=today_start).count()
        contacts_this_week = contacts_qs.filter(created_at__gte=week_start).count()
        contacts_this_month = contacts_qs.filter(created_at__gte=month_start).count()
        
        notes_today = notes_qs.filter(created_at__gte=today_start).count()
        events_today = events_qs.filter(created_at__gte=today_start).count()
        
        # Contacts by source
        contacts_by_source = contacts_qs.values('source__name').annotate(count=Count('id')).order_by('-count')[:5]
        top_sources = [{'name': item['source__name'] or 'Non défini', 'count': item['count']} for item in contacts_by_source]
        
        # Contacts by teleoperator
        contacts_by_teleoperator = contacts_qs.filter(teleoperator__isnull=False).values(
            'teleoperator__first_name', 
            'teleoperator__last_name'
        ).annotate(count=Count('id')).order_by('-count')[:5]
        top_teleoperators = [
            {
                'name': f"{item['teleoperator__first_name'] or ''} {item['teleoperator__last_name'] or ''}".strip() or 'Non défini',
                'count': item['count']
            } 
            for item in contacts_by_teleoperator
        ]
        
        # Upcoming events (next 7 days)
        upcoming_events = events_qs.filter(
            datetime__gte=now,
            datetime__lte=now + timedelta(days=7)
        ).order_by('datetime')[:10]
        
        upcoming_events_data = []
        for event in upcoming_events:
            upcoming_events_data.append({
                'id': event.id,
                'datetime': event.datetime.isoformat(),
                'contactId': event.contactId.id if event.contactId else None,
                'contactName': f"{event.contactId.fname} {event.contactId.lname}".strip() if event.contactId else None,
                'comment': event.comment,
                'userId': event.userId.id,
                'userName': f"{event.userId.first_name} {event.userId.last_name}".strip() or event.userId.username
            })
        
        # Recent contacts (last 10)
        recent_contacts = contacts_qs.order_by('-created_at')[:10]
        recent_contacts_data = []
        for contact in recent_contacts:
            recent_contacts_data.append({
                'id': contact.id,
                'name': f"{contact.fname} {contact.lname}".strip(),
                'status': contact.status.name if contact.status else None,
                'source': contact.source.name if contact.source else None,
                'createdAt': contact.created_at.isoformat()
            })
        
        return Response({
            'totalContacts': total_contacts,
            'totalLeads': leads_count,
            'totalContactsCount': contacts_count,
            'totalClients': clients_count,
            'totalNotes': total_notes,
            'totalEvents': total_events,
            'totalUsers': total_users,
            'contactsToday': contacts_today,
            'contactsThisWeek': contacts_this_week,
            'contactsThisMonth': contacts_this_month,
            'notesToday': notes_today,
            'eventsToday': events_today,
            'topSources': top_sources,
            'topTeleoperators': top_teleoperators,
            'upcomingEvents': upcoming_events_data,
            'recentContacts': recent_contacts_data
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Error getting stats: {error_details}")
        return Response(
            {'error': str(e)}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

