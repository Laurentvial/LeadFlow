"""
Email verification utility using DNS MX record check
"""
import dns.resolver
from typing import Tuple, Optional

# Email verification status choices
EMAIL_VERIFICATION_STATUS_CHOICES = [
    ('not_verified', 'Not Verified'),
    ('valid', 'Valid'),
    ('invalid', 'Invalid'),
]

def verify_email_domain(email: str, timeout: int = 5) -> Tuple[str, Optional[str]]:
    """
    Verify if email domain has MX records (accepts email)
    
    Args:
        email: Email address to verify
        timeout: DNS query timeout in seconds
        
    Returns:
        Tuple of (status, message)
        status: 'valid', 'invalid', or 'not_verified'
        message: Human-readable message (None if valid)
    """
    if not email or not isinstance(email, str):
        return 'not_verified', None
    
    email = email.strip()
    if not email:
        return 'not_verified', None
    
    try:
        # Extract domain from email
        if '@' not in email:
            return 'invalid', 'Invalid email format'
        
        domain = email.split('@')[1]
        if not domain:
            return 'invalid', 'Invalid email format'
        
        # Check MX records
        try:
            resolver = dns.resolver.Resolver()
            resolver.timeout = timeout
            resolver.lifetime = timeout
            mx_records = resolver.resolve(domain, 'MX')
            
            # Check if mx_records exists and has records
            # mx_records is a dns.resolver.Answer object, which supports len()
            if mx_records is None:
                return 'invalid', 'Domain does not accept email (no MX records)'
            
            # Safely get the length
            try:
                record_count = len(mx_records)
                if isinstance(record_count, int) and record_count > 0:
                    return 'valid', None
            except (TypeError, AttributeError):
                # If len() fails, try to iterate to check if there are records
                try:
                    if any(True for _ in mx_records):
                        return 'valid', None
                except:
                    pass
            
            return 'invalid', 'Domain does not accept email (no MX records)'
                
        except dns.resolver.NXDOMAIN:
            return 'invalid', 'Domain does not exist'
        except dns.resolver.NoAnswer:
            # Some domains might use A records for email (rare but possible)
            # Try to check if domain exists at least
            try:
                resolver.resolve(domain, 'A')
                return 'invalid', 'Domain exists but does not accept email (no MX records)'
            except:
                return 'invalid', 'Domain does not exist'
        except dns.resolver.Timeout:
            return 'not_verified', 'DNS query timeout'
        except dns.resolver.NoNameservers:
            return 'not_verified', 'No nameservers found'
        except Exception as e:
            # Log the error but don't fail - return not_verified
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Email verification error for {email}: {str(e)}")
            return 'not_verified', f'DNS lookup error: {str(e)}'
            
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Unexpected error during email verification for {email}: {str(e)}")
        return 'not_verified', f'Error: {str(e)}'

