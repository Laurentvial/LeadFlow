from django.db import models
from django.contrib.auth.models import User as DjangoUser

# Create your models here.
class Source(models.Model):
    """Sources for contacts"""
    id = models.CharField(max_length=12, default="", unique=True, primary_key=True)
    name = models.CharField(max_length=100, unique=True, default="")
    created_by = models.ForeignKey(DjangoUser, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_sources')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return self.name

class Platform(models.Model):
    """Platforms for contacts"""
    id = models.CharField(max_length=12, default="", unique=True, primary_key=True)
    name = models.CharField(max_length=100, unique=True, default="")
    created_by = models.ForeignKey(DjangoUser, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_platforms')
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
    phone = models.BigIntegerField(null=True, blank=True)
    mobile = models.BigIntegerField(null=True, blank=True)
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
    
    # Confirmateur fields
    platform = models.ForeignKey('Platform', on_delete=models.SET_NULL, null=True, blank=True, related_name='contacts')
    montant_encaisse = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    bonus = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    PAIEMENT_CHOICES = [
        ('carte', 'Carte'),
        ('virement', 'Virement'),
    ]
    paiement = models.CharField(max_length=20, choices=PAIEMENT_CHOICES, blank=True, default="")
    CONTRAT_CHOICES = [
        ('CONTRAT SIGNÉ', 'CONTRAT SIGNÉ'),
        ('CONTRAT ENVOYÉ MAIS PAS SIGNÉ', 'CONTRAT ENVOYÉ MAIS PAS SIGNÉ'),
        ('PAS DE CONTRAT ENVOYÉ', 'PAS DE CONTRAT ENVOYÉ'),
        ("J'AI SIGNÉ LE CONTRAT POUR LE CLIENT", "J'AI SIGNÉ LE CONTRAT POUR LE CLIENT"),
    ]
    contrat = models.CharField(max_length=100, choices=CONTRAT_CHOICES, blank=True, default="")
    nom_de_scene = models.CharField(max_length=200, default="", blank=True)
    date_pro_tr = models.CharField(max_length=100, default="", blank=True)
    potentiel = models.CharField(max_length=200, default="", blank=True)
    produit = models.CharField(max_length=200, default="", blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True, db_index=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['teleoperator_id', '-created_at']),  # Optimize queries filtering by teleoperator
            models.Index(fields=['confirmateur_id', '-created_at']),  # Optimize queries filtering by confirmateur
            models.Index(fields=['creator_id', '-created_at']),  # Optimize queries filtering by creator
            models.Index(fields=['status_id', '-created_at']),  # Optimize queries filtering by status
            models.Index(fields=['source_id', '-created_at']),  # Optimize queries filtering by source
            models.Index(fields=['platform_id', '-created_at']),  # Optimize queries filtering by platform
            models.Index(fields=['fname', 'lname']),  # Optimize search queries
            models.Index(fields=['email']),  # Optimize email search
            models.Index(fields=['phone']),  # Optimize phone search
            models.Index(fields=['mobile']),  # Optimize mobile search
            models.Index(fields=['-created_at']),  # Optimize ordering by created_at
        ]

class NoteCategory(models.Model):
    """Categories for notes"""
    id = models.CharField(max_length=12, default="", unique=True, primary_key=True)
    name = models.CharField(max_length=100, unique=True, default="")
    order_index = models.IntegerField(default=0)
    created_by = models.ForeignKey(DjangoUser, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_note_categories')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return self.name

class Note(models.Model):
    id = models.CharField(max_length=12, default="", unique=True, primary_key=True)
    contactId = models.ForeignKey(Contact, on_delete=models.CASCADE, null=True, blank=True, related_name='contact_notes')
    userId = models.ForeignKey(DjangoUser, on_delete=models.CASCADE, related_name='notes')
    categ_id = models.ForeignKey('NoteCategory', on_delete=models.SET_NULL, null=True, blank=True, related_name='notes')
    text = models.TextField(default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['contactId', '-created_at']),  # Optimize queries filtering by contact
            models.Index(fields=['categ_id', '-created_at']),  # Optimize queries filtering by category
            models.Index(fields=['userId', '-created_at']),  # Optimize queries filtering by user
        ]
        ordering = ['-created_at']  # Default ordering

    def __str__(self):
        return self.text

class UserDetails(models.Model):
    id = models.CharField(max_length=12, default="", unique=True, primary_key=True)
    django_user = models.OneToOneField(DjangoUser, on_delete=models.CASCADE, related_name='user_details')
    role_id = models.ForeignKey('Role', on_delete=models.SET_NULL, null=True, blank=True, related_name='users', db_column='role_id')
    phone = models.BigIntegerField(null=True, blank=True)
    hrex = models.CharField(max_length=7, default="", blank=True)  # Hex color code (e.g., #FF5733)
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
    """Notifications for users"""
    NOTIFICATION_TYPES = [
        ('message', 'Nouveau message'),
        ('email', 'Nouvel email'),
        ('contact', 'Contact mis à jour'),
        ('event', 'Nouvel événement'),
        ('system', 'Notification système'),
    ]
    
    id = models.CharField(max_length=12, default="", unique=True, primary_key=True)
    user = models.ForeignKey(DjangoUser, on_delete=models.CASCADE, related_name='notifications')
    type = models.CharField(max_length=50, choices=NOTIFICATION_TYPES, default='system')
    title = models.CharField(max_length=200, default="")
    message = models.TextField(default="")
    
    # Related objects (optional)
    message_id = models.CharField(max_length=12, default="", blank=True)  # For chat messages
    email_id = models.CharField(max_length=12, default="", blank=True)  # For emails
    contact_id = models.CharField(max_length=12, default="", blank=True)  # For contacts
    event_id = models.CharField(max_length=12, default="", blank=True)  # For events
    
    # Status
    is_read = models.BooleanField(default=False)
    
    # Additional data as JSON
    data = models.JSONField(default=dict, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['user', 'is_read']),
        ]
    
    def __str__(self):
        return f"Notification {self.id} - {self.type} for {self.user.username}"

