from django.contrib.auth.models import User as DjangoUser
from rest_framework import serializers
from .models import Contact, Note, NoteCategory, UserDetails, Team, Event, TeamMember, Log, Role, Permission, PermissionRole, Status, Source, Document, SMTPConfig, Email, EmailSignature, ChatRoom, Message, Notification, NotificationPreference
import uuid

class UserSerializer(serializers.ModelSerializer):
    first_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    last_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    roleId = serializers.CharField(write_only=True, required=False, allow_null=True, allow_blank=True)
    phone = serializers.CharField(write_only=True, required=False, allow_blank=True)
    teamId = serializers.CharField(write_only=True, required=False, allow_null=True, allow_blank=True)
    
    class Meta:
        model = DjangoUser
        fields = ['id', 'username', 'email', 'password', 'first_name', 'last_name', 'roleId', 'phone', 'teamId']
        extra_kwargs = {
            'password': {'write_only': True},
            'email': {'required': False, 'allow_blank': True},
            'username': {'required': False, 'allow_blank': True}
        }
    
    def validate_username(self, value):
        """Validate username: strip whitespace and check for case-insensitive duplicates."""
        # Username is optional if email is provided (will be set in validate method)
        if value:
            value = value.strip()
            # Check for case-insensitive duplicate
            if DjangoUser.objects.filter(username__iexact=value).exists():
                raise serializers.ValidationError("A user with that username already exists.")
        return value
    
    def validate(self, data):
        """Use email as username if username is not provided."""
        email = data.get('email', '').strip() if data.get('email') else ''
        username = data.get('username', '').strip() if data.get('username') else ''
        
        # If email is provided and username is not, use email as username
        if email and not username:
            data['username'] = email
            # Validate that this email/username doesn't already exist
            if DjangoUser.objects.filter(username__iexact=email).exists():
                raise serializers.ValidationError({"email": "A user with this email already exists."})
        
        # If both are provided but different, use email as username
        elif email and username and email != username:
            data['username'] = email
            # Validate that this email/username doesn't already exist
            if DjangoUser.objects.filter(username__iexact=email).exists():
                raise serializers.ValidationError({"email": "A user with this email already exists."})
        
        # Ensure username is set
        if not data.get('username'):
            raise serializers.ValidationError({"email": "Email is required when username is not provided."})
        
        return data

    def create(self, validated_data):
        # Extract UserDetails fields
        first_name = validated_data.pop('first_name', '')
        last_name = validated_data.pop('last_name', '')
        role_id = validated_data.pop('roleId', None)
        phone = validated_data.pop('phone', '')
        team_id = validated_data.pop('teamId', None)
        
        # Get and normalize username (already validated and stripped in validate_username)
        username = validated_data.get('username', '').strip()
        
        # Create Django User
        user = DjangoUser.objects.create_user(
            username=username,
            email=validated_data.get('email', '').strip() if validated_data.get('email') else '',
            password=validated_data.get('password'),
            first_name=first_name.strip() if first_name else '',
            last_name=last_name.strip() if last_name else ''
        )

        # Generate a numeric UserDetails ID (str) incrementing from max existing one
        # Ensure it's always 12 characters or less
        max_id = 0
        for id_val in UserDetails.objects.values_list('id', flat=True):
            try:
                int_id = int(id_val)
                if int_id > max_id:
                    max_id = int_id
            except (ValueError, TypeError):
                continue
        
        # Generate new ID and ensure it doesn't exceed 12 characters
        new_id = max_id + 1
        user_details_id = str(new_id)
        
        # If the ID exceeds 12 characters, use a truncated UUID instead
        if len(user_details_id) > 12:
            # Generate a unique 12-character ID
            while True:
                user_details_id = uuid.uuid4().hex[:12]
                if not UserDetails.objects.filter(id=user_details_id).exists():
                    break

        # Get role if role_id provided
        role = None
        if role_id:
            try:
                role = Role.objects.get(id=role_id)
            except Role.DoesNotExist:
                pass  # Role will be None if not found
        
        # Create UserDetails entry for this user
        user_details = UserDetails.objects.create(
            id=user_details_id,
            django_user=user,
            role=role,
            phone=phone.strip() if phone else ''
        )
        
        # Create TeamMember if teamId provided
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
                pass
        
        return user

class NoteCategorySerializer(serializers.ModelSerializer):
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    updatedAt = serializers.DateTimeField(source='updated_at', read_only=True)
    orderIndex = serializers.IntegerField(source='order_index', required=False)
    
    class Meta:
        model = NoteCategory
        fields = ['id', 'name', 'orderIndex', 'createdAt', 'updatedAt']
        extra_kwargs = {
            'id': {'required': False}
        }
    
    def to_representation(self, instance):
        ret = super().to_representation(instance)
        ret['createdAt'] = instance.created_at
        ret['updatedAt'] = instance.updated_at
        ret['orderIndex'] = instance.order_index
        return ret

class NoteSerializer(serializers.ModelSerializer):
    contactId = serializers.PrimaryKeyRelatedField(queryset=Contact.objects.all(), required=False, allow_null=True)
    categId = serializers.PrimaryKeyRelatedField(queryset=NoteCategory.objects.all(), required=False, allow_null=True, source='categ_id')
    createdBy = serializers.SerializerMethodField()
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    categoryName = serializers.SerializerMethodField()
    
    class Meta:
        model = Note
        fields = ['id', 'contactId', 'userId', 'categId', 'text', 'created_at', 'updated_at', 'createdBy', 'createdAt', 'categoryName']
        extra_kwargs = {
            'userId': {'read_only': True},
            'id': {'required': False}
        }
    
    def get_createdBy(self, obj):
        """Get the creator's name (first_name last_name or username)"""
        if obj.userId:
            first_name = obj.userId.first_name or ''
            last_name = obj.userId.last_name or ''
            if first_name or last_name:
                return f"{first_name} {last_name}".strip()
            return obj.userId.username or ''
        return ''
    
    def get_categoryName(self, obj):
        """Get the category name"""
        return obj.categ_id.name if obj.categ_id else None
    
    def to_representation(self, instance):
        ret = super().to_representation(instance)
        # Expose contactId and categId as string IDs in API response
        ret['contactId'] = instance.contactId.id if instance.contactId else None
        ret['categId'] = instance.categ_id.id if instance.categ_id else None
        ret['createdBy'] = self.get_createdBy(instance)
        ret['createdAt'] = instance.created_at
        ret['categoryName'] = self.get_categoryName(instance)
        return ret
    
    def to_internal_value(self, data):
        return super().to_internal_value(data)

