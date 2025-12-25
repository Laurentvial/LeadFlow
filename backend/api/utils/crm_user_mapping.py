"""
Mapping utility for old CRM user IDs to new database users
Used for facilitating log migration and user mapping
"""

from typing import Dict, Optional, List
from django.contrib.auth.models import User as DjangoUser


# Mapping of old CRM user IDs to their email addresses and user names
OLD_CRM_USER_MAPPING = [
    {"id_crmuser": 1, "email": "admindevlp4@gestioncrm.com", "user_name": "Admin DEV"},
    {"id_crmuser": 2, "email": "ksk@ksk.com", "user_name": "ADMIN KSK"},
    {"id_crmuser": 6, "email": "blanc@blanc.com", "user_name": "ADMIN BLANC"},
    {"id_crmuser": 7, "email": "jade@jade.com", "user_name": "ADMIN JADE"},
    {"id_crmuser": 8, "email": "mass@mass.com", "user_name": "ADMIN MASS"},
    {"id_crmuser": 4, "email": "menard@crm.com", "user_name": "MENARD"},
    {"id_crmuser": 48, "email": "antoine@crm.com", "user_name": "Antoine"},
    {"id_crmuser": 5, "email": "bleu@bleu.com", "user_name": "ADMIN BLEU"},
    {"id_crmuser": 9, "email": "mikotelepro@ss.com", "user_name": "mikotelepro"},
    {"id_crmuser": 28, "email": "pavytelepro@crm.com", "user_name": "PAVY"},
    {"id_crmuser": 10, "email": "beaumont@crm.com", "user_name": "BEAUMONT"},
    {"id_crmuser": 11, "email": "jacquet@crm.com", "user_name": "JACQUET"},
    {"id_crmuser": 12, "email": "moreau@crm.com", "user_name": "MOREAU"},
    {"id_crmuser": 13, "email": "legof@crm.com", "user_name": "LEGOF"},
    {"id_crmuser": 14, "email": "laurence@crm.com", "user_name": "LAURENCE"},
    {"id_crmuser": 40, "email": "anciensclients@crm.com", "user_name": "ANCIENS CLIENTS "},
    {"id_crmuser": 15, "email": "rossi@crm.com", "user_name": "ROSSI"},
    {"id_crmuser": 16, "email": "levasseur@crm.com", "user_name": "LEVASSEUR"},
    {"id_crmuser": 17, "email": "faure@crm.com", "user_name": "FAURE"},
    {"id_crmuser": 56, "email": "lucas@crm.com", "user_name": "LUCAS"},
    {"id_crmuser": 18, "email": "deville@crm.com", "user_name": "DEVILLE"},
    {"id_crmuser": 19, "email": "barca@crm.com", "user_name": "BARCA"},
    {"id_crmuser": 20, "email": "valerie@crm.com", "user_name": "VALERIE"},
    {"id_crmuser": 21, "email": "perolie@crm.com", "user_name": "PEROLIE"},
    {"id_crmuser": 22, "email": "lepik@crm.com", "user_name": "LEPIK"},
    {"id_crmuser": 24, "email": "berry@crm.com", "user_name": "BERRY"},
    {"id_crmuser": 32, "email": "lepikconf@crm.com", "user_name": "LEPIK CONF"},
    {"id_crmuser": 29, "email": "reatribution@crm.com", "user_name": "REATRIBUTION"},
    {"id_crmuser": 34, "email": "berryconf@crm.com", "user_name": "BERRY CONF"},
    {"id_crmuser": 35, "email": "santiconf@crm.com", "user_name": "SANTI CONF"},
    {"id_crmuser": 36, "email": "pavyconf@crm.com", "user_name": "PAVY CONF"},
    {"id_crmuser": 42, "email": "guillemain@crm.com", "user_name": "GUILLEMAIN"},
    {"id_crmuser": 39, "email": "didier@crm.com", "user_name": "DIDIER"},
    {"id_crmuser": 38, "email": "menardconf@crm.com", "user_name": "MENARD CONF"},
    {"id_crmuser": 33, "email": "rebecca@crm.com", "user_name": "REBECCA"},
    {"id_crmuser": 30, "email": "mikoconf@ss.com", "user_name": "test miko conf"},
    {"id_crmuser": 37, "email": "santi@crm.com", "user_name": "SANTI"},
    {"id_crmuser": 50, "email": "didierconf@crm.com", "user_name": "DIDIER CONF"},
    {"id_crmuser": 41, "email": "commandeur@crm.com", "user_name": "COMMANDEUR"},
    {"id_crmuser": 43, "email": "testctc@crm.com", "user_name": "TESTCTC"},
    {"id_crmuser": 49, "email": "philippe@crm.com", "user_name": "Philippe"},
    {"id_crmuser": 44, "email": "faureconf@crm.com", "user_name": "FAURE CONF"},
    {"id_crmuser": 47, "email": "vini@crm.com", "user_name": "VINI"},
    {"id_crmuser": 46, "email": "guillemainconf@crm.com", "user_name": "GUILLEMAIN CONF"},
    {"id_crmuser": 54, "email": "delcourt@crm.com", "user_name": "DELCOURT"},
    {"id_crmuser": 51, "email": "beguin@crm.com", "user_name": "BEGUIN"},
    {"id_crmuser": 55, "email": "audrey@crm.com", "user_name": "AUDREY"},
    {"id_crmuser": 52, "email": "lessec@crm.com", "user_name": "LESSEC"},
    {"id_crmuser": 53, "email": "test@test.test", "user_name": "test123"},
]