class Status(models.Model):
    """Statuses for leads and contacts"""
    STATUS_TYPE_CHOICES = [
        ('lead', 'Lead'),
        ('contact', 'Contact'),
        ('client', 'Client'),
    ]
    
    id = models.CharField(max_length=12, default="", unique=True, primary_key=True)
    name = models.CharField(max_length=100, default="")
    type = models.CharField(max_length=10, choices=STATUS_TYPE_CHOICES, default='lead')
    color = models.CharField(max_length=20, default="", blank=True)
    order_index = models.IntegerField(default=0)
    is_event = models.BooleanField(default=False)
    is_fosse_default = models.BooleanField(default=False)
    client_default = models.BooleanField(default=False)
    created_by = models.ForeignKey(DjangoUser, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_statuses')
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
    created_by = models.ForeignKey(DjangoUser, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_roles')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return self.name

class NotificationPreference(models.Model):
    """Notification preferences per role"""
    id = models.CharField(max_length=12, default="", unique=True, primary_key=True)
    role = models.ForeignKey('Role', on_delete=models.CASCADE, related_name='notification_preferences')
    
    # Notification types
    notify_message_received = models.BooleanField(default=True)  # Notification de message recu
    notify_sensitive_contact_modification = models.BooleanField(default=True)  # Notification de modification sensible d'un contact
    notify_contact_edit = models.BooleanField(default=True)  # Notification de modification de contact (phone, mobile, email)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ['role']  # One preference per role
    
    def __str__(self):
        return f"Notification Preferences - {self.role.name}"

class FosseSettings(models.Model):
    """Fosse page settings per role - forced columns, filters, and ordering"""
    ORDER_CHOICES = [
        ('none', 'Non défini (personnalisable)'),
        ('created_at_asc', 'Date de création (ancien à nouveau)'),
        ('created_at_desc', 'Date de création (nouveau à ancien)'),
        ('updated_at_asc', 'Date de modification (ancien à nouveau)'),
        ('updated_at_desc', 'Date de modification (nouveau à ancien)'),
        ('email_asc', 'Email (ordre alphabétique)'),
    ]
    
    id = models.CharField(max_length=12, default="", unique=True, primary_key=True)
    role = models.ForeignKey('Role', on_delete=models.CASCADE, related_name='fosse_settings')
    
    # Forced columns: list of column IDs that must be visible on Fosse page
    forced_columns = models.JSONField(default=list, blank=True)
    
    # Forced filters: object mapping column IDs to filter settings
    # Example: {
    #   "status": {"type": "defined", "values": ["status1", "status2"]},
    #   "creator": {"type": "open"},
    #   "source": {"type": "defined", "values": ["source1"]}
    # }
    forced_filters = models.JSONField(default=dict, blank=True)
    
    # Default ordering: 'default' (by creation date) or 'random' (random order)
    default_order = models.CharField(max_length=20, choices=ORDER_CHOICES, default='default')
    
    # Default status to set when a contact becomes unassigned (both teleoperator and confirmateur are null)
    default_status = models.ForeignKey('Status', on_delete=models.SET_NULL, null=True, blank=True, related_name='fosse_settings_default')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ['role']  # One setting per role
    
    def __str__(self):
        return f"Fosse Settings - {self.role.name}"

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
    created_by = models.ForeignKey(DjangoUser, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_teams')
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
    created_by = models.ForeignKey(DjangoUser, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_events')
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

class SMTPConfig(models.Model):
    """SMTP configuration for users to send/receive emails"""
    id = models.CharField(max_length=12, default="", unique=True, primary_key=True)
    user = models.OneToOneField(DjangoUser, on_delete=models.CASCADE, related_name='smtp_config')
    
    # SMTP Settings
    smtp_server = models.CharField(max_length=255, default="")
    smtp_port = models.IntegerField(default=587)
    smtp_use_tls = models.BooleanField(default=True)
    smtp_username = models.CharField(max_length=255, default="")
    smtp_password = models.CharField(max_length=255, default="")  # Should be encrypted in production
    
    # IMAP Settings (for receiving emails)
    imap_server = models.CharField(max_length=255, default="", blank=True)
    imap_port = models.IntegerField(default=993, null=True, blank=True)
    imap_use_ssl = models.BooleanField(default=True)
    
    # Email address
    email_address = models.EmailField(max_length=255, default="")
    
    # Status
    is_active = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"SMTP Config for {self.user.username} ({self.email_address})"

class Email(models.Model):
    """Stored emails (sent and received)"""
    EMAIL_TYPE_CHOICES = [
        ('sent', 'Sent'),
        ('received', 'Received'),
        ('draft', 'Draft'),
    ]
    
    id = models.CharField(max_length=12, default="", unique=True, primary_key=True)
    user = models.ForeignKey(DjangoUser, on_delete=models.CASCADE, related_name='emails')
    email_type = models.CharField(max_length=10, choices=EMAIL_TYPE_CHOICES, default='sent')
    
    # Email headers
    subject = models.CharField(max_length=500, default="")
    from_email = models.EmailField(max_length=255, default="")
    to_emails = models.JSONField(default=list)  # List of email addresses
    cc_emails = models.JSONField(default=list, blank=True)
    bcc_emails = models.JSONField(default=list, blank=True)
    
    # Email content
    body_text = models.TextField(default="", blank=True)
    body_html = models.TextField(default="", blank=True)
    
    # Attachments (stored as JSON list of file info)
    attachments = models.JSONField(default=list, blank=True)
    
    # For received emails
    message_id = models.CharField(max_length=500, default="", blank=True)  # Email Message-ID header
    in_reply_to = models.CharField(max_length=500, default="", blank=True)  # In-Reply-To header
    references = models.TextField(default="", blank=True)  # References header
    
    # Related contact (if email is related to a contact)
    contact = models.ForeignKey(Contact, on_delete=models.SET_NULL, null=True, blank=True, related_name='emails')
    
    # Status
    is_read = models.BooleanField(default=False)
    is_starred = models.BooleanField(default=False)
    
    # Timestamps
    sent_at = models.DateTimeField(null=True, blank=True)  # When email was sent/received
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-sent_at', '-created_at']
        indexes = [
            models.Index(fields=['user', 'email_type', '-sent_at']),
            models.Index(fields=['user', 'is_read']),
        ]
    
    def __str__(self):
        return f"Email {self.id} - {self.subject} ({self.email_type})"

class EmailSignature(models.Model):
    """Email signatures for users"""
    LOGO_POSITIONS = [
        ('top', 'En haut'),
        ('bottom', 'En bas'),
        ('left', 'À gauche'),
        ('right', 'À droite'),
    ]
    
    id = models.CharField(max_length=12, default="", unique=True, primary_key=True)
    user = models.ForeignKey(DjangoUser, on_delete=models.CASCADE, related_name='email_signatures')
    created_by = models.ForeignKey(DjangoUser, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_email_signatures')
    
    # Signature details
    name = models.CharField(max_length=100, default="")  # Name/label for the signature
    content_html = models.TextField(default="", blank=True)  # HTML content of signature
    content_text = models.TextField(default="", blank=True)  # Plain text content of signature
    
    # Logo settings
    logo_url = models.URLField(max_length=500, blank=True, default="")  # URL of logo image
    logo_position = models.CharField(max_length=10, choices=LOGO_POSITIONS, default='left', blank=True)  # Position of logo
    
    # Default signature flag (only one per user can be default)
    is_default = models.BooleanField(default=False)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-is_default', '-created_at']
        indexes = [
            models.Index(fields=['user', 'is_default']),
        ]
    
    def __str__(self):
        return f"Signature {self.name} - {self.user.username}"

class ChatRoom(models.Model):
    """Chat rooms for conversations between users"""
    id = models.CharField(max_length=12, default="", unique=True, primary_key=True)
    participants = models.ManyToManyField(DjangoUser, related_name='chat_rooms')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['-updated_at']),
        ]
    
    def __str__(self):
        participant_names = ', '.join([u.username for u in self.participants.all()[:3]])
        return f"Chat {self.id} - {participant_names}"

class Message(models.Model):
    """Messages in chat rooms"""
    id = models.CharField(max_length=12, default="", unique=True, primary_key=True)
    chat_room = models.ForeignKey(ChatRoom, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(DjangoUser, on_delete=models.CASCADE, related_name='sent_messages')
    content = models.TextField(default="")
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['chat_room', 'created_at']),
            models.Index(fields=['sender', 'created_at']),
            models.Index(fields=['is_read']),
        ]
    
    def __str__(self):
        return f"Message {self.id} from {self.sender.username}"