class ContactSerializer(serializers.ModelSerializer):
    firstName = serializers.SerializerMethodField()
    lastName = serializers.SerializerMethodField()
    fullName = serializers.SerializerMethodField()
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    source = serializers.SerializerMethodField()
    phone = serializers.SerializerMethodField()
    mobile = serializers.SerializerMethodField()
    
    class Meta:
        model = Contact
        fields = '__all__'
        # Phone and mobile are handled via SerializerMethodField above
        # The queryset defers these fields to avoid ORM conversion errors
    
    def get_firstName(self, obj):
        return obj.fname
    
    def get_lastName(self, obj):
        return obj.lname
    
    def get_fullName(self, obj):
        return f"{obj.fname} {obj.lname}".strip()
    
    def get_phone(self, obj):
        """Handle phone field - returns integer as string or empty string"""
        try:
            phone_value = getattr(obj, 'phone', None)
            if phone_value is None:
                return ''
            return str(phone_value)
        except (ValueError, TypeError, AttributeError):
            return ''
    
    def get_mobile(self, obj):
        """Handle mobile field - returns integer as string or empty string"""
        try:
            mobile_value = getattr(obj, 'mobile', None)
            if mobile_value is None:
                return ''
            return str(mobile_value)
        except (ValueError, TypeError, AttributeError):
            return ''
    
    def get_source(self, obj):
        if obj.source:
            return obj.source.name
        return ''
    
    def to_representation(self, instance):
        # Since phone and mobile are excluded from fields, super() won't try to serialize them
        # This avoids the conversion error when database has empty strings
        ret = super().to_representation(instance)
        # S'assurer que tous les champs sont présents et convertir en camelCase
        ret['firstName'] = instance.fname
        ret['lastName'] = instance.lname
        ret['fullName'] = f"{instance.fname} {instance.lname}".strip()
        ret['createdAt'] = instance.created_at
        ret['source'] = instance.source.name if instance.source else ''
        ret['sourceId'] = instance.source_id if hasattr(instance, 'source_id') else (instance.source.id if instance.source else None)
        ret['statusId'] = instance.status_id if hasattr(instance, 'status_id') else (instance.status.id if instance.status else None)
        ret['statusName'] = instance.status.name if instance.status else ''
        ret['statusColor'] = instance.status.color if instance.status else ''
        ret['addressComplement'] = instance.address_complement or ''
        ret['campaign'] = instance.campaign or ''
        ret['teleoperatorId'] = instance.teleoperator_id if hasattr(instance, 'teleoperator_id') else (instance.teleoperator.id if instance.teleoperator else None)
        if instance.teleoperator:
            first_name = getattr(instance.teleoperator, 'first_name', '') or ''
            last_name = getattr(instance.teleoperator, 'last_name', '') or ''
            ret['teleoperatorName'] = f"{first_name} {last_name}".strip()
        else:
            ret['teleoperatorName'] = ''
        ret['confirmateurId'] = instance.confirmateur_id if hasattr(instance, 'confirmateur_id') else (instance.confirmateur.id if instance.confirmateur else None)
        if instance.confirmateur:
            first_name = getattr(instance.confirmateur, 'first_name', '') or ''
            last_name = getattr(instance.confirmateur, 'last_name', '') or ''
            ret['confirmateurName'] = f"{first_name} {last_name}".strip()
        else:
            ret['confirmateurName'] = ''
        ret['creatorId'] = instance.creator_id if hasattr(instance, 'creator_id') else (instance.creator.id if instance.creator else None)
        if instance.creator:
            first_name = getattr(instance.creator, 'first_name', '') or ''
            last_name = getattr(instance.creator, 'last_name', '') or ''
            ret['creatorName'] = f"{first_name} {last_name}".strip()
        else:
            ret['creatorName'] = ''
        # Phone and mobile are handled by SerializerMethodField - use the methods
        ret['phone'] = self.get_phone(instance)
        ret['mobile'] = self.get_mobile(instance)
        
        # Manager is the teleoperator (the one selected in teleoperateur select during creation)
        if instance.teleoperator:
            ret['managerId'] = str(instance.teleoperator.id)
            ret['manager'] = str(instance.teleoperator.id)
            ret['managerName'] = ret['teleoperatorName']
            ret['managerEmail'] = instance.teleoperator.email or ''
            # Optimize: Use prefetched data efficiently
            try:
                # Access user_details - should be prefetched via select_related
                user_details = getattr(instance.teleoperator, 'user_details', None)
                ret['managerUserDetailsId'] = user_details.id if user_details else None
                
                # Use prefetched team_memberships if available
                if user_details:
                    # Try to access prefetched team_memberships
                    # The prefetch path is: teleoperator__user_details__team_memberships__team
                    # So team_memberships should be in the prefetch cache
                    try:
                        # Check if prefetched
                        if hasattr(user_details, '_prefetched_objects_cache'):
                            prefetched = user_details._prefetched_objects_cache
                            team_memberships = prefetched.get('team_memberships', None)
                            if team_memberships is not None:
                                # Use prefetched data
                                teleoperator_team_member = team_memberships[0] if team_memberships else None
                            else:
                                # Not prefetched - return None to avoid query
                                teleoperator_team_member = None
                        else:
                            # No prefetch cache - return None to avoid query
                            teleoperator_team_member = None
                        
                        if teleoperator_team_member:
                            # Team should be select_related in the prefetch
                            ret['managerTeamId'] = teleoperator_team_member.team.id if hasattr(teleoperator_team_member, 'team') else None
                            ret['managerTeamName'] = teleoperator_team_member.team.name if hasattr(teleoperator_team_member, 'team') else ''
                        else:
                            ret['managerTeamId'] = None
                            ret['managerTeamName'] = ''
                    except (AttributeError, IndexError, KeyError):
                        # If anything fails, set defaults without querying
                        ret['managerTeamId'] = None
                        ret['managerTeamName'] = ''
                else:
                    ret['managerTeamId'] = None
                    ret['managerTeamName'] = ''
            except Exception:
                # Silently fail and set defaults
                ret['managerUserDetailsId'] = None
                ret['managerTeamId'] = None
                ret['managerTeamName'] = ''
        else:
            ret['managerId'] = None
            ret['manager'] = ''
            ret['managerName'] = ''
            ret['managerEmail'] = ''
            ret['managerUserDetailsId'] = None
            ret['managerTeamId'] = None
            ret['managerTeamName'] = ''
        
        # Convertir les champs personnels de snake_case à camelCase
        ret['civility'] = ret.get('civility', '') or ''
        ret['birthDate'] = instance.birth_date.isoformat() if instance.birth_date else None
        ret['birthPlace'] = ret.get('birth_place', '') or ''
        ret['address'] = ret.get('address', '') or ''
        ret['postalCode'] = ret.get('postal_code', '') or ''
        ret['city'] = ret.get('city', '') or ''
        ret['nationality'] = ret.get('nationality', '') or ''
        
        # Add notes information
        notes = instance.contact_notes.all()
        notes_count = notes.count()
        latest_note = notes.first()
        ret['notesCount'] = notes_count
        ret['notesLatestText'] = latest_note.text[:100] if latest_note else ''  # First 100 chars
        ret['hasNotes'] = notes_count > 0
        
        return ret