def find_new_user_by_old_crm_id(old_crm_user_id: int) -> Optional[DjangoUser]:
    """
    Find a new database user by matching old CRM user ID.
    First tries to match by email (case-insensitive), then by username.
    
    Args:
        old_crm_user_id: The old CRM user ID (integer)
        
    Returns:
        DjangoUser instance if found, None otherwise
    """
    # Find the old CRM user mapping
    old_crm_user = next(
        (u for u in OLD_CRM_USER_MAPPING if u["id_crmuser"] == old_crm_user_id),
        None
    )
    
    if not old_crm_user:
        return None
    
    # Try to match by email first (case-insensitive)
    try:
        user = DjangoUser.objects.get(email__iexact=old_crm_user["email"].strip())
        return user
    except (DjangoUser.DoesNotExist, DjangoUser.MultipleObjectsReturned):
        pass
    
    # Try to match by username (case-insensitive)
    try:
        user = DjangoUser.objects.get(username__iexact=old_crm_user["user_name"].strip())
        return user
    except (DjangoUser.DoesNotExist, DjangoUser.MultipleObjectsReturned):
        pass
    
    # Try to match by first_name + last_name combination
    user_name_parts = old_crm_user["user_name"].strip().split()
    if len(user_name_parts) >= 2:
        first_name = user_name_parts[0]
        last_name = " ".join(user_name_parts[1:])
        try:
            user = DjangoUser.objects.filter(
                first_name__iexact=first_name,
                last_name__iexact=last_name
            ).first()
            if user:
                return user
        except Exception:
            pass
    
    return None


def auto_populate_user_mapping(old_user_ids: List[int]) -> Dict[str, str]:
    """
    Auto-populate user ID mapping based on old CRM user IDs.
    
    Args:
        old_user_ids: List of old CRM user IDs (integers)
        
    Returns:
        Dictionary mapping old user IDs (as strings) to new user IDs (as strings)
    """
    mapping = {}
    
    for old_user_id in old_user_ids:
        new_user = find_new_user_by_old_crm_id(old_user_id)
        if new_user:
            mapping[str(old_user_id)] = str(new_user.id)
    
    return mapping


def get_old_crm_user_info(old_crm_user_id: int) -> Optional[Dict[str, any]]:
    """
    Get information about an old CRM user.
    
    Args:
        old_crm_user_id: The old CRM user ID (integer)
        
    Returns:
        Dictionary with email and user_name, or None if not found
    """
    return next(
        (u for u in OLD_CRM_USER_MAPPING if u["id_crmuser"] == old_crm_user_id),
        None
    )






