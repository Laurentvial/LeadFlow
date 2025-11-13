from django.contrib.auth.models import User as DjangoUser
from rest_framework import serializers
from .models import Client, Note, UserDetails, Team, Event, TeamMember, Log, Asset, ClientAsset, RIB, ClientRIB, UsefulLink, ClientUsefulLink, Transaction
import uuid

class UserSerializer(serializers.ModelSerializer):
    first_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    last_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    role = serializers.CharField(write_only=True, required=False, default='0')
    phone = serializers.CharField(write_only=True, required=False, allow_blank=True)
    teamId = serializers.CharField(write_only=True, required=False, allow_null=True, allow_blank=True)
    
    class Meta:
        model = DjangoUser
        fields = ['id', 'username', 'email', 'password', 'first_name', 'last_name', 'role', 'phone', 'teamId']
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
        role = validated_data.pop('role', '0')
        phone = validated_data.pop('phone', '')
        # Ensure role doesn't exceed 12 characters (database constraint)
        role = str(role)[:12] if role else '0'
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
    class Meta:
        model = Note
        fields = ['id', 'clientId', 'userId', 'text', 'created_at', 'updated_at']
        extra_kwargs = {
            'userId': {'read_only': True},
            'clientId': {'required': False, 'allow_null': True},
            'id': {'required': False}
        }