class TeamSerializer(serializers.ModelSerializer):
    class Meta:
        model = Team
        fields = ['id', 'name', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

class UserDetailsSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)
    firstName = serializers.SerializerMethodField()
    lastName = serializers.SerializerMethodField()
    username = serializers.SerializerMethodField()
    email = serializers.SerializerMethodField()
    teamId = serializers.SerializerMethodField()
    phone = serializers.SerializerMethodField()
    mobile = serializers.SerializerMethodField()
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)

    class Meta:
        model = UserDetails
        fields = [
            'id', 'firstName', 'lastName', 'username', 'email',
            'role', 'phone', 'mobile', 'teamId', 'active', 'createdAt'
        ]
        read_only_fields = ['id']

    def get_firstName(self, obj):
        return obj.django_user.first_name if obj.django_user else ''

    def get_lastName(self, obj):
        return obj.django_user.last_name if obj.django_user else ''

    def get_username(self, obj):
        return obj.django_user.username if obj.django_user else ''

    def get_email(self, obj):
        return obj.django_user.email if obj.django_user else ''

    def get_phone(self, obj):
        phone_value = getattr(obj, 'phone', None)
        # Handle both integer (after migration) and string (before migration) values
        if phone_value is None or phone_value == '':
            return ''
        return str(phone_value)

    def get_mobile(self, obj):
        # mobile field does not exist on UserDetails; return empty string
        return ''

    def get_teamId(self, obj):
        # Get team from TeamMember relationship - use prefetched data if available
        try:
            # Check if team_memberships is prefetched
            if hasattr(obj, '_prefetched_objects_cache'):
                prefetched = obj._prefetched_objects_cache
                team_memberships = prefetched.get('team_memberships', None)
                if team_memberships is not None and len(team_memberships) > 0:
                    team_member = team_memberships[0]
                    return team_member.team.id if hasattr(team_member, 'team') else None
        except (AttributeError, KeyError, IndexError):
            pass
        
        # Fallback: query if not prefetched (shouldn't happen with proper prefetch)
        team_member = obj.team_memberships.select_related('team').first()
        return team_member.team.id if team_member else None
    
    def get_permissions(self, obj):
        """Get all permissions for the user's role"""
        if not obj.role:
            return []
        
        # Try to use prefetched permission_roles if available
        # The prefetch is on role_id, so check that object
        try:
            role_obj = obj.role_id if hasattr(obj, 'role_id') else obj.role
            if role_obj and hasattr(role_obj, '_prefetched_objects_cache'):
                prefetched = role_obj._prefetched_objects_cache
                permission_roles = prefetched.get('permission_roles', None)
                if permission_roles is not None:
                    # Use prefetched data
                    permissions = []
                    for pr in permission_roles:
                        perm = pr.permission
                        permissions.append({
                            'id': perm.id,
                            'component': perm.component,
                            'fieldName': perm.field_name,
                            'action': perm.action,
                            'statusId': perm.status.id if perm.status else None,
                        })
                    return permissions
        except (AttributeError, KeyError):
            pass
        
        # Fallback: query if not prefetched (shouldn't happen with proper prefetch)
        permission_roles = obj.role.permission_roles.select_related('permission', 'permission__status').all()
        
        # Serialize permissions
        permissions = []
        for pr in permission_roles:
            perm = pr.permission
            permissions.append({
                'id': perm.id,
                'component': perm.component,
                'fieldName': perm.field_name,
                'action': perm.action,
                'statusId': perm.status.id if perm.status else None,
            })
        
        return permissions
    
    def to_representation(self, instance):
        ret = super().to_representation(instance)
        # Add django_user.id for compatibility with other endpoints that use Django User ID
        ret['djangoUserId'] = instance.django_user.id if instance.django_user else None
        # Handle role as ForeignKey
        if instance.role:
            ret['role'] = instance.role.id
            ret['roleName'] = instance.role.name
            ret['isTeleoperateur'] = instance.role.is_teleoperateur
            ret['isConfirmateur'] = instance.role.is_confirmateur
            ret['dataAccess'] = instance.role.data_access  # Include data_access level
        else:
            ret['role'] = None
            ret['roleName'] = None
            ret['isTeleoperateur'] = False
            ret['isConfirmateur'] = False
            ret['dataAccess'] = 'own_only'  # Default to most restrictive
        ret['isLeader'] = instance.role and instance.role.name.lower() == 'teamleader'
        # Get teamId from TeamMember relationship - use prefetched data if available
        try:
            # Check if team_memberships is prefetched
            if hasattr(instance, '_prefetched_objects_cache'):
                prefetched = instance._prefetched_objects_cache
                team_memberships = prefetched.get('team_memberships', None)
                if team_memberships is not None and len(team_memberships) > 0:
                    team_member = team_memberships[0]
                    ret['teamId'] = team_member.team.id if hasattr(team_member, 'team') else None
                else:
                    ret['teamId'] = None
            else:
                # Fallback: query if not prefetched
                team_member = instance.team_memberships.select_related('team').first()
                ret['teamId'] = team_member.team.id if team_member else None
        except (AttributeError, KeyError, IndexError):
            ret['teamId'] = None
        # Include permissions
        ret['permissions'] = self.get_permissions(instance)
        return ret

