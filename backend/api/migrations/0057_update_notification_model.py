# Generated manually for Notification model update

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def delete_old_notifications(apps, schema_editor):
    """Delete old notifications that don't have a user"""
    Notification = apps.get_model('api', 'Notification')
    # Delete all old notifications since they don't have user association
    Notification.objects.all().delete()


def reverse_delete(apps, schema_editor):
    """Reverse migration - nothing to do"""
    pass


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('api', '0056_chatroom_message_and_more'),
    ]

    operations = [
        # First, delete old notifications
        migrations.RunPython(delete_old_notifications, reverse_delete),
        
        # Remove old fields
        migrations.RemoveField(
            model_name='notification',
            name='messageId',
        ),
        migrations.RemoveField(
            model_name='notification',
            name='transactionId',
        ),
        
        # Add new fields
        migrations.AddField(
            model_name='notification',
            name='user',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='notifications',
                to=settings.AUTH_USER_MODEL,
                null=True  # Temporarily nullable
            ),
        ),
        migrations.AddField(
            model_name='notification',
            name='title',
            field=models.CharField(default='', max_length=200),
        ),
        migrations.AddField(
            model_name='notification',
            name='message',
            field=models.TextField(default=''),
        ),
        migrations.AddField(
            model_name='notification',
            name='message_id',
            field=models.CharField(blank=True, default='', max_length=12),
        ),
        migrations.AddField(
            model_name='notification',
            name='email_id',
            field=models.CharField(blank=True, default='', max_length=12),
        ),
        migrations.AddField(
            model_name='notification',
            name='contact_id',
            field=models.CharField(blank=True, default='', max_length=12),
        ),
        migrations.AddField(
            model_name='notification',
            name='event_id',
            field=models.CharField(blank=True, default='', max_length=12),
        ),
        migrations.AddField(
            model_name='notification',
            name='is_read',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='notification',
            name='data',
            field=models.JSONField(blank=True, default=dict),
        ),
        
        # Update type field to use choices
        migrations.AlterField(
            model_name='notification',
            name='type',
            field=models.CharField(
                choices=[
                    ('message', 'Nouveau message'),
                    ('email', 'Nouvel email'),
                    ('contact', 'Contact mis à jour'),
                    ('event', 'Nouvel événement'),
                    ('system', 'Notification système'),
                ],
                default='system',
                max_length=50
            ),
        ),
        
        # Make user field non-nullable
        migrations.AlterField(
            model_name='notification',
            name='user',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='notifications',
                to=settings.AUTH_USER_MODEL
            ),
        ),
        
        # Add indexes
        migrations.AddIndex(
            model_name='notification',
            index=models.Index(fields=['user', '-created_at'], name='api_notific_user_id_created_idx'),
        ),
        migrations.AddIndex(
            model_name='notification',
            index=models.Index(fields=['user', 'is_read'], name='api_notific_user_id_is_read_idx'),
        ),
    ]