class ClientSerializer(serializers.ModelSerializer):
    firstName = serializers.SerializerMethodField()
    lastName = serializers.SerializerMethodField()
    fullName = serializers.SerializerMethodField()
    teamId = serializers.SerializerMethodField()
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    capital = serializers.SerializerMethodField()
    manager = serializers.SerializerMethodField()
    source = serializers.SerializerMethodField()
    
    class Meta:
        model = Client
        fields = '__all__'
    
    def get_firstName(self, obj):
        return obj.fname
    
    def get_lastName(self, obj):
        return obj.lname
    
    def get_fullName(self, obj):
        return f"{obj.fname} {obj.lname}".strip()
    
    def get_teamId(self, obj):
        # Retourner l'ID de l'équipe si elle existe
        return obj.team.id if obj.team else None
    
    def get_capital(self, obj):
        return float(obj.total_wealth) if obj.total_wealth else 0
    
    def get_manager(self, obj):
        return obj.managed_by or ''
    
    def get_source(self, obj):
        # Source n'existe pas dans le modèle, retourner vide pour l'instant
        return ''
    
    def to_representation(self, instance):
        ret = super().to_representation(instance)
        # S'assurer que tous les champs sont présents et convertir en camelCase
        ret['firstName'] = instance.fname
        ret['lastName'] = instance.lname
        ret['fullName'] = f"{instance.fname} {instance.lname}".strip()
        ret['createdAt'] = instance.created_at
        ret['capital'] = float(instance.total_wealth) if instance.total_wealth else 0
        ret['source'] = instance.source or ''
        ret['teamId'] = instance.team.id if instance.team else None
        ret['teamName'] = instance.team.name if instance.team else ''
        
        # Get manager user details if managed_by is set
        # managed_by should always contain the user ID
        manager_user = None
        manager_id = None
        if instance.managed_by:
            try:
                # Try to find user by ID first (managed_by should be an ID)
                try:
                    # Check if managed_by is a numeric ID
                    manager_id = int(instance.managed_by)
                    manager_user = DjangoUser.objects.filter(id=manager_id).first()
                except (ValueError, TypeError):
                    # If not numeric, try as username (for backward compatibility)
                    manager_user = DjangoUser.objects.filter(username=instance.managed_by).first()
                    if manager_user:
                        manager_id = manager_user.id
            except Exception:
                pass
        
        if manager_user:
            ret['managerId'] = str(manager_user.id)  # DjangoUser.id
            ret['manager'] = str(manager_user.id)  # Always return the ID, not the username
            ret['managerName'] = f"{manager_user.first_name} {manager_user.last_name}".strip() or manager_user.username
            ret['managerEmail'] = manager_user.email or ''
            # Get manager's team and UserDetails ID for frontend compatibility
            try:
                manager_user_details = manager_user.user_details
                ret['managerUserDetailsId'] = manager_user_details.id  # UserDetails.id for Select component
                manager_team_member = manager_user_details.team_memberships.first()
                if manager_team_member:
                    ret['managerTeamId'] = manager_team_member.team.id
                    ret['managerTeamName'] = manager_team_member.team.name
                else:
                    ret['managerTeamId'] = None
                    ret['managerTeamName'] = ''
            except:
                ret['managerUserDetailsId'] = None
                ret['managerTeamId'] = None
                ret['managerTeamName'] = ''
        else:
            ret['managerId'] = None
            ret['manager'] = instance.managed_by or ''  # Keep original value if user not found
            ret['managerName'] = ''
            ret['managerEmail'] = ''
            ret['managerUserDetailsId'] = None
            ret['managerTeamId'] = None
            ret['managerTeamName'] = ''
        
        # Convertir les champs personnels de snake_case à camelCase
        if instance.profile_photo:
            request = self.context.get('request')
            if request:
                ret['profilePhoto'] = request.build_absolute_uri(instance.profile_photo.url)
            else:
                ret['profilePhoto'] = instance.profile_photo.url if instance.profile_photo else ''
        else:
            ret['profilePhoto'] = ''
        ret['civility'] = ret.get('civility', '') or ''
        ret['template'] = ret.get('template', '') or ''
        ret['support'] = ret.get('support', '') or ''
        ret['password'] = ret.get('password', '') or ''
        ret['platformAccess'] = bool(ret.get('platform_access', True))
        ret['active'] = bool(ret.get('active', True))
        ret['birthDate'] = instance.birth_date.isoformat() if instance.birth_date else None
        ret['birthPlace'] = ret.get('birth_place', '') or ''
        ret['address'] = ret.get('address', '') or ''
        ret['postalCode'] = ret.get('postal_code', '') or ''
        ret['city'] = ret.get('city', '') or ''
        ret['nationality'] = ret.get('nationality', '') or ''
        ret['successor'] = ret.get('successor', '') or ''
        
        # Convertir les champs patrimoniaux de snake_case à camelCase
        ret['professionalActivityStatus'] = ret.get('professional_activity_status', '') or ''
        ret['professionalActivityComment'] = ret.get('professional_activity_comment', '') or ''
        ret['professions'] = ret.get('professions', []) or []
        ret['professionsComment'] = ret.get('professions_comment', '') or ''
        ret['bankName'] = ret.get('bank_name', '') or ''
        ret['currentAccount'] = float(ret.get('current_account', 0) or 0)
        ret['livretAB'] = float(ret.get('livret_ab', 0) or 0)
        ret['pea'] = float(ret.get('pea', 0) or 0)
        ret['pel'] = float(ret.get('pel', 0) or 0)
        ret['ldd'] = float(ret.get('ldd', 0) or 0)
        ret['cel'] = float(ret.get('cel', 0) or 0)
        ret['csl'] = float(ret.get('csl', 0) or 0)
        ret['securitiesAccount'] = float(ret.get('securities_account', 0) or 0)
        ret['lifeInsurance'] = float(ret.get('life_insurance', 0) or 0)
        ret['savingsComment'] = ret.get('savings_comment', '') or ''
        ret['totalWealth'] = float(ret.get('total_wealth', 0) or 0)
        ret['objectives'] = ret.get('objectives', []) or []
        ret['objectivesComment'] = ret.get('objectives_comment', '') or ''
        ret['experience'] = ret.get('experience', []) or []
        ret['experienceComment'] = ret.get('experience_comment', '') or ''
        ret['taxOptimization'] = bool(ret.get('tax_optimization', False))
        ret['taxOptimizationComment'] = ret.get('tax_optimization_comment', '') or ''
        ret['annualHouseholdIncome'] = float(ret.get('annual_household_income', 0) or 0)
        
        # Convertir les champs wallet de snake_case à camelCase
        ret['investedCapital'] = float(ret.get('invested_capital', 0) or 0)
        ret['tradingPortfolio'] = float(ret.get('trading_portfolio', 0) or 0)
        ret['bonus'] = float(ret.get('bonus', 0) or 0)
        # availableFunds is calculated on frontend
        
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
    
    def to_representation(self, instance):
        ret = super().to_representation(instance)
        ret['isLeader'] = instance.role == 'teamleader'
        # Get teamId from TeamMember relationship
        team_member = instance.team_memberships.first()
        ret['teamId'] = team_member.team.id if team_member else None
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
            'role': user_details.role,
        }
    
    def get_isLeader(self, obj):
        return obj.user.role == 'teamleader'