class TeamMemberSerializer(serializers.ModelSerializer):
    userId = serializers.CharField(source='user.id', read_only=True)
    userData = serializers.SerializerMethodField()
    isLeader = serializers.SerializerMethodField()
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)

    class Meta:
        model = TeamMember
        fields = ['userId', 'userData', 'isLeader', 'createdAt']

    def get_userData(self, obj):
        user_details = obj.user
        django_user = user_details.django_user
        return {
            'firstName': django_user.first_name if django_user else '',
            'lastName': django_user.last_name if django_user else '',
            'role': user_details.role.id if user_details.role else None,
            'roleName': user_details.role.name if user_details.role else None,
        }
    
    def get_isLeader(self, obj):
        return obj.user.role and obj.user.role.name.lower() == 'teamleader'

class TeamDetailSerializer(serializers.Serializer):
    team = TeamSerializer()
    members = TeamMemberSerializer(many=True, source='team_members')

class EventSerializer(serializers.ModelSerializer):
    contactId = serializers.CharField(write_only=True, required=False, allow_null=True, allow_blank=True)
    userId = serializers.CharField(write_only=True, required=False, allow_null=True, allow_blank=True)
    contactName = serializers.SerializerMethodField()
    createdBy = serializers.SerializerMethodField()
    assignedTo = serializers.SerializerMethodField()
    
    class Meta:
        model = Event
        fields = ['id', 'datetime', 'userId', 'contactId', 'comment', 'created_at', 'updated_at', 'contactName', 'createdBy', 'assignedTo']
        extra_kwargs = {
            'id': {'required': False}
        }
    
    def get_contactName(self, obj):
        if obj.contactId:
            return f"{obj.contactId.fname} {obj.contactId.lname}"
        return None
    
    def get_createdBy(self, obj):
        """Get the creator's name (currently same as userId since we don't track creator separately)"""
        if obj.userId:
            first_name = obj.userId.first_name or ''
            last_name = obj.userId.last_name or ''
            if first_name or last_name:
                return f"{first_name} {last_name}".strip()
            return obj.userId.username or ''
        return ''
    
    def get_assignedTo(self, obj):
        """Get the assigned user's name (userId)"""
        if obj.userId:
            first_name = obj.userId.first_name or ''
            last_name = obj.userId.last_name or ''
            if first_name or last_name:
                return f"{first_name} {last_name}".strip()
            return obj.userId.username or ''
        return ''
    
    def to_internal_value(self, data):
        # Traiter le datetime comme heure locale (naive) sans conversion de timezone
        if 'datetime' in data:
            from django.utils.dateparse import parse_datetime
            from django.utils import timezone
            import pytz
            datetime_str = data['datetime']
            # Si le datetime n'a pas de timezone, on le traite comme heure locale
            parsed = parse_datetime(datetime_str)
            if parsed and timezone.is_naive(parsed):
                # Convertir l'heure locale en UTC pour le stockage
                # On assume que l'heure entrée est en heure locale (Europe/Paris)
                local_tz = pytz.timezone('Europe/Paris')
                local_dt = local_tz.localize(parsed)
                data = data.copy()
                data['datetime'] = local_dt.astimezone(pytz.UTC).isoformat()
        return super().to_internal_value(data)
    
    def to_representation(self, instance):
        from django.utils import timezone
        import pytz
        ret = super().to_representation(instance)
        # Expose contactId in API response
        ret['contactId'] = instance.contactId.id if instance.contactId else None
        # Convertir l'UTC stocké en heure locale pour l'affichage
        if instance.datetime:
            # Le datetime stocké est déjà aware (avec timezone UTC)
            if timezone.is_naive(instance.datetime):
                # Si naive, on le traite comme UTC
                utc_dt = timezone.make_aware(instance.datetime, timezone.utc)
            else:
                # Si déjà aware, on s'assure qu'il est en UTC
                utc_dt = instance.datetime.astimezone(pytz.UTC)
            local_tz = pytz.timezone('Europe/Paris')
            local_dt = utc_dt.astimezone(local_tz)
            # Retourner le datetime en format ISO sans timezone pour que le frontend le traite comme local
            ret['datetime'] = local_dt.replace(tzinfo=None).isoformat()
        return ret

class LogSerializer(serializers.ModelSerializer):
    userId = serializers.SerializerMethodField()
    contactId = serializers.SerializerMethodField()
    creatorId = serializers.SerializerMethodField()
    creatorName = serializers.SerializerMethodField()
    eventType = serializers.CharField(source='event_type', read_only=True)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    oldValue = serializers.JSONField(source='old_value', read_only=True)
    newValue = serializers.JSONField(source='new_value', read_only=True)
    
    class Meta:
        model = Log
        fields = ['id', 'eventType', 'userId', 'contactId', 'creatorId', 'creatorName', 'createdAt', 'details', 'oldValue', 'newValue']
        read_only_fields = ['id', 'createdAt']
    
    def get_userId(self, obj):
        return obj.user_id.id if obj.user_id else None
    
    def get_contactId(self, obj):
        return obj.contact_id.id if obj.contact_id else None
    
    def get_creatorId(self, obj):
        return obj.creator_id.id if obj.creator_id else None
    
    def get_creatorName(self, obj):
        if obj.creator_id:
            return f"{obj.creator_id.first_name} {obj.creator_id.last_name}".strip() or obj.creator_id.username
        return None
    
    def to_representation(self, instance):
        ret = super().to_representation(instance)
        ret['eventType'] = instance.event_type
        ret['userId'] = instance.user_id.id if instance.user_id else None
        ret['contactId'] = instance.contact_id.id if instance.contact_id else None
        ret['creatorId'] = instance.creator_id.id if instance.creator_id else None
        ret['creatorName'] = self.get_creatorName(instance)
        ret['createdAt'] = instance.created_at
        ret['details'] = instance.details if instance.details else {}
        ret['oldValue'] = instance.old_value if instance.old_value else {}
        ret['newValue'] = instance.new_value if instance.new_value else {}
        return ret

