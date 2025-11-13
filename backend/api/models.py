from django.db import models
from django.contrib.auth.models import User as DjangoUser

# Create your models here.
class Client(models.Model):
    # Identifiant
    id = models.CharField(max_length=12, default="", unique=True, primary_key=True)
    
    # Informations personnelles
    profile_photo = models.ImageField(upload_to='client_profiles/', null=True, blank=True)
    civility = models.CharField(max_length=10, default="", blank=True)  # Monsieur, Madame, etc.
    fname = models.CharField(max_length=50, default="")
    lname = models.CharField(max_length=50, default="")
    platform_access = models.BooleanField(default=True)  # Connexion à la plateforme
    active = models.BooleanField(null=False, default=True)
    template = models.CharField(max_length=100, default="", blank=True)
    support = models.CharField(max_length=100, default="", blank=True)
    password = models.CharField(max_length=100, default="Access@123")
    phone = models.CharField(max_length=20, default="", blank=True)
    mobile = models.CharField(max_length=20, default="", blank=True)
    email = models.EmailField(max_length=100, default="", unique=True)
    birth_date = models.DateField(null=True, blank=True)
    birth_place = models.CharField(max_length=100, default="", blank=True)
    address = models.CharField(max_length=200, default="", blank=True)
    postal_code = models.CharField(max_length=20, default="", blank=True)
    city = models.CharField(max_length=100, default="", blank=True)
    nationality = models.CharField(max_length=100, default="", blank=True)
    successor = models.CharField(max_length=200, default="", blank=True)
    
    # Fiche patrimoniale - Activité professionnelle
    professional_activity_status = models.CharField(max_length=50, default="", blank=True)  # Aucune, En activité, Salarié(e), etc.
    professional_activity_comment = models.TextField(default="", blank=True)
    professions = models.JSONField(default=list, blank=True)  # Liste de métiers
    professions_comment = models.TextField(default="", blank=True)
    
    # Fiche patrimoniale - Patrimoine
    bank_name = models.CharField(max_length=100, default="", blank=True)
    current_account = models.DecimalField(max_digits=15, decimal_places=2, default=0, null=True, blank=True)
    livret_ab = models.DecimalField(max_digits=15, decimal_places=2, default=0, null=True, blank=True)
    pea = models.DecimalField(max_digits=15, decimal_places=2, default=0, null=True, blank=True)
    pel = models.DecimalField(max_digits=15, decimal_places=2, default=0, null=True, blank=True)
    ldd = models.DecimalField(max_digits=15, decimal_places=2, default=0, null=True, blank=True)
    cel = models.DecimalField(max_digits=15, decimal_places=2, default=0, null=True, blank=True)
    csl = models.DecimalField(max_digits=15, decimal_places=2, default=0, null=True, blank=True)
    securities_account = models.DecimalField(max_digits=15, decimal_places=2, default=0, null=True, blank=True)
    life_insurance = models.DecimalField(max_digits=15, decimal_places=2, default=0, null=True, blank=True)
    savings_comment = models.TextField(default="", blank=True)
    total_wealth = models.DecimalField(max_digits=15, decimal_places=2, default=0, null=True, blank=True)
    
    # Fiche patrimoniale - Objectifs et expérience
    objectives = models.JSONField(default=list, blank=True)  # Epargne, Fructifier, Succession
    objectives_comment = models.TextField(default="", blank=True)
    experience = models.JSONField(default=list, blank=True)  # Bourse, Livrets, Placements, Risque
    experience_comment = models.TextField(default="", blank=True)
    
    # Fiche patrimoniale - Informations financières
    tax_optimization = models.BooleanField(default=False)  # Défiscalisation
    tax_optimization_comment = models.TextField(default="", blank=True)
    annual_household_income = models.DecimalField(max_digits=15, decimal_places=2, default=0, null=True, blank=True)
    
    # Wallet (fonds du client - distinct du portefeuille d'actifs)
    invested_capital = models.DecimalField(max_digits=15, decimal_places=2, default=0, null=True, blank=True)  # Capital investi
    trading_portfolio = models.DecimalField(max_digits=15, decimal_places=2, default=0, null=True, blank=True)  # Wallet trading (fonds utilisés pour le trading)
    bonus = models.DecimalField(max_digits=15, decimal_places=2, default=0, null=True, blank=True)  # Bonus
    # Note: available_funds is calculated on frontend (invested_capital - trading_portfolio - bonus)
    # Note: Le "portefeuille" d'actifs est géré via ClientAsset, pas ici
    
    # Relations
    managed_by = models.CharField(max_length=50, default="", blank=True)  # ID ou username du gestionnaire
    source = models.CharField(max_length=100, default="", blank=True)  # Source du client
    team = models.ForeignKey('Team', on_delete=models.SET_NULL, null=True, blank=True, related_name='clients')
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class Note(models.Model):
    id = models.CharField(max_length=12, default="", unique=True, primary_key=True)
    clientId = models.ForeignKey(Client, on_delete=models.CASCADE, null=True, blank=True)
    userId = models.ForeignKey(DjangoUser, on_delete=models.CASCADE, related_name='notes')
    text = models.TextField(default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.text

class UserDetails(models.Model):
    id = models.CharField(max_length=12, default="", unique=True, primary_key=True)
    django_user = models.OneToOneField(DjangoUser, on_delete=models.CASCADE, related_name='user_details')
    role = models.CharField(max_length=12, default="0")
    phone = models.CharField(max_length=20, default="", blank=True)
    active = models.BooleanField(null=False, default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class Notification(models.Model):
    id = models.CharField(max_length=12, default="", unique=True, primary_key=True)
    type = models.CharField(max_length=50, default="")
    messageId = models.CharField(max_length=12, default="")
    transactionId = models.CharField(max_length=12, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class Role(models.Model):
    id = models.CharField(max_length=12, default="", unique=True, primary_key=True)
    name = models.CharField(max_length=50, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

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
    clientId = models.ForeignKey(Client, on_delete=models.SET_NULL, null=True, blank=True)
    comment = models.TextField(default="", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Event {self.id} - {self.datetime}"

class Log(models.Model):
    """Table for tracking all CRM activity logs"""
    id = models.CharField(max_length=12, default="", unique=True, primary_key=True)
    event_type = models.CharField(max_length=100, default="")  # createUser, editUser, createClient, etc.
    user_id = models.ForeignKey(DjangoUser, on_delete=models.SET_NULL, null=True, blank=True, related_name='activity_logs')
    created_at = models.DateTimeField(auto_now_add=True)
    details = models.JSONField(default=dict, blank=True)  # IP, browser info, and other metadata
    old_value = models.JSONField(default=dict, null=True, blank=True)  # Previous state
    new_value = models.JSONField(default=dict, null=True, blank=True)  # New state

    def __str__(self):
        return f"Log {self.id} - {self.event_type} - {self.created_at}"

class Asset(models.Model):
    """Table des actifs disponibles (bourse, cryptos, etc.)"""
    id = models.CharField(max_length=12, default="", unique=True, primary_key=True)
    type = models.CharField(max_length=50, default="")  # Bourse, Crypto, etc.
    name = models.CharField(max_length=200, default="")  # Nom de l'actif
    reference = models.CharField(max_length=100, default="", blank=True)  # Référence (ex: ISIN, ticker)
    category = models.CharField(max_length=100, default="", blank=True, null=True)  # Catégorie
    subcategory = models.CharField(max_length=100, default="", blank=True, null=True)  # Sous-catégorie
    default = models.BooleanField(default=False)  # Si True, disponible par défaut pour tous les clients
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.type})"

class ClientAsset(models.Model):
    """Table relationnelle entre Client et Asset"""
    id = models.CharField(max_length=12, default="", unique=True, primary_key=True)
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='client_assets')
    asset = models.ForeignKey(Asset, on_delete=models.CASCADE, related_name='client_assets')
    featured = models.BooleanField(default=False)  # Si True, l'actif est mis en avant pour ce client
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ['client', 'asset']  # Un client ne peut avoir qu'une fois le même actif

    def __str__(self):
        return f"{self.client.fname} {self.client.lname} - {self.asset.name}"

class RIB(models.Model):
    """Table des RIBs disponibles"""
    id = models.CharField(max_length=12, default="", unique=True, primary_key=True)
    name = models.CharField(max_length=200, default="")  # Nom du RIB
    iban = models.CharField(max_length=34, default="", blank=True)  # IBAN
    bic = models.CharField(max_length=11, default="", blank=True)  # BIC
    bank_name = models.CharField(max_length=200, default="", blank=True)  # Nom de la banque
    account_holder = models.CharField(max_length=200, default="", blank=True)  # Titulaire du compte
    bank_code = models.CharField(max_length=5, default="", blank=True)  # Code banque (5 chiffres)
    branch_code = models.CharField(max_length=5, default="", blank=True)  # Code guichet (5 chiffres)
    account_number = models.CharField(max_length=11, default="", blank=True)  # Numéro de compte (11 caractères)
    rib_key = models.CharField(max_length=2, default="", blank=True)  # Clé RIB (2 chiffres)
    domiciliation = models.CharField(max_length=200, default="", blank=True)  # Domiciliation
    default = models.BooleanField(default=False)  # Si True, disponible par défaut pour tous les clients
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} - {self.iban}"

class ClientRIB(models.Model):
    """Table relationnelle entre Client et RIB"""
    id = models.CharField(max_length=12, default="", unique=True, primary_key=True)
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='client_ribs')
    rib = models.ForeignKey(RIB, on_delete=models.CASCADE, related_name='client_ribs')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ['client', 'rib']  # Un client ne peut avoir qu'une fois le même RIB

    def __str__(self):
        return f"{self.client.fname} {self.client.lname} - {self.rib.name}"

