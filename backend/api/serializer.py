from django.contrib.auth.models import User as DjangoUser
from rest_framework import serializers
from .models import Contact, Note, NoteCategory, UserDetails, Team, Event, TeamMember, Log, Role, Permission, PermissionRole, Status, Source, Platform, Document, SMTPConfig, Email, EmailSignature, ChatRoom, Message, Notification, NotificationPreference, FosseSettings
from django.db import transaction
import uuid

class UserSerializer(serializers.ModelSerializer):
    first_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    last_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    roleId = serializers.CharField(write_only=True, required=False, allow_null=True, allow_blank=True)
    role = serializers.CharField(write_only=True, required=False, allow_null=True, allow_blank=True)
    phone = serializers.CharField(write_only=True, required=False, allow_blank=True, allow_null=True)
    teamId = serializers.CharField(write_only=True, required=False, allow_null=True, allow_blank=True)
    hrex = serializers.CharField(write_only=True, required=False, allow_blank=True, max_length=7)
    requireOtp = serializers.BooleanField(write_only=True, required=False, default=False)
    
    class Meta:
        model = DjangoUser
        fields = ['id', 'username', 'email', 'password', 'first_name', 'last_name', 'roleId', 'role', 'phone', 'teamId', 'hrex', 'requireOtp']
        extra_kwargs = {
            'password': {'write_only': True},
            'email': {'required': False, 'allow_blank': True},
            'username': {'required': False, 'allow_blank': True}
        }
    
    def validate_phone(self, value):
        """Convert empty strings to None for phone field."""
        if value is None or value == '' or (isinstance(value, str) and not value.strip()):
            return None
        return value
    
    def validate_username(self, value):
        """Validate username: strip whitespace and check for case-insensitive duplicates."""
        # Username is optional if email is provided (will be set in validate method)
        if value:
            value = value.strip()
            # Check for case-insensitive duplicate
            existing_user = DjangoUser.objects.filter(username__iexact=value).first()
            if existing_user:
                # Check if UserDetails exists - if not, this is an orphaned user that we can clean up
                try:
                    existing_user.user_details
                    # UserDetails exists, so this is a real duplicate
                    raise serializers.ValidationError("A user with that username already exists.")
                except UserDetails.DoesNotExist:
                    # Orphaned user - delete it so we can create a new one
                    existing_user.delete()
        return value
    
    def validate(self, data):
        """Use email as username if username is not provided."""
        email = data.get('email', '').strip() if data.get('email') else ''
        username = data.get('username', '').strip() if data.get('username') else ''
        
        # Helper function to check and handle existing user
        def check_existing_user(email_to_check):
            existing_user = DjangoUser.objects.filter(username__iexact=email_to_check).first()
            if existing_user:
                # Check if UserDetails exists - if not, this is an orphaned user that we can clean up
                try:
                    user_details = existing_user.user_details
                    # UserDetails exists - check if user is soft-deleted
                    if user_details.deleted_at is not None:
                        # User is soft-deleted - store info for reactivation
                        data['_reactivate_user'] = existing_user
                        data['_reactivate_user_details'] = user_details
                        return  # Allow creation to proceed (will reactivate in create method)
                    else:
                        # UserDetails exists and user is not deleted - this is a real duplicate
                        raise serializers.ValidationError({"email": "A user with this email already exists."})
                except UserDetails.DoesNotExist:
                    # Orphaned user - delete it so we can create a new one
                    existing_user.delete()
        
        # If email is provided and username is not, use email as username
        if email and not username:
            data['username'] = email
            check_existing_user(email)
        
        # If both are provided but different, use email as username
        elif email and username and email != username:
            data['username'] = email
            check_existing_user(email)
        
        # Ensure username is set
        if not data.get('username'):
            raise serializers.ValidationError({"email": "Email is required when username is not provided."})
        
        return data

    def create(self, validated_data):
        # Use atomic transaction to ensure both DjangoUser and UserDetails are created together
        # If UserDetails creation fails, DjangoUser creation will be rolled back
        with transaction.atomic():
            # Check if we're reactivating a soft-deleted user
            reactivate_user = validated_data.pop('_reactivate_user', None)
            reactivate_user_details = validated_data.pop('_reactivate_user_details', None)
            
            # Extract UserDetails fields
            first_name = validated_data.pop('first_name', '')
            last_name = validated_data.pop('last_name', '')
            role_id = validated_data.pop('roleId', None)
            role_name = validated_data.pop('role', None)
            # Extract phone and normalize empty strings to None
            phone_raw = validated_data.pop('phone', None)
            if phone_raw is None or phone_raw == '' or (isinstance(phone_raw, str) and not phone_raw.strip()):
                phone = None
            else:
                phone = phone_raw
            team_id = validated_data.pop('teamId', None)
            hrex = validated_data.pop('hrex', '')
            require_otp = validated_data.pop('requireOtp', False)
            
            # Get and normalize username (already validated and stripped in validate_username)
            username = validated_data.get('username', '').strip()
            
            # If reactivating, update existing user; otherwise create new one
            if reactivate_user and reactivate_user_details:
                # Reactivate existing user
                user = reactivate_user
                # Update user fields
                if validated_data.get('password'):
                    user.set_password(validated_data.get('password'))
                user.email = validated_data.get('email', '').strip() if validated_data.get('email') else user.email
                user.first_name = first_name.strip() if first_name else user.first_name
                user.last_name = last_name.strip() if last_name else user.last_name
                user.save()
                
                # Use existing UserDetails
                user_details = reactivate_user_details
            else:
                # Create Django User
                user = DjangoUser.objects.create_user(
                    username=username,
                    email=validated_data.get('email', '').strip() if validated_data.get('email') else '',
                    password=validated_data.get('password'),
                    first_name=first_name.strip() if first_name else '',
                    last_name=last_name.strip() if last_name else ''
                )

            # Get role if role_id or role_name provided
            role_obj = None
            if role_id:
                try:
                    role_obj = Role.objects.get(id=role_id)
                except Role.DoesNotExist:
                    pass  # Role will be None if not found
            elif role_name:
                # Try to find role by name (case-insensitive)
                try:
                    role_obj = Role.objects.get(name__iexact=role_name.strip())
                except Role.DoesNotExist:
                    pass  # Role will be None if not found
            
            # Convert phone to integer if provided, otherwise None
            # Handle empty string, None, or whitespace-only strings
            phone_value = None
            # Normalize phone: convert empty string to None
            if phone is None or phone == '' or (isinstance(phone, str) and not phone.strip()):
                phone_value = None
            else:
                phone_str = str(phone).strip()
                # Only process if there's actual content after stripping
                if phone_str and phone_str not in ['', 'None', 'null']:
                    try:
                        # Remove all spaces and non-digit characters except + at start
                        cleaned = ''.join(phone_str.split())
                        # Remove + if present at start
                        if cleaned.startswith('+'):
                            cleaned = cleaned[1:]
                        if cleaned and cleaned.isdigit():
                            phone_value = int(cleaned)
                        else:
                            phone_value = None
                    except (ValueError, TypeError):
                        phone_value = None
            
            # Final safety check: ensure phone_value is never an empty string
            if phone_value == '' or (isinstance(phone_value, str) and not phone_value.strip()):
                phone_value = None
            
            # Handle UserDetails creation or update
            if reactivate_user and reactivate_user_details:
                # Update existing UserDetails for reactivation
                user_details = reactivate_user_details
                # Update fields
                if role_obj is not None:
                    user_details.role_id = role_obj
                if phone_value is not None:
                    user_details.phone = phone_value
                if hrex:
                    user_details.hrex = hrex.strip()
                user_details.require_otp = require_otp
                # Reactivate by setting deleted_at to None
                user_details.deleted_at = None
                user_details.active = True
                user_details.save()
                print(f"[DEBUG] UserDetails reactivated successfully: {user_details.id}")
            else:
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
                
                # Ensure user_details_id is not empty
                if not user_details_id:
                    user_details_id = uuid.uuid4().hex[:12]
                
                # Create UserDetails entry for this user
                # Use role_id directly instead of role property to avoid potential setter issues
                try:
                    # Debug logging
                    print(f"[DEBUG] Creating UserDetails: id={user_details_id}, django_user_id={user.id}, role_id={role_obj.id if role_obj else None}, phone={phone_value} (type: {type(phone_value)}), hrex={hrex.strip() if hrex else ''}")
                    
                    user_details = UserDetails.objects.create(
                        id=user_details_id,
                        django_user=user,
                        role_id=role_obj,  # Use role_id directly instead of role property
                        phone=phone_value,  # This should always be None or an integer, never an empty string
                        hrex=hrex.strip() if hrex else '',
                        require_otp=require_otp
                    )
                    print(f"[DEBUG] UserDetails created successfully: {user_details.id}")
                except Exception as e:
                    # Transaction will rollback automatically, but let's provide a clear error
                    import traceback
                    error_details = traceback.format_exc()
                    print(f"[ERROR] Failed to create UserDetails: {str(e)}")
                    print(f"[ERROR] Traceback: {error_details}")
                    raise serializers.ValidationError({
                        'non_field_errors': [f'Failed to create user details: {str(e)}'],
                        'error_details': error_details
                    })
            
            # Create TeamMember if teamId provided
            if team_id:
                try:
                    team = Team.objects.get(id=team_id)
                    # Check if TeamMember already exists for this user and team
                    existing_team_member = TeamMember.objects.filter(user=user_details, team=team).first()
                    if not existing_team_member:
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
    
    def get_user_accessible_category_ids(self, user):
        """Get list of note category IDs the user has view permission for"""
        from .models import UserDetails, Permission, PermissionRole
        
        try:
            # Optimize query with select_related and prefetch_related
            user_details = UserDetails.objects.select_related('role_id').prefetch_related(
                'role_id__permission_roles__permission'
            ).get(django_user=user)
            
            if not user_details.role_id:
                # No role - return empty list (no access)
                return []
            
            role = user_details.role_id
            
            # Get all permission roles for this role - already prefetched, so no additional query
            permission_roles = role.permission_roles.all()
            
            # Build sets of permission IDs for faster lookup
            category_permission_field_names = set()
            
            for perm_role in permission_roles:
                # Permission is already prefetched, so this won't cause additional queries
                perm = perm_role.permission
                if (perm.component == 'note_categories' and 
                    perm.action == 'view' and 
                    perm.field_name is None and 
                    perm.status is None):
                    # User has general permission - can see all categories
                    return None
                elif (perm.component == 'note_categories' and 
                      perm.action == 'view' and 
                      perm.field_name is not None):
                    # Specific category permission
                    category_permission_field_names.add(perm.field_name)
            
            # If we have specific category permissions, return them
            if category_permission_field_names:
                # Ensure all category IDs are strings and strip whitespace (NoteCategory.id is CharField)
                return [str(cat_id).strip() for cat_id in category_permission_field_names if cat_id]
            else:
                # No permissions found - return empty list
                return []
        except UserDetails.DoesNotExist:
            # User has no UserDetails - return empty list (no access)
            return []
        except Exception as e:
            # If there's any error (e.g., NoteCategory doesn't exist yet), allow all notes
            # This prevents errors when the database hasn't been migrated yet
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Error checking note category permissions in ContactSerializer: {e}")
            return None  # Allow all notes if there's an error
    
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
        # Import UserDetails once at the top
        from .models import UserDetails
        
        # S'assurer que tous les champs sont présents et convertir en camelCase
        ret['firstName'] = instance.fname
        ret['lastName'] = instance.lname
        ret['fullName'] = f"{instance.fname} {instance.lname}".strip()
        ret['createdAt'] = instance.created_at
        ret['updatedAt'] = instance.updated_at
        ret['source'] = instance.source.name if instance.source else ''
        ret['sourceId'] = instance.source_id if hasattr(instance, 'source_id') else (instance.source.id if instance.source else None)
        ret['statusId'] = instance.status_id if hasattr(instance, 'status_id') else (instance.status.id if instance.status else None)
        ret['statusName'] = instance.status.name if instance.status else ''
        ret['statusColor'] = instance.status.color if instance.status else ''
        ret['addressComplement'] = instance.address_complement or ''
        ret['campaign'] = instance.campaign or ''
        # Get UserDetails ID for teleoperator (not Django User ID)
        if instance.teleoperator:
            try:
                user_details = instance.teleoperator.user_details
                ret['teleoperatorId'] = user_details.id if user_details else None
            except UserDetails.DoesNotExist:
                ret['teleoperatorId'] = None
            first_name = getattr(instance.teleoperator, 'first_name', '') or ''
            last_name = getattr(instance.teleoperator, 'last_name', '') or ''
            ret['teleoperatorName'] = f"{first_name} {last_name}".strip()
        else:
            ret['teleoperatorId'] = None
            ret['teleoperatorName'] = ''
        # Get UserDetails ID for confirmateur (not Django User ID)
        if instance.confirmateur:
            try:
                user_details = instance.confirmateur.user_details
                ret['confirmateurId'] = user_details.id if user_details else None
            except UserDetails.DoesNotExist:
                ret['confirmateurId'] = None
            first_name = getattr(instance.confirmateur, 'first_name', '') or ''
            last_name = getattr(instance.confirmateur, 'last_name', '') or ''
            ret['confirmateurName'] = f"{first_name} {last_name}".strip()
        else:
            ret['confirmateurId'] = None
            ret['confirmateurName'] = ''
        # Get UserDetails ID for creator (not Django User ID)
        if instance.creator:
            try:
                user_details = instance.creator.user_details
                ret['creatorId'] = user_details.id if user_details else None
            except UserDetails.DoesNotExist:
                ret['creatorId'] = None
            first_name = getattr(instance.creator, 'first_name', '') or ''
            last_name = getattr(instance.creator, 'last_name', '') or ''
            ret['creatorName'] = f"{first_name} {last_name}".strip()
        else:
            ret['creatorId'] = None
            ret['creatorName'] = ''
        # Phone and mobile are handled by SerializerMethodField - use the methods
        ret['phone'] = self.get_phone(instance)
        ret['mobile'] = self.get_mobile(instance)
        # Confirmateur email and telephone
        ret['confirmateurEmail'] = instance.confirmateur_email if hasattr(instance, 'confirmateur_email') else ''
        ret['confirmateurTelephone'] = instance.confirmateur_telephone if hasattr(instance, 'confirmateur_telephone') else ''
        
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
        
        # Confirmateur fields
        ret['platformId'] = instance.platform_id if hasattr(instance, 'platform_id') else (instance.platform.id if instance.platform else None)
        ret['platform'] = instance.platform.name if instance.platform else ''
        ret['montantEncaisse'] = str(instance.montant_encaisse) if instance.montant_encaisse is not None else ''
        ret['bonus'] = str(instance.bonus) if instance.bonus is not None else ''
        ret['paiement'] = instance.paiement or ''
        ret['contrat'] = instance.contrat or ''
        ret['nomDeScene'] = instance.nom_de_scene or ''
        ret['dateProTr'] = instance.date_pro_tr or ''
        ret['potentiel'] = instance.potentiel or ''
        ret['produit'] = instance.produit or ''
        
        # Add notes information
        # Use prefetched data if available, otherwise query
        if hasattr(instance, '_prefetched_objects_cache') and 'contact_notes' in instance._prefetched_objects_cache:
            notes_list = list(instance._prefetched_objects_cache['contact_notes'])
        else:
            notes = instance.contact_notes.all()
            notes_list = list(notes)
        
        # No permission filtering - return all notes
        # Permissions are enforced at the tab level in the frontend
        
        # Sort notes by created_at descending to ensure latest note is first
        from datetime import datetime
        notes_list = sorted(notes_list, key=lambda n: n.created_at if n.created_at else datetime.min, reverse=True)
        
        notes_count = len(notes_list)
        latest_note = notes_list[0] if notes_list else None
        
        ret['notesCount'] = notes_count
        ret['notesLatestText'] = latest_note.text[:100] if latest_note else ''  # First 100 chars
        ret['hasNotes'] = notes_count > 0
        
        # Add most recent log date (from annotated field if available, otherwise query)
        if hasattr(instance, 'last_log_date'):
            ret['lastLogDate'] = instance.last_log_date
        else:
            from .models import Log
            latest_log = Log.objects.filter(contact_id=instance).order_by('-created_at').first()
            ret['lastLogDate'] = latest_log.created_at if latest_log else None
        
        # Add previous status and previous teleoperator from logs (keep this for backward compatibility)
        # PERFORMANCE: Use prefetched logs if available to avoid N+1 queries
        previous_status = None
        previous_teleoperator = None
        
        # Get current status name for comparison
        current_status_name = instance.status.name if instance.status else ''
        
        # Use prefetched logs if available (from FosseContactView), otherwise query them
        if hasattr(instance, 'prefetched_edit_logs'):
            logs = instance.prefetched_edit_logs
        else:
            from .models import Log
            logs = Log.objects.filter(
                contact_id=instance,
                event_type='editContact'
            ).order_by('-created_at')[:50]  # Limit to 50 most recent logs for performance
        
        for log in logs:
            # Check for previous status - look for logs where statusName changed
            if previous_status is None and log.old_value and log.new_value:
                old_status = log.old_value.get('statusName', '')
                new_status = log.new_value.get('statusName', '')
                if old_status and old_status != new_status and new_status == current_status_name:
                    previous_status = old_status
            
            # Check for previous teleoperator
            if previous_teleoperator is None and log.old_value and log.new_value:
                old_teleoperator = log.old_value.get('teleoperatorName', '')
                new_teleoperator = log.new_value.get('teleoperatorName', '')
                if old_teleoperator and old_teleoperator != new_teleoperator:
                    previous_teleoperator = old_teleoperator
            
            if previous_status is not None and previous_teleoperator is not None:
                break
        
        # In Fosse context, if previous_status is empty, use cached default status from context
        # This avoids N+1 queries - the default status is looked up once in the view and cached
        if not previous_status:
            request = self.context.get('request')
            if request and '/fosse/' in request.path:
                # Use cached FosseSettings from context (set in FosseContactView.list)
                fosse_default_status_name = self.context.get('fosse_default_status_name')
                if fosse_default_status_name:
                    previous_status = fosse_default_status_name
        
        ret['previousStatus'] = previous_status or ''
        ret['previousTeleoperator'] = previous_teleoperator or ''
        
        # Add assignedAt field (from database field assigned_at)
        ret['assignedAt'] = instance.assigned_at.isoformat() if instance.assigned_at else None
        
        return ret