class SourceSerializer(serializers.ModelSerializer):
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    updatedAt = serializers.DateTimeField(source='updated_at', read_only=True)

    class Meta:
        model = Source
        fields = ['id', 'name', 'createdAt', 'updatedAt']
        read_only_fields = ['createdAt', 'updatedAt']

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        ret['createdAt'] = instance.created_at
        ret['updatedAt'] = instance.updated_at
        return ret

class DocumentSerializer(serializers.ModelSerializer):
    contactId = serializers.CharField(source='contact_id.id', read_only=True)
    documentType = serializers.CharField(source='document_type')
    hasDocument = serializers.BooleanField(source='has_document')
    fileUrl = serializers.URLField(source='file_url', allow_blank=True)
    fileName = serializers.CharField(source='file_name', allow_blank=True)
    uploadedAt = serializers.DateTimeField(source='uploaded_at', read_only=True)
    updatedAt = serializers.DateTimeField(source='updated_at', read_only=True)
    uploadedById = serializers.SerializerMethodField()
    uploadedByName = serializers.SerializerMethodField()

    class Meta:
        model = Document
        fields = ['id', 'contactId', 'documentType', 'hasDocument', 'fileUrl', 'fileName', 'uploadedAt', 'updatedAt', 'uploadedById', 'uploadedByName']
        read_only_fields = ['id', 'uploadedAt', 'updatedAt']

    def get_uploadedById(self, obj):
        return obj.uploaded_by.id if obj.uploaded_by else None

    def get_uploadedByName(self, obj):
        if obj.uploaded_by:
            return f"{obj.uploaded_by.first_name} {obj.uploaded_by.last_name}".strip() or obj.uploaded_by.username
        return None

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        ret['contactId'] = instance.contact_id.id if instance.contact_id else None
        ret['documentType'] = instance.document_type
        ret['hasDocument'] = instance.has_document
        ret['fileUrl'] = instance.file_url or ''
        ret['fileName'] = instance.file_name or ''
        ret['uploadedAt'] = instance.uploaded_at
        ret['updatedAt'] = instance.updated_at
        ret['uploadedById'] = instance.uploaded_by.id if instance.uploaded_by else None
        ret['uploadedByName'] = self.get_uploadedByName(instance)
        return ret

class StatusSerializer(serializers.ModelSerializer):
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    updatedAt = serializers.DateTimeField(source='updated_at', read_only=True)
    orderIndex = serializers.IntegerField(source='order_index', required=False)
    name = serializers.CharField(required=True, allow_blank=False)
    type = serializers.ChoiceField(choices=Status.STATUS_TYPE_CHOICES, required=False, default='lead')
    color = serializers.CharField(required=False, allow_blank=True, max_length=20)
    
    class Meta:
        model = Status
        fields = ['id', 'name', 'type', 'color', 'orderIndex', 'createdAt', 'updatedAt']
        read_only_fields = ['id', 'createdAt', 'updatedAt']
    
    def validate_name(self, value):
        """Validate name field"""
        if not value or not value.strip():
            raise serializers.ValidationError("Name is required and cannot be blank")
        return value.strip()
    
    def validate(self, data):
        """Validate that name and type combination is unique"""
        name = data.get('name', '').strip() if data.get('name') else ''
        status_type = data.get('type') or 'lead'
        
        # Check if name is provided
        if not name:
            raise serializers.ValidationError({"name": "Name is required"})
        
        # Normalize the name in the data
        data['name'] = name
        data['type'] = status_type
        
        # Check for duplicate name + type combination (case-insensitive)
        # Exclude current instance if updating
        queryset = Status.objects.filter(name__iexact=name, type=status_type)
        if self.instance:
            queryset = queryset.exclude(id=self.instance.id)
        
        if queryset.exists():
            raise serializers.ValidationError({
                "name": f"A status with name '{name}' and type '{status_type}' already exists."
            })
        
        return data
    
    def to_representation(self, instance):
        ret = super().to_representation(instance)
        ret['orderIndex'] = instance.order_index
        ret['createdAt'] = instance.created_at
        ret['updatedAt'] = instance.updated_at
        return ret

class RoleSerializer(serializers.ModelSerializer):
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    updatedAt = serializers.DateTimeField(source='updated_at', read_only=True)
    dataAccess = serializers.CharField(source='data_access', required=False)
    isTeleoperateur = serializers.BooleanField(source='is_teleoperateur', required=False)
    isConfirmateur = serializers.BooleanField(source='is_confirmateur', required=False)
    
    class Meta:
        model = Role
        fields = ['id', 'name', 'dataAccess', 'isTeleoperateur', 'isConfirmateur', 'createdAt', 'updatedAt']
        read_only_fields = ['id', 'createdAt', 'updatedAt']
    
    def to_representation(self, instance):
        ret = super().to_representation(instance)
        ret['dataAccess'] = instance.data_access
        ret['isTeleoperateur'] = instance.is_teleoperateur
        ret['isConfirmateur'] = instance.is_confirmateur
        ret['createdAt'] = instance.created_at
        ret['updatedAt'] = instance.updated_at
        return ret

