# Generated manually

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0045_remove_event_clientid_remove_note_clientid_and_more'),
    ]

    operations = [
        migrations.RenameField(
            model_name='userdetails',
            old_name='role',
            new_name='role_id',
        ),
        migrations.AlterField(
            model_name='userdetails',
            name='role_id',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='users', to='api.role', db_column='role_id'),
        ),
    ]