class UsefulLink(models.Model):
    """Table des liens utiles disponibles"""
    id = models.CharField(max_length=12, default="", unique=True, primary_key=True)
    name = models.CharField(max_length=200, default="")  # Nom du lien (Titre)
    url = models.URLField(max_length=500, default="")  # URL du lien
    description = models.TextField(default="", blank=True)  # Description du lien
    image = models.ImageField(upload_to='useful_links/', null=True, blank=True)  # Image du lien
    category = models.CharField(max_length=100, default="", blank=True)  # Catégorie du lien (déprécié)
    default = models.BooleanField(default=False)  # Si True, disponible par défaut pour tous les clients
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} - {self.url}"

class ClientUsefulLink(models.Model):
    """Table relationnelle entre Client et UsefulLink"""
    id = models.CharField(max_length=12, default="", unique=True, primary_key=True)
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='client_useful_links')
    useful_link = models.ForeignKey(UsefulLink, on_delete=models.CASCADE, related_name='client_useful_links')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ['client', 'useful_link']  # Un client ne peut avoir qu'une fois le même lien

    def __str__(self):
        return f"{self.client.fname} {self.client.lname} - {self.useful_link.name}"

class Transaction(models.Model):
    """Table des transactions clients"""
    TRANSACTION_TYPES = [
        ('depot', 'Dépôt'),
        ('retrait', 'Retrait'),
        ('bonus', 'Bonus'),
        ('achat', 'Achat'),
        ('vente', 'Vente'),
        ('interets', 'Intérêts'),
        ('frais', 'Frais'),
        ('investissement', 'Investissement'),
        ('perte', 'Perte'),
    ]
    
    STATUS_CHOICES = [
        ('en_attente_paiement', 'En attente de paiement'),
        ('en_cours', 'En cours'),
        ('termine', 'Terminé'),
        ('conteste', 'Contesté'),
    ]
    
    id = models.CharField(max_length=12, default="", unique=True, primary_key=True)
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='transactions')
    type = models.CharField(max_length=50, choices=TRANSACTION_TYPES, default='depot')
    amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    description = models.TextField(default="", blank=True)
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='en_cours')
    datetime = models.DateTimeField()  # Date et heure de la transaction
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.get_type_display()} - {self.amount} € - {self.client.fname} {self.client.lname}"