class PermissionSerializer(serializers.ModelSerializer):
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    updatedAt = serializers.DateTimeField(source='updated_at', read_only=True)
    fieldName = serializers.CharField(source='field_name', required=False, allow_null=True, allow_blank=True)
    action = serializers.CharField(required=False)
    statusId = serializers.CharField(write_only=True, required=False, allow_null=True, allow_blank=True)
    
    # Only these components are allowed to have statusId
    STATUS_ALLOWED_COMPONENTS = ['statuses', 'note_categories']
    
    class Meta:
        model = Permission
        fields = ['id', 'component', 'fieldName', 'action', 'statusId', 'createdAt', 'updatedAt']
        read_only_fields = ['id', 'createdAt', 'updatedAt']
    
    def validate(self, data):
        """Validate that only statuses and note_categories can have statusId and check for duplicates"""
        component = data.get('component') or (self.instance.component if self.instance else None)
        status_id = data.get('statusId')
        field_name = data.get('fieldName') or data.get('field_name') or (self.instance.field_name if self.instance else None)
        action = data.get('action') or (self.instance.action if self.instance else None)
        
        if not component or not action:
            return data  # Let other validations handle missing required fields
        
        # Only 'statuses' and 'note_categories' components are allowed to have statusId
        if status_id and component not in self.STATUS_ALLOWED_COMPONENTS:
            raise serializers.ValidationError(
                f"Component '{component}' cannot have statusId. "
                f"Only components '{', '.join(self.STATUS_ALLOWED_COMPONENTS)}' are allowed to have status-specific permissions."
            )
        
        # Check for duplicate permissions (same component, field_name, action, status)
        # Convert status_id to Status object if provided
        status_obj = None
        if status_id:
            try:
                status_obj = Status.objects.get(id=status_id)
            except Status.DoesNotExist:
                pass
        
        # Check if a permission with the same combination already exists (excluding current instance if updating)
        existing_permission = Permission.objects.filter(
            component=component,
            field_name=field_name or None,
            action=action,
            status=status_obj if status_obj else None
        ).exclude(id=self.instance.id if self.instance else None).first()
        
        if existing_permission:
            raise serializers.ValidationError(
                f"A permission with component='{component}', action='{action}', "
                f"fieldName={field_name or 'null'}, statusId={status_id or 'null'} already exists (ID: {existing_permission.id}). "
                "Permissions must be unique by component, field_name, action, and status."
            )
        
        return data
    
    def create(self, validated_data):
        # Remove statusId from validated_data as it's not a model field
        status_id = validated_data.pop('statusId', None)
        component = validated_data.get('component')
        
        # Double-check validation (in case validate wasn't called)
        if status_id and component not in self.STATUS_ALLOWED_COMPONENTS:
            raise serializers.ValidationError(
                f"Component '{component}' cannot have statusId. "
                f"Only components '{', '.join(self.STATUS_ALLOWED_COMPONENTS)}' are allowed to have status-specific permissions."
            )
        
        status = None
        if status_id:
            try:
                status = Status.objects.get(id=status_id)
            except Status.DoesNotExist:
                pass
        
        # Extra safety check: verify no duplicate exists before creating
        # (validate() should have caught this, but this is a final safeguard)
        field_name = validated_data.get('field_name')
        action = validated_data.get('action')
        
        existing_permission = Permission.objects.filter(
            component=component,
            field_name=field_name or None,
            action=action,
            status=status
        ).first()
        
        if existing_permission:
            raise serializers.ValidationError(
                f"A permission with component='{component}', action='{action}', "
                f"fieldName={field_name or 'null'}, statusId={status_id or 'null'} already exists (ID: {existing_permission.id}). "
                "Permissions must be unique by component, field_name, action, and status."
            )
        
        # Create the permission with status
        # Extra kwargs from serializer.save() (like id, action) are already in validated_data
        try:
            permission = Permission.objects.create(**validated_data, status=status)
        except Exception as e:
            # Catch database integrity errors (unique constraint violations)
            # This provides a fallback if validation somehow didn't catch duplicates
            if 'UNIQUE constraint' in str(e) or 'unique constraint' in str(e).lower() or 'duplicate' in str(e).lower():
                raise serializers.ValidationError(
                    f"A permission with component='{component}', action='{action}', "
                    f"fieldName={field_name or 'null'}, statusId={status_id or 'null'} already exists. "
                    "Permissions must be unique by component, field_name, action, and status."
                )
            raise  # Re-raise other exceptions
        return permission
    
    def update(self, instance, validated_data):
        # Handle statusId separately
        status_id = validated_data.pop('statusId', None)
        if status_id is not None:
            if status_id:
                try:
                    instance.status = Status.objects.get(id=status_id)
                except Status.DoesNotExist:
                    pass
            else:
                instance.status = None
        
        # Update other fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance
    
    def to_representation(self, instance):
        ret = super().to_representation(instance)
        ret['fieldName'] = instance.field_name if instance.field_name else None
        ret['action'] = instance.action
        ret['statusId'] = instance.status_id if hasattr(instance, 'status_id') else (instance.status.id if instance.status else None)
        ret['createdAt'] = instance.created_at
        ret['updatedAt'] = instance.updated_at
        return ret

class PermissionRoleSerializer(serializers.ModelSerializer):
    roleId = serializers.CharField(source='role.id', read_only=True)
    roleName = serializers.CharField(source='role.name', read_only=True)
    permissionId = serializers.CharField(source='permission.id', read_only=True)
    permission = PermissionSerializer(read_only=True)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    updatedAt = serializers.DateTimeField(source='updated_at', read_only=True)
    
    class Meta:
        model = PermissionRole
        fields = ['id', 'roleId', 'roleName', 'permissionId', 'permission', 'createdAt', 'updatedAt']
        read_only_fields = ['id', 'createdAt', 'updatedAt']
    
    def to_representation(self, instance):
        ret = super().to_representation(instance)
        ret['roleId'] = instance.role.id
        ret['roleName'] = instance.role.name
        ret['permissionId'] = instance.permission.id
        ret['permission'] = PermissionSerializer(instance.permission).data
        ret['createdAt'] = instance.created_at
        ret['updatedAt'] = instance.updated_at
        return ret

