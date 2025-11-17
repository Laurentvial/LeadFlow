from django.contrib.auth.models import User as DjangoUser
from rest_framework import serializers
from .models import Contact, Note, UserDetails, Team, Event, TeamMember, Log, Role, Permission, PermissionRole, Status, Source, Document
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

class NoteSerializer(serializers.ModelSerializer):
    contactId = serializers.PrimaryKeyRelatedField(queryset=Contact.objects.all(), required=False, allow_null=True)
    
    class Meta:
        model = Note
        fields = ['id', 'contactId', 'userId', 'text', 'created_at', 'updated_at']
        extra_kwargs = {
            'userId': {'read_only': True},
            'id': {'required': False}
        }
    
    def to_representation(self, instance):
        ret = super().to_representation(instance)
        # Expose contactId as string ID in API response
        ret['contactId'] = instance.contactId.id if instance.contactId else None
        return ret
    
    def to_internal_value(self, data):
        return super().to_internal_value(data)

class ContactSerializer(serializers.ModelSerializer):
    firstName = serializers.SerializerMethodField()
    lastName = serializers.SerializerMethodField()
    fullName = serializers.SerializerMethodField()
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    source = serializers.SerializerMethodField()
    
    class Meta:
        model = Contact
        fields = '__all__'
    
    def get_firstName(self, obj):
        return obj.fname
    
    def get_lastName(self, obj):
        return obj.lname
    
    def get_fullName(self, obj):
        return f"{obj.fname} {obj.lname}".strip()
    
    
    def get_source(self, obj):
        if obj.source:
            return obj.source.name
        return ''
    
    def to_representation(self, instance):
        ret = super().to_representation(instance)
        # S'assurer que tous les champs sont présents et convertir en camelCase
        ret['firstName'] = instance.fname
        ret['lastName'] = instance.lname
        ret['fullName'] = f"{instance.fname} {instance.lname}".strip()
        ret['createdAt'] = instance.created_at
        ret['source'] = instance.source.name if instance.source else ''
        ret['sourceId'] = instance.source.id if instance.source else None
        ret['statusId'] = instance.status.id if instance.status else None
        ret['statusName'] = instance.status.name if instance.status else ''
        ret['statusColor'] = instance.status.color if instance.status else ''
        ret['addressComplement'] = instance.address_complement or ''
        ret['campaign'] = instance.campaign or ''
        ret['teleoperatorId'] = instance.teleoperator.id if instance.teleoperator else None
        ret['teleoperatorName'] = f"{instance.teleoperator.first_name} {instance.teleoperator.last_name}".strip() if instance.teleoperator else ''
        ret['confirmateurId'] = instance.confirmateur.id if instance.confirmateur else None
        ret['confirmateurName'] = f"{instance.confirmateur.first_name} {instance.confirmateur.last_name}".strip() if instance.confirmateur else ''
        ret['creatorId'] = instance.creator.id if instance.creator else None
        ret['creatorName'] = f"{instance.creator.first_name} {instance.creator.last_name}".strip() if instance.creator else ''
        
        # Manager is the teleoperator (the one selected in teleoperateur select during creation)
        if instance.teleoperator:
            ret['managerId'] = str(instance.teleoperator.id)
            ret['manager'] = str(instance.teleoperator.id)
            ret['managerName'] = ret['teleoperatorName']
            ret['managerEmail'] = instance.teleoperator.email or ''
            try:
                teleoperator_user_details = instance.teleoperator.user_details
                ret['managerUserDetailsId'] = teleoperator_user_details.id if teleoperator_user_details else None
                teleoperator_team_member = teleoperator_user_details.team_memberships.first() if teleoperator_user_details else None
                if teleoperator_team_member:
                    ret['managerTeamId'] = teleoperator_team_member.team.id
                    ret['managerTeamName'] = teleoperator_team_member.team.name
                else:
                    ret['managerTeamId'] = None
                    ret['managerTeamName'] = ''
            except:
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
        return obj.phone if obj.phone else ''

    def get_mobile(self, obj):
        # mobile field does not exist on UserDetails; return empty string
        return ''

    def get_teamId(self, obj):
        # Get team from TeamMember relationship
        team_member = obj.team_memberships.first()
        return team_member.team.id if team_member else None
    
    def get_permissions(self, obj):
        """Get all permissions for the user's role"""
        if not obj.role:
            return []
        
        # Get all PermissionRole objects for this role
        permission_roles = obj.role.permission_roles.select_related('permission').all()
        
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
        # Get teamId from TeamMember relationship
        team_member = instance.team_memberships.first()
        ret['teamId'] = team_member.team.id if team_member else None
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
    contactName = serializers.SerializerMethodField()
    createdBy = serializers.SerializerMethodField()
    
    class Meta:
        model = Event
        fields = ['id', 'datetime', 'userId', 'contactId', 'comment', 'created_at', 'updated_at', 'contactName', 'createdBy']
        extra_kwargs = {
            'userId': {'read_only': True},
            'id': {'required': False}
        }
    
    def get_contactName(self, obj):
        if obj.contactId:
            return f"{obj.contactId.fname} {obj.contactId.lname}"
        return None
    
    def get_contactName(self, obj):
        # Backward compatibility alias
        return self.get_contactName(obj)
    
    def get_createdBy(self, obj):
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
    
    class Meta:
        model = Status
        fields = ['id', 'name', 'type', 'color', 'orderIndex', 'createdAt', 'updatedAt']
        read_only_fields = ['id', 'createdAt', 'updatedAt']
    
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
    
    class Meta:
        model = Permission
        fields = ['id', 'component', 'fieldName', 'action', 'statusId', 'createdAt', 'updatedAt']
        read_only_fields = ['id', 'createdAt', 'updatedAt']
    
    def create(self, validated_data):
        # Remove statusId from validated_data as it's not a model field
        status_id = validated_data.pop('statusId', None)
        status = None
        if status_id:
            try:
                status = Status.objects.get(id=status_id)
            except Status.DoesNotExist:
                pass
        
        # Create the permission with status
        # Extra kwargs from serializer.save() (like id, action) are already in validated_data
        permission = Permission.objects.create(**validated_data, status=status)
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
        ret['statusId'] = instance.status.id if instance.status else None
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

