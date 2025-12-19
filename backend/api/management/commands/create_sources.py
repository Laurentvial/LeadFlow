"""
Management command to create sources in the database.
"""
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from api.models import Source
import uuid


class Command(BaseCommand):
    help = 'Create sources in the database'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be created without actually doing it',
        )
        parser.add_argument(
            '--user-id',
            type=int,
            default=1,
            help='User ID to set as created_by (default: 1)',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        user_id = options['user_id']
        
        # List of sources to create
        source_names = [
            'DIAMANT 11/08',
            'DIAMANT 13/01',
            'DIAMANT 13/05',
            'DIAMANT 16/06',
            'DIAMANT 17/02',
            'DIAMANT 17/07/2025',
            'DIAMANT 18/08',
            'DIAMANT 20/01',
            'DIAMANT 20/05',
            'DIAMANT 2024',
            'DIAMANT 21/07/25',
            'DIAMANT 23/06',
            'DIAMANT 23/07/25',
            'DIAMANT 24/02',
            'DIAMANT 24/07/25',
            'DIAMANT 25/02',
            'DIAMANT 25/08',
            'DIAMANT 26/05',
            'DIAMANT 27/02',
            'DIAMANT 27/07',
            'DIAMANT 28/07',
            'DIAMANT 30/06',
            'DV',
            'DV 2',
            'FAF 03/06',
            'FAF 05/05',
            'FAF 09/06',
            'FAF 19/05',
            'FAF 24/06',
            'FAF 26/05',
            'GGP',
            'HUMB1',
            'HUMB2',
            'HUMB3',
            'HUMB4',
            'HUMB6',
            'HUMBERT',
            'KLEADS 29/07',
            'KLEADS 24/07',
            'LES ROMS',
            'LUD 23',
            'LVMH 03/02',
            'LVMH 15/01',
            'LVMH 20/01',
            'LVMH 27/01',
            'MAZ',
            'MAZ 2.0',
            'MAZ 3.0',
            'MM 21/07/25',
            'PONEY 22/04',
            'PONEY 28/04',
            'PONEY 31/03',
            'PONEY 24/03',
            'RAN 01/07',
            'RAN 24/06',
            'RAN 30/06',
            'RG 03/03',
            'RG 07/04',
            'ROCKY 25/03',
            'SAD 10/03',
            'SAD 13/01',
            'SAD 20/01',
            'SAD 2024',
            'SAD 27/01',
            'VICI 10/03',
            'VINGT 21/04',
            'VINGT 28/04',
            'VINGT OFF 05/05',
            'VINGT OFF 26/05',
            # Additional sources from image
            'ASH',
            'BERTO',
            'BERTO 15/07/25',
            'BERTO 21K',
            'BERTO/10K',
            'BERTO3K 15/07/25',
            'BLE 12/05',
            'BLU 2023',
            'BLU 2024',
            'BOUZE 02/04',
            'BRAHA 12/02',
            'BS 21/07/25',
            'CHEVAL 10/06',
            'CO25',
            'CO25 24.02',
            'DATA C',
            'DATA KSK',
            'DATA R',
            'DATA TOUCH',
            'DATA Z',
            'DIAMANT 01/07/25',
            'DIAMANT 03/02',
            'DIAMANT 03/03',
            'DIAMANT 04/08',
            'DIAMANT 05/05',
            'DIAMANT 06/01',
            'DIAMANT 07/07',
            'DIAMANT 09/06',
            'DIAMANT 10/02',
            'DIAMANT 10/06/25',
        ]
        
        # Get user if specified
        created_by = None
        if user_id:
            try:
                created_by = User.objects.get(id=user_id)
                self.stdout.write(f'Using user ID {user_id} ({created_by.username}) as created_by')
            except User.DoesNotExist:
                self.stdout.write(
                    self.style.WARNING(
                        f'User with ID {user_id} does not exist. Sources will be created without created_by.'
                    )
                )
        
        # Check which sources already exist
        existing_sources = Source.objects.filter(name__in=source_names)
        existing_names = set(existing_sources.values_list('name', flat=True))
        
        # Find which sources need to be created
        missing_names = [name for name in source_names if name not in existing_names]
        
        if existing_names:
            self.stdout.write(
                self.style.WARNING(
                    f'Found {len(existing_names)} existing source(s): {", ".join(sorted(existing_names))}'
                )
            )
        
        if not missing_names:
            self.stdout.write(
                self.style.SUCCESS(
                    'All sources already exist. Nothing to create.'
                )
            )
            return
        
        self.stdout.write(
            self.style.WARNING(
                f'\nWill create {len(missing_names)} new source(s).'
            )
        )
        
        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    f'\nDry run mode: Would create the following sources:\n'
                    + '\n'.join([f'  - {name}' for name in missing_names])
                    + '\n\nRemove --dry-run to create them.'
                )
            )
            return
        
        # Create missing sources
        created_count = 0
        skipped_count = 0
        
        for name in missing_names:
            # Generate unique ID
            source_id = uuid.uuid4().hex[:12]
            while Source.objects.filter(id=source_id).exists():
                source_id = uuid.uuid4().hex[:12]
            
            try:
                # Create source
                source = Source.objects.create(
                    id=source_id,
                    name=name,
                    created_by=created_by
                )
                created_count += 1
                self.stdout.write(
                    self.style.SUCCESS(f'Created source: {name} - ID: {source_id}')
                )
            except Exception as e:
                skipped_count += 1
                self.stdout.write(
                    self.style.ERROR(f'Failed to create source "{name}": {str(e)}')
                )
        
        self.stdout.write(
            self.style.SUCCESS(
                f'\nSuccessfully created {created_count} source(s).'
            )
        )
        
        if skipped_count > 0:
            self.stdout.write(
                self.style.WARNING(
                    f'Skipped {skipped_count} source(s) due to errors.'
                )
            )