class SMTPConfigSerializer(serializers.ModelSerializer):
    userId = serializers.CharField(source='user.id', read_only=True)
    emailAddress = serializers.EmailField(source='email_address')
    smtpServer = serializers.CharField(source='smtp_server')
    smtpPort = serializers.IntegerField(source='smtp_port')
    smtpUseTls = serializers.BooleanField(source='smtp_use_tls')
    smtpUsername = serializers.CharField(source='smtp_username')
    smtpPassword = serializers.CharField(source='smtp_password', write_only=True, required=False)
    imapServer = serializers.CharField(source='imap_server', required=False, allow_blank=True)
    imapPort = serializers.IntegerField(source='imap_port', required=False, allow_null=True)
    imapUseSsl = serializers.BooleanField(source='imap_use_ssl', required=False)
    isActive = serializers.BooleanField(source='is_active')
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    updatedAt = serializers.DateTimeField(source='updated_at', read_only=True)
    
    class Meta:
        model = SMTPConfig
        fields = ['id', 'userId', 'emailAddress', 'smtpServer', 'smtpPort', 'smtpUseTls', 
                  'smtpUsername', 'smtpPassword', 'imapServer', 'imapPort', 'imapUseSsl', 
                  'isActive', 'createdAt', 'updatedAt']
        read_only_fields = ['id', 'createdAt', 'updatedAt']
    
    def to_representation(self, instance):
        ret = super().to_representation(instance)
        ret['userId'] = instance.user.id
        ret['emailAddress'] = instance.email_address
        ret['smtpServer'] = instance.smtp_server
        ret['smtpPort'] = instance.smtp_port
        ret['smtpUseTls'] = instance.smtp_use_tls
        ret['smtpUsername'] = instance.smtp_username
        # Don't include password in response
        if 'smtpPassword' in ret:
            del ret['smtpPassword']
        ret['imapServer'] = instance.imap_server or ''
        ret['imapPort'] = instance.imap_port
        ret['imapUseSsl'] = instance.imap_use_ssl
        ret['isActive'] = instance.is_active
        ret['createdAt'] = instance.created_at
        ret['updatedAt'] = instance.updated_at
        return ret

class EmailSerializer(serializers.ModelSerializer):
    userId = serializers.CharField(source='user.id', read_only=True)
    userName = serializers.SerializerMethodField()
    emailType = serializers.ChoiceField(source='email_type', choices=Email.EMAIL_TYPE_CHOICES)
    fromEmail = serializers.EmailField(source='from_email')
    toEmails = serializers.JSONField(source='to_emails')
    ccEmails = serializers.JSONField(source='cc_emails', required=False, allow_null=True)
    bccEmails = serializers.JSONField(source='bcc_emails', required=False, allow_null=True)
    bodyText = serializers.CharField(source='body_text', required=False, allow_blank=True)
    bodyHtml = serializers.CharField(source='body_html', required=False, allow_blank=True)
    attachments = serializers.JSONField(required=False, allow_null=True)
    messageId = serializers.CharField(source='message_id', required=False, allow_blank=True)
    inReplyTo = serializers.CharField(source='in_reply_to', required=False, allow_blank=True)
    references = serializers.CharField(required=False, allow_blank=True)
    contactId = serializers.CharField(source='contact.id', read_only=True, allow_null=True)
    isRead = serializers.BooleanField(source='is_read', required=False)
    isStarred = serializers.BooleanField(source='is_starred', required=False)
    sentAt = serializers.DateTimeField(source='sent_at', required=False, allow_null=True)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    updatedAt = serializers.DateTimeField(source='updated_at', read_only=True)
    
    class Meta:
        model = Email
        fields = ['id', 'userId', 'userName', 'emailType', 'subject', 'fromEmail', 'toEmails', 
                  'ccEmails', 'bccEmails', 'bodyText', 'bodyHtml', 'attachments', 'messageId', 
                  'inReplyTo', 'references', 'contactId', 'isRead', 'isStarred', 'sentAt', 
                  'createdAt', 'updatedAt']
        read_only_fields = ['id', 'createdAt', 'updatedAt']
    
    def get_userName(self, obj):
        if obj.user:
            return f"{obj.user.first_name} {obj.user.last_name}".strip() or obj.user.username
        return None
    
    def to_representation(self, instance):
        ret = super().to_representation(instance)
        ret['userId'] = instance.user.id if instance.user else None
        ret['userName'] = self.get_userName(instance)
        ret['emailType'] = instance.email_type
        ret['fromEmail'] = instance.from_email
        ret['toEmails'] = instance.to_emails or []
        ret['ccEmails'] = instance.cc_emails or []
        ret['bccEmails'] = instance.bcc_emails or []
        ret['bodyText'] = instance.body_text or ''
        ret['bodyHtml'] = instance.body_html or ''
        ret['attachments'] = instance.attachments or []
        ret['messageId'] = instance.message_id or ''
        ret['inReplyTo'] = instance.in_reply_to or ''
        ret['references'] = instance.references or ''
        ret['contactId'] = instance.contact.id if instance.contact else None
        ret['isRead'] = instance.is_read
        ret['isStarred'] = instance.is_starred
        ret['sentAt'] = instance.sent_at
        ret['createdAt'] = instance.created_at
        ret['updatedAt'] = instance.updated_at
        return ret

class EmailSignatureSerializer(serializers.ModelSerializer):
    userId = serializers.CharField(source='user.id', read_only=True)
    name = serializers.CharField(required=True)
    contentHtml = serializers.CharField(source='content_html', required=False, allow_blank=True)
    contentText = serializers.CharField(source='content_text', required=False, allow_blank=True)
    logoUrl = serializers.URLField(source='logo_url', required=False, allow_blank=True)
    logoProxyUrl = serializers.SerializerMethodField()  # Proxy URL for preview
    logoPosition = serializers.ChoiceField(source='logo_position', choices=EmailSignature.LOGO_POSITIONS, required=False, allow_blank=True)
    isDefault = serializers.BooleanField(source='is_default', required=False)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    updatedAt = serializers.DateTimeField(source='updated_at', read_only=True)
    
    class Meta:
        model = EmailSignature
        fields = ['id', 'userId', 'name', 'contentHtml', 'contentText', 'logoUrl', 'logoProxyUrl', 'logoPosition', 'isDefault', 'createdAt', 'updatedAt']
        read_only_fields = ['id', 'createdAt', 'updatedAt']
    
    def get_logoProxyUrl(self, obj):
        """Generate proxy URL for logo preview to avoid CORS issues"""
        import os
        if not obj.logo_url:
            return None
        
        # Extract file path from URL: https://endpoint/bucket/path -> path
        endpoint = os.getenv('IMPOSSIBLE_CLOUD_ENDPOINT', 'https://eu-central-2.storage.impossibleapi.net').rstrip('/')
        bucket_name = os.getenv('IMPOSSIBLE_CLOUD_BUCKET', 'leadflow-documents')
        
        if obj.logo_url.startswith(endpoint):
            # Extract path after bucket name
            path_part = obj.logo_url[len(endpoint):].lstrip('/')
            if path_part.startswith(f'{bucket_name}/'):
                file_path = path_part[len(bucket_name) + 1:]  # Remove bucket name and leading slash
                return f'/api/emails/signatures/logo-proxy/{file_path}'
        
        return None
    
    def to_representation(self, instance):
        ret = super().to_representation(instance)
        ret['userId'] = instance.user.id
        ret['name'] = instance.name
        ret['contentHtml'] = instance.content_html or ''
        ret['contentText'] = instance.content_text or ''
        ret['logoUrl'] = instance.logo_url if instance.logo_url else None  # Keep original URL for email sending
        ret['logoProxyUrl'] = self.get_logoProxyUrl(instance)  # Proxy URL for preview
        ret['logoPosition'] = instance.logo_position or 'left'
        ret['isDefault'] = instance.is_default
        ret['createdAt'] = instance.created_at
        ret['updatedAt'] = instance.updated_at
        return ret