class TeamDetailSerializer(serializers.Serializer):
    team = TeamSerializer()
    members = TeamMemberSerializer(many=True, source='team_members')

class EventSerializer(serializers.ModelSerializer):
    clientId = serializers.CharField(write_only=True, required=False, allow_null=True, allow_blank=True)
    clientId_read = serializers.CharField(source='clientId.id', read_only=True, allow_null=True)
    clientName = serializers.SerializerMethodField()
    createdBy = serializers.SerializerMethodField()
    
    class Meta:
        model = Event
        fields = ['id', 'datetime', 'userId', 'clientId', 'clientId_read', 'comment', 'created_at', 'updated_at', 'clientName', 'createdBy']
        extra_kwargs = {
            'userId': {'read_only': True},
            'id': {'required': False}
        }
    
    def get_clientName(self, obj):
        if obj.clientId:
            return f"{obj.clientId.fname} {obj.clientId.lname}"
        return None
    
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
        ret['clientId'] = ret.pop('clientId_read', None)
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
    eventType = serializers.CharField(source='event_type', read_only=True)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    oldValue = serializers.JSONField(source='old_value', read_only=True)
    newValue = serializers.JSONField(source='new_value', read_only=True)
    
    class Meta:
        model = Log
        fields = ['id', 'eventType', 'userId', 'createdAt', 'details', 'oldValue', 'newValue']
        read_only_fields = ['id', 'createdAt']
    
    def get_userId(self, obj):
        return obj.user_id.id if obj.user_id else None
    
    def to_representation(self, instance):
        ret = super().to_representation(instance)
        ret['eventType'] = instance.event_type
        ret['userId'] = instance.user_id.id if instance.user_id else None
        ret['createdAt'] = instance.created_at
        ret['details'] = instance.details if instance.details else {}
        ret['oldValue'] = instance.old_value if instance.old_value else {}
        ret['newValue'] = instance.new_value if instance.new_value else {}
        return ret

class AssetSerializer(serializers.ModelSerializer):
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    updatedAt = serializers.DateTimeField(source='updated_at', read_only=True)
    
    class Meta:
        model = Asset
        fields = ['id', 'type', 'name', 'reference', 'category', 'subcategory', 'default', 'createdAt', 'updatedAt']
        read_only_fields = ['id', 'createdAt', 'updatedAt']
    
    def to_representation(self, instance):
        ret = super().to_representation(instance)
        ret['default'] = bool(instance.default)
        ret['createdAt'] = instance.created_at
        ret['updatedAt'] = instance.updated_at
        return ret

class ClientAssetSerializer(serializers.ModelSerializer):
    asset = AssetSerializer(read_only=True)
    assetId = serializers.CharField(write_only=True, required=False)
    clientId = serializers.CharField(source='client.id', read_only=True)
    featured = serializers.BooleanField()
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    updatedAt = serializers.DateTimeField(source='updated_at', read_only=True)
    
    class Meta:
        model = ClientAsset
        fields = ['id', 'clientId', 'asset', 'assetId', 'featured', 'createdAt', 'updatedAt']
        read_only_fields = ['id', 'createdAt', 'updatedAt']
    
    def to_representation(self, instance):
        ret = super().to_representation(instance)
        ret['clientId'] = instance.client.id
        ret['asset'] = AssetSerializer(instance.asset).data
        ret['featured'] = bool(instance.featured)
        ret['createdAt'] = instance.created_at
        ret['updatedAt'] = instance.updated_at
        return ret

class RIBSerializer(serializers.ModelSerializer):
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    updatedAt = serializers.DateTimeField(source='updated_at', read_only=True)
    bankName = serializers.CharField(source='bank_name', required=False, allow_blank=True)
    accountHolder = serializers.CharField(source='account_holder', required=False, allow_blank=True)
    bankCode = serializers.CharField(source='bank_code', required=False, allow_blank=True)
    branchCode = serializers.CharField(source='branch_code', required=False, allow_blank=True)
    accountNumber = serializers.CharField(source='account_number', required=False, allow_blank=True)
    ribKey = serializers.CharField(source='rib_key', required=False, allow_blank=True)
    
    class Meta:
        model = RIB
        fields = ['id', 'name', 'iban', 'bic', 'bankName', 'accountHolder', 'bankCode', 'branchCode', 'accountNumber', 'ribKey', 'domiciliation', 'default', 'createdAt', 'updatedAt']
        read_only_fields = ['id', 'createdAt', 'updatedAt']
    
    def to_representation(self, instance):
        ret = super().to_representation(instance)
        ret['bankName'] = instance.bank_name
        ret['accountHolder'] = instance.account_holder
        ret['bankCode'] = instance.bank_code
        ret['branchCode'] = instance.branch_code
        ret['accountNumber'] = instance.account_number
        ret['ribKey'] = instance.rib_key
        ret['default'] = bool(instance.default)
        ret['createdAt'] = instance.created_at
        ret['updatedAt'] = instance.updated_at
        return ret

