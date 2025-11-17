from django.db import models
from django.contrib.auth.models import User as DjangoUser

# Create your models here.
class Source(models.Model):
    """Sources for contacts"""
    id = models.CharField(max_length=12, default="", unique=True, primary_key=True)
    name = models.CharField(max_length=100, unique=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return self.name

class Contact(models.Model):
    # Identifiant
    id = models.CharField(max_length=12, default="", unique=True, primary_key=True)
    
    # Informations personnelles
    civility = models.CharField(max_length=10, default="", blank=True)  # Monsieur, Madame, etc.
    fname = models.CharField(max_length=50, default="")
    lname = models.CharField(max_length=50, default="")
    phone = models.CharField(max_length=20, default="", blank=True)
    mobile = models.CharField(max_length=20, default="", blank=True)
    email = models.EmailField(max_length=100, default="", blank=True)
    birth_date = models.DateField(null=True, blank=True)
    birth_place = models.CharField(max_length=100, default="", blank=True)
    address = models.CharField(max_length=200, default="", blank=True)
    address_complement = models.CharField(max_length=200, default="", blank=True)
    postal_code = models.CharField(max_length=20, default="", blank=True)
    city = models.CharField(max_length=100, default="", blank=True)
    nationality = models.CharField(max_length=100, default="", blank=True)
    
    # Relations
    status = models.ForeignKey('Status', on_delete=models.SET_NULL, null=True, blank=True, related_name='contacts')
    source = models.ForeignKey('Source', on_delete=models.SET_NULL, null=True, blank=True, related_name='contacts')
    campaign = models.CharField(max_length=200, default="", blank=True)
    teleoperator = models.ForeignKey(DjangoUser, on_delete=models.SET_NULL, null=True, blank=True, related_name='teleoperator_contacts')
    confirmateur = models.ForeignKey(DjangoUser, on_delete=models.SET_NULL, null=True, blank=True, related_name='confirmateur_contacts')
    creator = models.ForeignKey(DjangoUser, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_contacts')
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class Note(models.Model):
    id = models.CharField(max_length=12, default="", unique=True, primary_key=True)
    contactId = models.ForeignKey(Contact, on_delete=models.CASCADE, null=True, blank=True, related_name='contact_notes')
    userId = models.ForeignKey(DjangoUser, on_delete=models.CASCADE, related_name='notes')
    text = models.TextField(default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.text

class UserDetails(models.Model):
    id = models.CharField(max_length=12, default="", unique=True, primary_key=True)
    django_user = models.OneToOneField(DjangoUser, on_delete=models.CASCADE, related_name='user_details')
    role_id = models.ForeignKey('Role', on_delete=models.SET_NULL, null=True, blank=True, related_name='users', db_column='role_id')
    phone = models.CharField(max_length=20, default="", blank=True)
    active = models.BooleanField(null=False, default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Property for backward compatibility - allows code to use .role instead of .role_id
    @property
    def role(self):
        """Property to maintain backward compatibility with role field"""
        return self.role_id
    
    @role.setter
    def role(self, value):
        """Setter for backward compatibility"""
        self.role_id = value
    
    def __str__(self):
        return f"{self.django_user.username} - {self.role_id.name if self.role_id else 'No Role'}"

class Notification(models.Model):
    id = models.CharField(max_length=12, default="", unique=True, primary_key=True)
    type = models.CharField(max_length=50, default="")
    messageId = models.CharField(max_length=12, default="")
    transactionId = models.CharField(max_length=12, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class Status(models.Model):
    """Statuses for leads and contacts"""
    STATUS_TYPE_CHOICES = [
        ('lead', 'Lead'),
        ('contact', 'Contact'),
    ]
    
    id = models.CharField(max_length=12, default="", unique=True, primary_key=True)
    name = models.CharField(max_length=100, default="")
    type = models.CharField(max_length=10, choices=STATUS_TYPE_CHOICES, default='lead')
    color = models.CharField(max_length=20, default="", blank=True)
    order_index = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ['name', 'type']  # Same status name can exist for different types
    
    def __str__(self):
        return f"{self.name} ({self.type})"

class Role(models.Model):
    """Roles with data access levels"""
    DATA_ACCESS_CHOICES = [
        ('all', 'All'),
        ('team_only', 'Team Only'),
        ('own_only', 'Own Only'),
    ]
    
    id = models.CharField(max_length=12, default="", unique=True, primary_key=True)
    name = models.CharField(max_length=100, unique=True, default="")
    data_access = models.CharField(max_length=20, choices=DATA_ACCESS_CHOICES, default='own_only')
    is_teleoperateur = models.BooleanField(default=False)
    is_confirmateur = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return self.name

class Permission(models.Model):
    """Permissions for components and fields"""
    ACTION_CHOICES = [
        ('view', 'View'),
        ('create', 'Create'),
        ('edit', 'Edit'),
        ('delete', 'Delete'),
    ]
    
    id = models.CharField(max_length=12, default="", unique=True, primary_key=True)
    component = models.CharField(max_length=100, default="")  # e.g., 'dashboard', 'contact', 'note', 'event'
    field_name = models.CharField(max_length=100, null=True, blank=True)  # Optional field-level permission
    action = models.CharField(max_length=10, choices=ACTION_CHOICES, default='view')  # view, create, edit, or delete
    status = models.ForeignKey('Status', on_delete=models.SET_NULL, null=True, blank=True, related_name='permissions')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ['component', 'field_name', 'action', 'status']  # Unique permission per component/field/action/status
    
    def __str__(self):
        field_part = f".{self.field_name}" if self.field_name else ""
        status_part = f" [{self.status.name}]" if self.status else ""
        return f"{self.component}{field_part} ({self.action}){status_part}"

class PermissionRole(models.Model):
    """Junction table between Roles and Permissions"""
    id = models.CharField(max_length=12, default="", unique=True, primary_key=True)
    role = models.ForeignKey('Role', on_delete=models.CASCADE, related_name='permission_roles')
    permission = models.ForeignKey('Permission', on_delete=models.CASCADE, related_name='permission_roles')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ['role', 'permission']  # A role can only have a permission once
    
    def __str__(self):
        return f"{self.role.name} - {self.permission}"

class Team(models.Model):
    id = models.CharField(max_length=12, default="", unique=True, primary_key=True)
    name = models.CharField(max_length=50, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class TeamMember(models.Model):
    """Table de relation entre UserDetails et Team avec date d'insertion"""
    id = models.CharField(max_length=12, default="", unique=True, primary_key=True)
    user = models.ForeignKey('UserDetails', on_delete=models.CASCADE, related_name='team_memberships')
    team = models.ForeignKey('Team', on_delete=models.CASCADE, related_name='team_members')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ['user', 'team']  # Un utilisateur ne peut être qu'une fois dans une équipe

class Event(models.Model):
    id = models.CharField(max_length=12, default="", unique=True, primary_key=True)
    datetime = models.DateTimeField()
    userId = models.ForeignKey(DjangoUser, on_delete=models.CASCADE, related_name='events')
    contactId = models.ForeignKey(Contact, on_delete=models.SET_NULL, null=True, blank=True)
    comment = models.TextField(default="", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Event {self.id} - {self.datetime}"

class Log(models.Model):
    """Table for tracking all CRM activity logs"""
    id = models.CharField(max_length=12, default="", unique=True, primary_key=True)
    event_type = models.CharField(max_length=100, default="")  # createUser, editUser, createContact, etc.
    user_id = models.ForeignKey(DjangoUser, on_delete=models.SET_NULL, null=True, blank=True, related_name='activity_logs')
    contact_id = models.ForeignKey(Contact, on_delete=models.SET_NULL, null=True, blank=True, related_name='contact_logs')
    creator_id = models.ForeignKey(DjangoUser, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_logs')
    created_at = models.DateTimeField(auto_now_add=True)
    details = models.JSONField(default=dict, blank=True)  # IP, browser info, and other metadata
    old_value = models.JSONField(default=dict, null=True, blank=True)  # Previous state
    new_value = models.JSONField(default=dict, null=True, blank=True)  # New state

    def __str__(self):
        return f"Log {self.id} - {self.event_type} - {self.created_at}"

class Document(models.Model):
    """Table for storing contact documents"""
    DOCUMENT_TYPES = [
        ('CNI', 'CNI'),
        ('JUSTIFICATIF_DOMICILE', 'Justificatif de domicile'),
        ('SELFIE', 'Selfie'),
        ('RIB', 'RIB'),
    ]
    
    id = models.CharField(max_length=12, default="", unique=True, primary_key=True)
    contact_id = models.ForeignKey(Contact, on_delete=models.CASCADE, related_name='documents')
    document_type = models.CharField(max_length=50, choices=DOCUMENT_TYPES)
    has_document = models.BooleanField(default=False)  # Oui/Non
    file_url = models.URLField(max_length=500, blank=True, default="")  # URL du fichier dans Impossible Cloud
    file_name = models.CharField(max_length=255, blank=True, default="")  # Nom du fichier
    uploaded_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    uploaded_by = models.ForeignKey(DjangoUser, on_delete=models.SET_NULL, null=True, blank=True, related_name='uploaded_documents')

    class Meta:
        unique_together = ['contact_id', 'document_type']  # Un seul document de chaque type par contact

    def __str__(self):
        return f"Document {self.document_type} - Contact {self.contact_id.id}"