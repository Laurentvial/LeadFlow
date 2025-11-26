# Generated migration to clear all phone numbers

from django.db import migrations


def clear_phone_numbers(apps, schema_editor):
    """Clear all phone numbers from Contact and UserDetails models"""
    Contact = apps.get_model('api', 'Contact')
    UserDetails = apps.get_model('api', 'UserDetails')
    
    # Clear all phone numbers by setting to NULL (not empty string)
    Contact.objects.update(phone=None, mobile=None)
    UserDetails.objects.update(phone=None)


def reverse_clear_phone_numbers(apps, schema_editor):
    """Reverse migration - nothing to do as we can't restore deleted data"""
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0060_alter_note_options_note_api_note_contact_b6d266_idx_and_more'),
    ]

    operations = [
        migrations.RunPython(clear_phone_numbers, reverse_clear_phone_numbers),
    ]