class ClientRIBSerializer(serializers.ModelSerializer):
    rib = RIBSerializer(read_only=True)
    ribId = serializers.CharField(write_only=True, required=False)
    clientId = serializers.CharField(source='client.id', read_only=True)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    updatedAt = serializers.DateTimeField(source='updated_at', read_only=True)
    
    class Meta:
        model = ClientRIB
        fields = ['id', 'clientId', 'rib', 'ribId', 'createdAt', 'updatedAt']
        read_only_fields = ['id', 'createdAt', 'updatedAt']
    
    def to_representation(self, instance):
        ret = super().to_representation(instance)
        ret['clientId'] = instance.client.id
        ret['rib'] = RIBSerializer(instance.rib).data
        ret['createdAt'] = instance.created_at
        ret['updatedAt'] = instance.updated_at
        return ret

class UsefulLinkSerializer(serializers.ModelSerializer):
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    updatedAt = serializers.DateTimeField(source='updated_at', read_only=True)
    imageUrl = serializers.SerializerMethodField()
    
    class Meta:
        model = UsefulLink
        fields = ['id', 'name', 'url', 'description', 'image', 'imageUrl', 'default', 'createdAt', 'updatedAt']
        read_only_fields = ['id', 'createdAt', 'updatedAt', 'imageUrl']
    
    def get_imageUrl(self, obj):
        if obj.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None
    
    def to_representation(self, instance):
        ret = super().to_representation(instance)
        ret['default'] = bool(instance.default)
        ret['createdAt'] = instance.created_at
        ret['updatedAt'] = instance.updated_at
        if instance.image:
            request = self.context.get('request')
            if request:
                ret['imageUrl'] = request.build_absolute_uri(instance.image.url)
            else:
                ret['imageUrl'] = instance.image.url
        else:
            ret['imageUrl'] = None
        return ret

class ClientUsefulLinkSerializer(serializers.ModelSerializer):
    usefulLink = UsefulLinkSerializer(source='useful_link', read_only=True)
    usefulLinkId = serializers.CharField(write_only=True, required=False)
    clientId = serializers.CharField(source='client.id', read_only=True)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    updatedAt = serializers.DateTimeField(source='updated_at', read_only=True)
    
    class Meta:
        model = ClientUsefulLink
        fields = ['id', 'clientId', 'usefulLink', 'usefulLinkId', 'createdAt', 'updatedAt']
        read_only_fields = ['id', 'createdAt', 'updatedAt']
    
    def to_representation(self, instance):
        ret = super().to_representation(instance)
        ret['clientId'] = instance.client.id
        # Pass the request context to UsefulLinkSerializer so it can build absolute URLs
        request = self.context.get('request')
        ret['usefulLink'] = UsefulLinkSerializer(instance.useful_link, context={'request': request}).data
        ret['createdAt'] = instance.created_at
        ret['updatedAt'] = instance.updated_at
        return ret

class TransactionSerializer(serializers.ModelSerializer):
    clientId = serializers.CharField(source='client.id', read_only=True)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    updatedAt = serializers.DateTimeField(source='updated_at', read_only=True)
    
    class Meta:
        model = Transaction
        fields = ['id', 'clientId', 'type', 'amount', 'description', 'status', 'datetime', 'createdAt', 'updatedAt']
        read_only_fields = ['id', 'createdAt', 'updatedAt']
    
    def to_representation(self, instance):
        ret = super().to_representation(instance)
        ret['clientId'] = instance.client.id
        ret['createdAt'] = instance.created_at
        ret['updatedAt'] = instance.updated_at
        return ret