class MessageSerializer(serializers.ModelSerializer):
    senderId = serializers.CharField(source='sender.id', read_only=True)
    senderName = serializers.SerializerMethodField()
    chatRoomId = serializers.CharField(source='chat_room.id', read_only=True)
    isRead = serializers.BooleanField(source='is_read')
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    updatedAt = serializers.DateTimeField(source='updated_at', read_only=True)
    
    class Meta:
        model = Message
        fields = ['id', 'chatRoomId', 'senderId', 'senderName', 'content', 'isRead', 'createdAt', 'updatedAt']
        read_only_fields = ['id', 'createdAt', 'updatedAt']
    
    def get_senderName(self, obj):
        if obj.sender:
            first_name = obj.sender.first_name or ''
            last_name = obj.sender.last_name or ''
            if first_name or last_name:
                return f"{first_name} {last_name}".strip()
            return obj.sender.username or ''
        return ''
    
    def to_representation(self, instance):
        ret = super().to_representation(instance)
        ret['chatRoomId'] = instance.chat_room.id if instance.chat_room else None
        ret['senderId'] = instance.sender.id if instance.sender else None
        ret['senderName'] = self.get_senderName(instance)
        ret['isRead'] = instance.is_read
        ret['createdAt'] = instance.created_at
        ret['updatedAt'] = instance.updated_at
        return ret

class ChatRoomSerializer(serializers.ModelSerializer):
    participants = serializers.SerializerMethodField()
    lastMessage = serializers.SerializerMethodField()
    unreadCount = serializers.SerializerMethodField()
    otherParticipant = serializers.SerializerMethodField()
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    updatedAt = serializers.DateTimeField(source='updated_at', read_only=True)
    
    class Meta:
        model = ChatRoom
        fields = ['id', 'participants', 'otherParticipant', 'lastMessage', 'unreadCount', 'createdAt', 'updatedAt']
        read_only_fields = ['id', 'createdAt', 'updatedAt']
    
    def get_participants(self, obj):
        """Get list of participant IDs"""
        return [user.id for user in obj.participants.all()]
    
    def get_otherParticipant(self, obj):
        """Get the other participant (not the current user)"""
        request = self.context.get('request')
        if request and request.user:
            other_participants = obj.participants.exclude(id=request.user.id)
            if other_participants.exists():
                other_user = other_participants.first()
                first_name = other_user.first_name or ''
                last_name = other_user.last_name or ''
                name = f"{first_name} {last_name}".strip() if (first_name or last_name) else other_user.username
                return {
                    'id': other_user.id,
                    'username': other_user.username,
                    'name': name,
                    'email': other_user.email or ''
                }
        return None
    
    def get_lastMessage(self, obj):
        """Get the last message in the chat room"""
        last_msg = obj.messages.order_by('-created_at').first()
        if last_msg:
            return MessageSerializer(last_msg).data
        return None
    
    def get_unreadCount(self, obj):
        """Get count of unread messages for current user"""
        request = self.context.get('request')
        if request and request.user:
            return obj.messages.filter(is_read=False).exclude(sender=request.user).count()
        return 0
    
    def to_representation(self, instance):
        ret = super().to_representation(instance)
        ret['participants'] = self.get_participants(instance)
        ret['otherParticipant'] = self.get_otherParticipant(instance)
        ret['lastMessage'] = self.get_lastMessage(instance)
        ret['unreadCount'] = self.get_unreadCount(instance)
        ret['createdAt'] = instance.created_at
        ret['updatedAt'] = instance.updated_at
        return ret

class NotificationSerializer(serializers.ModelSerializer):
    """Serializer for Notification model"""
    
    class Meta:
        model = Notification
        fields = ['id', 'type', 'title', 'message', 'message_id', 'email_id', 'contact_id', 'event_id', 'data', 'is_read', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def to_representation(self, instance):
        ret = super().to_representation(instance)
        ret['createdAt'] = instance.created_at
        ret['updatedAt'] = instance.updated_at
        return ret

class NotificationPreferenceSerializer(serializers.ModelSerializer):
    """Serializer for NotificationPreference model"""
    roleId = serializers.CharField(source='role.id', read_only=True)
    roleName = serializers.CharField(source='role.name', read_only=True)
    notifyMessageReceived = serializers.BooleanField(source='notify_message_received')
    notifySensitiveContactModification = serializers.BooleanField(source='notify_sensitive_contact_modification')
    notifyContactEdit = serializers.BooleanField(source='notify_contact_edit')
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    updatedAt = serializers.DateTimeField(source='updated_at', read_only=True)
    
    class Meta:
        model = NotificationPreference
        fields = ['id', 'roleId', 'roleName', 'notifyMessageReceived', 'notifySensitiveContactModification', 'notifyContactEdit', 'createdAt', 'updatedAt']
        read_only_fields = ['id', 'roleId', 'roleName', 'createdAt', 'updatedAt']
    
    def to_representation(self, instance):
        ret = super().to_representation(instance)
        ret['roleId'] = instance.role.id
        ret['roleName'] = instance.role.name
        ret['notifyMessageReceived'] = instance.notify_message_received
        ret['notifySensitiveContactModification'] = instance.notify_sensitive_contact_modification
        ret['notifyContactEdit'] = instance.notify_contact_edit
        ret['createdAt'] = instance.created_at
        ret['updatedAt'] = instance.updated_at
        return ret

