# Generated manually to handle django_user nullability and add team field

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def remove_null_django_users(apps, schema_editor):
    """Remove any UserDetails records that don't have a django_user"""
    UserDetails = apps.get_model('api', 'UserDetails')
    UserDetails.objects.filter(django_user__isnull=True).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0012_add_active_to_userdetails'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # First, remove any UserDetails without a django_user
        migrations.RunPython(remove_null_django_users, migrations.RunPython.noop),
        # Add the team field
        migrations.AddField(
            model_name='userdetails',
            name='team',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='members', to='api.team'),
        ),
        # Now make django_user non-nullable
        migrations.AlterField(
            model_name='userdetails',
            name='django_user',
            field=models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='user_details', to=settings.AUTH_USER_MODEL),
        ),
    ]