class ContactMigrationSerializer(serializers.ModelSerializer):
    """
    Simplified serializer for contact migration/bulk import operations.
    Optimized for performance and handles migration-specific needs.
    """
    # CamelCase field names for API compatibility
    firstName = serializers.CharField(source='fname', required=False, allow_blank=True)
    lastName = serializers.CharField(source='lname', required=False, allow_blank=True)
    phone = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    mobile = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    birthDate = serializers.DateField(source='birth_date', required=False, allow_null=True)
    birthPlace = serializers.CharField(source='birth_place', required=False, allow_blank=True)
    addressComplement = serializers.CharField(source='address_complement', required=False, allow_blank=True)
    postalCode = serializers.CharField(source='postal_code', required=False, allow_blank=True)
    statusId = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    sourceId = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    teleoperatorId = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    confirmateurId = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    creatorId = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    platformId = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    confirmateurEmail = serializers.EmailField(source='confirmateur_email', required=False, allow_blank=True)
    confirmateurTelephone = serializers.CharField(source='confirmateur_telephone', required=False, allow_blank=True)
    montantEncaisse = serializers.DecimalField(source='montant_encaisse', max_digits=10, decimal_places=2, required=False, allow_null=True)
    bonus = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, allow_null=True)
    nomDeScene = serializers.CharField(source='nom_de_scene', required=False, allow_blank=True)
    dateProTr = serializers.CharField(source='date_pro_tr', required=False, allow_blank=True)
    oldContactId = serializers.CharField(source='old_contact_id', required=False, allow_null=True, allow_blank=True)
    createdAt = serializers.DateTimeField(source='created_at', required=False, allow_null=True)
    updatedAt = serializers.DateTimeField(source='updated_at', required=False, allow_null=True)
    assignedAt = serializers.DateTimeField(source='assigned_at', required=False, allow_null=True)
    
    class Meta:
        model = Contact
        fields = [
            'id', 'oldContactId', 'firstName', 'lastName', 'civility', 'phone', 'mobile', 'email',
            'birthDate', 'birthPlace', 'address', 'addressComplement', 'postalCode', 'city', 'nationality',
            'statusId', 'sourceId', 'campaign', 'teleoperatorId', 'confirmateurId', 'creatorId',
            'platformId', 'confirmateurEmail', 'confirmateurTelephone', 'montantEncaisse', 'bonus',
            'paiement', 'contrat', 'nomDeScene', 'dateProTr', 'potentiel', 'produit',
            'createdAt', 'updatedAt', 'assignedAt'
        ]
        extra_kwargs = {
            'id': {'required': False},
        }
    
    def validate_phone(self, value):
        """Convert phone string to integer or None"""
        if not value or value == '' or (isinstance(value, str) and not value.strip()):
            return None
        # Remove spaces and non-digit characters except + at start
        cleaned = ''.join(str(value).split())
        if cleaned.startswith('+'):
            cleaned = cleaned[1:]
        if cleaned and cleaned.isdigit():
            try:
                return int(cleaned)
            except (ValueError, TypeError):
                return None
        return None
    
    def validate_mobile(self, value):
        """Convert mobile string to integer or None"""
        if not value or value == '' or (isinstance(value, str) and not value.strip()):
            return None
        # Remove spaces and non-digit characters except + at start
        cleaned = ''.join(str(value).split())
        if cleaned.startswith('+'):
            cleaned = cleaned[1:]
        if cleaned and cleaned.isdigit():
            try:
                return int(cleaned)
            except (ValueError, TypeError):
                return None
        return None
    
    def validate_statusId(self, value):
        """Validate statusId exists"""
        if not value or value == '':
            return None
        from .models import Status
        try:
            Status.objects.get(id=value)
            return value
        except Status.DoesNotExist:
            raise serializers.ValidationError(f"Status with id '{value}' does not exist.")
    
    def validate_sourceId(self, value):
        """Validate sourceId exists"""
        if not value or value == '':
            return None
        from .models import Source
        try:
            Source.objects.get(id=value)
            return value
        except Source.DoesNotExist:
            raise serializers.ValidationError(f"Source with id '{value}' does not exist.")
    
    def validate_platformId(self, value):
        """Validate platformId exists"""
        if not value or value == '':
            return None
        from .models import Platform
        try:
            Platform.objects.get(id=value)
            return value
        except Platform.DoesNotExist:
            raise serializers.ValidationError(f"Platform with id '{value}' does not exist.")
    
    def validate_teleoperatorId(self, value):
        """Validate teleoperatorId exists (can be Django User ID or UserDetails ID)"""
        if not value or value == '':
            return None
        from .models import UserDetails
        # Try UserDetails ID first
        try:
            user_details = UserDetails.objects.get(id=value)
            if user_details.django_user:
                return user_details.django_user.id
        except UserDetails.DoesNotExist:
            pass
        # Try Django User ID
        try:
            django_user = DjangoUser.objects.get(id=int(value))
            return django_user.id
        except (DjangoUser.DoesNotExist, ValueError, TypeError):
            raise serializers.ValidationError(f"Teleoperator with id '{value}' does not exist.")
    
    def validate_confirmateurId(self, value):
        """Validate confirmateurId exists (can be Django User ID or UserDetails ID)"""
        if not value or value == '':
            return None
        from .models import UserDetails
        # Try UserDetails ID first
        try:
            user_details = UserDetails.objects.get(id=value)
            if user_details.django_user:
                return user_details.django_user.id
        except UserDetails.DoesNotExist:
            pass
        # Try Django User ID
        try:
            django_user = DjangoUser.objects.get(id=int(value))
            return django_user.id
        except (DjangoUser.DoesNotExist, ValueError, TypeError):
            raise serializers.ValidationError(f"Confirmateur with id '{value}' does not exist.")
    
    def validate_creatorId(self, value):
        """Validate creatorId exists (can be Django User ID or UserDetails ID)"""
        if not value or value == '':
            return None
        from .models import UserDetails
        # Try UserDetails ID first
        try:
            user_details = UserDetails.objects.get(id=value)
            if user_details.django_user:
                return user_details.django_user.id
        except UserDetails.DoesNotExist:
            pass
        # Try Django User ID
        try:
            django_user = DjangoUser.objects.get(id=int(value))
            return django_user.id
        except (DjangoUser.DoesNotExist, ValueError, TypeError):
            raise serializers.ValidationError(f"Creator with id '{value}' does not exist.")
    
    def create(self, validated_data):
        """Create contact instance with proper field mapping"""
        # Extract ForeignKey IDs
        status_id = validated_data.pop('statusId', None)
        source_id = validated_data.pop('sourceId', None)
        teleoperator_id = validated_data.pop('teleoperatorId', None)
        confirmateur_id = validated_data.pop('confirmateurId', None)
        creator_id = validated_data.pop('creatorId', None)
        platform_id = validated_data.pop('platformId', None)
        
        # Handle phone and mobile (already converted to int or None by validators)
        phone = validated_data.pop('phone', None)
        mobile = validated_data.pop('mobile', None)
        
        # Set ForeignKey relationships
        if status_id:
            from .models import Status
            validated_data['status_id'] = status_id
        if source_id:
            from .models import Source
            validated_data['source_id'] = source_id
        if platform_id:
            from .models import Platform
            validated_data['platform_id'] = platform_id
        if teleoperator_id:
            validated_data['teleoperator_id'] = teleoperator_id
        if confirmateur_id:
            validated_data['confirmateur_id'] = confirmateur_id
        if creator_id:
            validated_data['creator_id'] = creator_id
        
        # Set phone and mobile
        validated_data['phone'] = phone
        validated_data['mobile'] = mobile
        
        # Generate ID if not provided
        if not validated_data.get('id'):
            import uuid
            contact_id = uuid.uuid4().hex[:12]
            while Contact.objects.filter(id=contact_id).exists():
                contact_id = uuid.uuid4().hex[:12]
            validated_data['id'] = contact_id
        
        return super().create(validated_data)
    
    def update(self, instance, validated_data):
        """Update contact instance with proper field mapping"""
        # Extract ForeignKey IDs
        status_id = validated_data.pop('statusId', None)
        source_id = validated_data.pop('sourceId', None)
        teleoperator_id = validated_data.pop('teleoperatorId', None)
        confirmateur_id = validated_data.pop('confirmateurId', None)
        creator_id = validated_data.pop('creatorId', None)
        platform_id = validated_data.pop('platformId', None)
        
        # Handle phone and mobile (already converted to int or None by validators)
        phone = validated_data.pop('phone', None)
        mobile = validated_data.pop('mobile', None)
        
        # Set ForeignKey relationships
        if status_id is not None:
            from .models import Status
            validated_data['status_id'] = status_id
        if source_id is not None:
            from .models import Source
            validated_data['source_id'] = source_id
        if platform_id is not None:
            from .models import Platform
            validated_data['platform_id'] = platform_id
        if teleoperator_id is not None:
            validated_data['teleoperator_id'] = teleoperator_id
        if confirmateur_id is not None:
            validated_data['confirmateur_id'] = confirmateur_id
        if creator_id is not None:
            validated_data['creator_id'] = creator_id
        
        # Set phone and mobile if provided
        if phone is not None:
            validated_data['phone'] = phone
        if mobile is not None:
            validated_data['mobile'] = mobile
        
        return super().update(instance, validated_data)

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
    hrex = serializers.CharField(required=False, allow_blank=True, max_length=7)
    requireOtp = serializers.BooleanField(source='require_otp', read_only=True)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)

    class Meta:
        model = UserDetails
        fields = [
            'id', 'firstName', 'lastName', 'username', 'email',
            'role', 'phone', 'mobile', 'teamId', 'active', 'hrex', 'requireOtp', 'createdAt'
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
    userId_read = serializers.SerializerMethodField()
    clientId_read = serializers.SerializerMethodField()
    
    class Meta:
        model = Event
        fields = ['id', 'datetime', 'userId', 'userId_read', 'contactId', 'clientId_read', 'comment', 'created_at', 'updated_at', 'contactName', 'createdBy', 'assignedTo']
        extra_kwargs = {
            'id': {'required': False}
        }
    
    def get_userId_read(self, obj):
        """Get the UserDetails ID as a read-only field for API responses"""
        if obj.userId:
            try:
                # Get UserDetails ID from DjangoUser via OneToOne relationship
                user_details = obj.userId.user_details
                return user_details.id if user_details else None
            except UserDetails.DoesNotExist:
                return None
        return None
    
    def get_clientId_read(self, obj):
        """Get the contactId as a read-only field for API responses (alias for contactId)"""
        return obj.contactId.id if obj.contactId else None
    
    def get_contactName(self, obj):
        if obj.contactId:
            name = f"{obj.contactId.fname or ''} {obj.contactId.lname or ''}".strip()
            return name if name else None
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
        from .models import UserDetails
        ret = super().to_representation(instance)
        # Expose contactId in API response
        ret['contactId'] = instance.contactId.id if instance.contactId else None
        # Expose UserDetails ID in API response (not DjangoUser ID)
        if instance.userId:
            try:
                user_details = instance.userId.user_details
                ret['userId'] = user_details.id if user_details else None
            except UserDetails.DoesNotExist:
                ret['userId'] = None
        else:
            ret['userId'] = None
        # Ensure userId_read is set (should already be set by SerializerMethodField, but ensure it's correct)
        if instance.userId:
            try:
                user_details = instance.userId.user_details
                ret['userId_read'] = user_details.id if user_details else None
            except UserDetails.DoesNotExist:
                ret['userId_read'] = None
        else:
            ret['userId_read'] = None
        # Ensure clientId_read is set (alias for contactId for frontend compatibility)
        ret['clientId_read'] = instance.contactId.id if instance.contactId else None
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
    userName = serializers.SerializerMethodField()
    contactId = serializers.SerializerMethodField()
    eventType = serializers.CharField(source='event_type', read_only=True)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    oldValue = serializers.JSONField(source='old_value', read_only=True)
    newValue = serializers.JSONField(source='new_value', read_only=True)
    
    class Meta:
        model = Log
        fields = ['id', 'eventType', 'userId', 'userName', 'contactId', 'createdAt', 'details', 'oldValue', 'newValue']
        read_only_fields = ['id', 'createdAt']
    
    def get_userId(self, obj):
        return obj.user_id.id if obj.user_id else None
    
    def get_userName(self, obj):
        # Return the name of the user who performed the action (user_id)
        if obj.user_id:
            return f"{obj.user_id.first_name} {obj.user_id.last_name}".strip() or obj.user_id.username
        return None
    
    def get_contactId(self, obj):
        return obj.contact_id.id if obj.contact_id else None
    
    def to_representation(self, instance):
        ret = super().to_representation(instance)
        ret['eventType'] = instance.event_type
        ret['userId'] = instance.user_id.id if instance.user_id else None
        ret['userName'] = self.get_userName(instance)
        ret['contactId'] = instance.contact_id.id if instance.contact_id else None
        ret['createdAt'] = instance.created_at
        ret['details'] = instance.details if instance.details else {}
        ret['oldValue'] = instance.old_value if instance.old_value else {}
        ret['newValue'] = instance.new_value if instance.new_value else {}
        ret['oldLogs'] = instance.old_logs if instance.old_logs else None
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

class PlatformSerializer(serializers.ModelSerializer):
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    updatedAt = serializers.DateTimeField(source='updated_at', read_only=True)

    class Meta:
        model = Platform
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
    isEvent = serializers.BooleanField(source='is_event', required=False)
    isFosseDefault = serializers.BooleanField(source='is_fosse_default', required=False)
    clientDefault = serializers.BooleanField(source='client_default', required=False)
    name = serializers.CharField(required=True, allow_blank=False)
    type = serializers.ChoiceField(choices=Status.STATUS_TYPE_CHOICES, required=False, default='lead')
    color = serializers.CharField(required=False, allow_blank=True, max_length=20)
    
    class Meta:
        model = Status
        fields = ['id', 'name', 'type', 'color', 'orderIndex', 'isEvent', 'isFosseDefault', 'clientDefault', 'createdAt', 'updatedAt']
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
    
    def create(self, validated_data):
        """Create status instance, ensuring only one status can be fosse default and only one client status can be client default"""
        # Get values from validated_data (after source mapping) or initial_data (before mapping)
        # The source parameter maps: isEvent -> is_event, isFosseDefault -> is_fosse_default, clientDefault -> client_default
        
        # Check for is_event value
        if 'is_event' not in validated_data and hasattr(self, 'initial_data'):
            is_event_value = self.initial_data.get('isEvent')
            if is_event_value is not None:
                validated_data['is_event'] = bool(is_event_value)
        
        # Check for is_fosse_default value
        if 'is_fosse_default' not in validated_data and hasattr(self, 'initial_data'):
            is_fosse_default_value = self.initial_data.get('isFosseDefault')
            if is_fosse_default_value is not None:
                validated_data['is_fosse_default'] = bool(is_fosse_default_value)
        
        # Check for client_default value
        if 'client_default' not in validated_data and hasattr(self, 'initial_data'):
            client_default_value = self.initial_data.get('clientDefault')
            if client_default_value is not None:
                validated_data['client_default'] = bool(client_default_value)
        
        # If setting is_fosse_default to True, unset all other statuses
        if validated_data.get('is_fosse_default', False):
            # Unset all other statuses that have is_fosse_default=True
            Status.objects.filter(is_fosse_default=True).update(is_fosse_default=False)
        
        # If setting client_default to True, unset all other client statuses
        status_type = validated_data.get('type', 'lead')
        if validated_data.get('client_default', False) and status_type == 'client':
            # Unset all other client statuses that have client_default=True
            Status.objects.filter(type='client', client_default=True).update(client_default=False)
        
        # Create the instance with validated data
        return super().create(validated_data)
    
    def update(self, instance, validated_data):
        """Update status instance, ensuring only one status can be fosse default"""
        import sys
        # Debug: print what we're working with
        print(f"[DEBUG] Update validated_data: {validated_data}", flush=True)
        if hasattr(self, 'initial_data'):
            print(f"[DEBUG] Update initial_data: {self.initial_data}", flush=True)
        sys.stdout.flush()
        
        # Get values directly from initial_data (request data before mapping)
        # The source parameter should map isEvent -> is_event, but let's handle both
        is_event_value = None
        is_fosse_default_value = None
        client_default_value = None
        
        # Check initial_data first (original request)
        if hasattr(self, 'initial_data'):
            # Handle isEvent - check if it's explicitly in the request (even if False)
            if 'isEvent' in self.initial_data:
                is_event_value = bool(self.initial_data.get('isEvent', False))
                validated_data['is_event'] = is_event_value
                print(f"[DEBUG] Found isEvent in initial_data: {is_event_value}", flush=True)
            else:
                print(f"[DEBUG] isEvent NOT in initial_data", flush=True)
            
            # Handle isFosseDefault - check if it's explicitly in the request (even if False)
            if 'isFosseDefault' in self.initial_data:
                is_fosse_default_value = bool(self.initial_data.get('isFosseDefault', False))
                validated_data['is_fosse_default'] = is_fosse_default_value
            
            # Handle clientDefault - check if it's explicitly in the request (even if False)
            if 'clientDefault' in self.initial_data:
                client_default_value = bool(self.initial_data.get('clientDefault', False))
                validated_data['client_default'] = client_default_value
        
        # Also check validated_data (after source mapping, if it worked)
        if 'is_event' in validated_data and is_event_value is None:
            is_event_value = validated_data['is_event']
        
        if 'is_fosse_default' in validated_data and is_fosse_default_value is None:
            is_fosse_default_value = validated_data['is_fosse_default']
        
        if 'client_default' in validated_data and client_default_value is None:
            client_default_value = validated_data['client_default']
        
        # If setting is_fosse_default to True, unset all other statuses
        if is_fosse_default_value:
            # Unset all other statuses that have is_fosse_default=True
            Status.objects.filter(is_fosse_default=True).exclude(id=instance.id).update(is_fosse_default=False)
        
        # If setting client_default to True for a client status, unset all other client statuses
        if client_default_value and instance.type == 'client':
            # Unset all other client statuses that have client_default=True
            Status.objects.filter(type='client', client_default=True).exclude(id=instance.id).update(client_default=False)
        
        # Update the instance with validated data
        updated_instance = super().update(instance, validated_data)
        
        # Explicitly set and save both fields if they were provided
        fields_to_update = []
        if is_event_value is not None:
            # Verify the field exists on the model
            if hasattr(updated_instance, 'is_event'):
                updated_instance.is_event = is_event_value
                fields_to_update.append('is_event')
        
        if is_fosse_default_value is not None:
            # Verify the field exists on the model
            if hasattr(updated_instance, 'is_fosse_default'):
                updated_instance.is_fosse_default = is_fosse_default_value
                fields_to_update.append('is_fosse_default')
        
        if client_default_value is not None:
            # Verify the field exists on the model
            if hasattr(updated_instance, 'client_default'):
                updated_instance.client_default = client_default_value
                fields_to_update.append('client_default')
        
        # Save explicitly if we have fields to update
        if fields_to_update:
            # Use update() to directly update the database row
            Status.objects.filter(id=updated_instance.id).update(**{field: getattr(updated_instance, field) for field in fields_to_update})
            # Refresh instance to get updated values
            updated_instance.refresh_from_db()
        
        sys.stdout.flush()
        return updated_instance
    
    def to_representation(self, instance):
        ret = super().to_representation(instance)
        ret['orderIndex'] = instance.order_index
        ret['isEvent'] = instance.is_event
        ret['isFosseDefault'] = instance.is_fosse_default
        ret['clientDefault'] = instance.client_default
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
    STATUS_ALLOWED_COMPONENTS = ['statuses', 'note_categories', 'fosse_statuses']
    
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
        
        # Only 'statuses', 'note_categories', and 'fosse_statuses' components are allowed to have statusId
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
        """Get list of participant IDs - use prefetched data if available"""
        # Check if participants are prefetched
        if hasattr(obj, '_prefetched_objects_cache') and 'participants' in obj._prefetched_objects_cache:
            return [user.id for user in obj._prefetched_objects_cache['participants']]
        # Fallback to query if not prefetched
        return [user.id for user in obj.participants.all()]
    
    def get_otherParticipant(self, obj):
        """Get the other participant (not the current user) - use prefetched data if available"""
        request = self.context.get('request')
        if request and request.user:
            # Use prefetched participants if available
            if hasattr(obj, '_prefetched_objects_cache') and 'participants' in obj._prefetched_objects_cache:
                participants = obj._prefetched_objects_cache['participants']
            else:
                participants = obj.participants.all()
            
            # Find other participant (not current user)
            for user in participants:
                if user.id != request.user.id:
                    first_name = user.first_name or ''
                    last_name = user.last_name or ''
                    name = f"{first_name} {last_name}".strip() if (first_name or last_name) else user.username
                    return {
                        'id': user.id,
                        'username': user.username,
                        'name': name,
                        'email': user.email or ''
                    }
        return None
    
    def get_lastMessage(self, obj):
        """Get the last message in the chat room - use prefetched data if available"""
        # Check if messages are prefetched
        if hasattr(obj, '_prefetched_objects_cache') and 'messages' in obj._prefetched_objects_cache:
            # Messages are prefetched - find the most recent one
            prefetched = obj._prefetched_objects_cache['messages']
            if prefetched:
                # Get the message with the latest created_at
                last_msg = max(prefetched, key=lambda m: m.created_at, default=None)
                if last_msg:
                    return MessageSerializer(last_msg).data
            return None
        
        # Fallback to query if not prefetched (shouldn't happen with proper prefetch)
        last_msg = obj.messages.select_related('sender').order_by('-created_at').first()
        if last_msg:
            return MessageSerializer(last_msg).data
        return None
    
    def get_unreadCount(self, obj):
        """Get count of unread messages for current user - use prefetched data if available"""
        request = self.context.get('request')
        if request and request.user:
            # Check if messages are prefetched
            if hasattr(obj, '_prefetched_objects_cache') and 'messages' in obj._prefetched_objects_cache:
                prefetched = obj._prefetched_objects_cache['messages']
                return sum(1 for msg in prefetched 
                          if not msg.is_read and msg.sender.id != request.user.id)
            
            # Fallback to query if not prefetched (shouldn't happen with proper prefetch)
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

class FosseSettingsSerializer(serializers.ModelSerializer):
    """Serializer for FosseSettings model"""
    roleId = serializers.CharField(source='role.id', read_only=True)
    roleName = serializers.CharField(source='role.name', read_only=True)
    forcedColumns = serializers.JSONField(source='forced_columns', required=False)
    forcedFilters = serializers.JSONField(source='forced_filters', required=False)
    defaultOrder = serializers.CharField(source='default_order', required=False)
    defaultStatusId = serializers.CharField(write_only=True, required=False, allow_null=True, allow_blank=True)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    updatedAt = serializers.DateTimeField(source='updated_at', read_only=True)
    
    class Meta:
        model = FosseSettings
        fields = ['id', 'roleId', 'roleName', 'forcedColumns', 'forcedFilters', 'defaultOrder', 'defaultStatusId', 'createdAt', 'updatedAt']
        read_only_fields = ['id', 'roleId', 'roleName', 'createdAt', 'updatedAt']
    
    def to_internal_value(self, data):
        """Handle defaultStatusId conversion"""
        # Get defaultStatusId before processing
        default_status_id = None
        if isinstance(data, dict):
            default_status_id = data.get('defaultStatusId')
        else:
            # Handle QueryDict
            default_status_id = getattr(data, 'get', lambda k, d=None: d)('defaultStatusId', None)
        
        # Process through parent to get validated_data
        validated_data = super().to_internal_value(data)
        
        # Store defaultStatusId for use in update method
        # Convert empty string to None
        if default_status_id == '' or default_status_id is None:
            self._default_status_id = None
        else:
            self._default_status_id = str(default_status_id)
        
        return validated_data
    
    def update(self, instance, validated_data):
        # Handle default_status update from request data
        # Remove defaultStatusId from validated_data since it's not a model field
        validated_data.pop('defaultStatusId', None)
        
        # Update default_status if provided
        if hasattr(self, '_default_status_id'):
            default_status_id = self._default_status_id
            if default_status_id:
                try:
                    from api.models import Status
                    status_obj = Status.objects.get(id=default_status_id)
                    instance.default_status = status_obj
                except Status.DoesNotExist:
                    instance.default_status = None
            else:
                instance.default_status = None
        
        return super().update(instance, validated_data)
    
    def to_representation(self, instance):
        ret = super().to_representation(instance)
        ret['roleId'] = instance.role.id
        ret['roleName'] = instance.role.name
        ret['forcedColumns'] = instance.forced_columns if instance.forced_columns else []
        ret['forcedFilters'] = instance.forced_filters if instance.forced_filters else {}
        ret['defaultOrder'] = instance.default_order if instance.default_order else 'default'
        ret['defaultStatusId'] = instance.default_status.id if instance.default_status else None
        ret['createdAt'] = instance.created_at
        ret['updatedAt'] = instance.updated_at
        return ret
    
    def to_representation(self, instance):
        ret = super().to_representation(instance)
        ret['roleId'] = instance.role.id
        ret['roleName'] = instance.role.name
        ret['forcedColumns'] = instance.forced_columns if instance.forced_columns else []
        ret['forcedFilters'] = instance.forced_filters if instance.forced_filters else {}
        ret['defaultOrder'] = instance.default_order if instance.default_order else 'default'
        ret['defaultStatusId'] = instance.default_status.id if instance.default_status else None
        ret['createdAt'] = instance.created_at
        ret['updatedAt'] = instance.updated_at
        return ret

