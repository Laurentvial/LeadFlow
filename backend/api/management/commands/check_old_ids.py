"""
Management command to check CSV file for old IDs that are not in the database.
Reads a CSV file, checks which old IDs don't exist in the database,
and outputs the remaining rows to a new CSV file.
"""
import csv
import os
from django.core.management.base import BaseCommand
from api.models import Contact


class Command(BaseCommand):
    help = 'Check CSV file for old IDs not in database and output remaining rows'

    def add_arguments(self, parser):
        parser.add_argument(
            'csv_file',
            type=str,
            help='Path to the CSV file to check'
        )
        parser.add_argument(
            '--old-id-column',
            type=str,
            default=None,
            help='Name of the column containing old IDs (default: auto-detect from common names)'
        )
        parser.add_argument(
            '--output',
            type=str,
            default=None,
            help='Output CSV file path (default: input_filename_missing.csv)'
        )

    def handle(self, *args, **options):
        csv_file_path = options['csv_file']
        old_id_column = options.get('old_id_column')
        output_file = options.get('output')

        # Validate input file exists
        if not os.path.exists(csv_file_path):
            self.stdout.write(self.style.ERROR(f'CSV file not found: {csv_file_path}'))
            return

        # Set default output file if not provided
        if not output_file:
            base_name = os.path.splitext(csv_file_path)[0]
            output_file = f'{base_name}_missing.csv'

        try:
            # Read CSV file
            self.stdout.write(f'Reading CSV file: {csv_file_path}')
            with open(csv_file_path, 'r', encoding='utf-8-sig') as f:
                # Try to detect delimiter
                sample = f.read(1024)
                f.seek(0)
                sniffer = csv.Sniffer()
                delimiter = sniffer.sniff(sample).delimiter
                
                reader = csv.DictReader(f, delimiter=delimiter)
                rows = list(reader)
                
                if not rows:
                    self.stdout.write(self.style.ERROR('CSV file is empty'))
                    return

                # Get column names
                fieldnames = reader.fieldnames
                if not fieldnames:
                    self.stdout.write(self.style.ERROR('CSV file has no headers'))
                    return

                self.stdout.write(f'Found {len(rows)} rows in CSV')
                self.stdout.write(f'Columns: {", ".join(fieldnames)}')

                # Find old ID column
                if not old_id_column:
                    # Try common variations
                    possible_names = [
                        'old id', 'old_id', 'old_contact_id', 'oldContactId',
                        'old contact id', 'old-contact-id', 'oldcontactid',
                        'OLD_ID', 'OLD_CONTACT_ID', 'Old ID', 'Old Contact ID'
                    ]
                    old_id_column = None
                    for name in possible_names:
                        if name in fieldnames:
                            old_id_column = name
                            break
                    
                    if not old_id_column:
                        # Try case-insensitive search
                        fieldnames_lower = {f.lower(): f for f in fieldnames}
                        for name in possible_names:
                            name_lower = name.lower().replace('_', ' ').replace('-', ' ')
                            if name_lower in fieldnames_lower:
                                old_id_column = fieldnames_lower[name_lower]
                                break

                if not old_id_column:
                    self.stdout.write(self.style.ERROR(
                        'Could not find old ID column. Available columns: ' + ', '.join(fieldnames) +
                        '\nPlease specify the column name using --old-id-column option'
                    ))
                    return

                self.stdout.write(f'Using old ID column: {old_id_column}')

                # Extract all old IDs from CSV
                old_ids_in_csv = []
                for i, row in enumerate(rows):
                    old_id = str(row.get(old_id_column, '')).strip()
                    if old_id:
                        old_ids_in_csv.append((i, old_id, row))

                self.stdout.write(f'Found {len(old_ids_in_csv)} rows with old IDs')

                if not old_ids_in_csv:
                    self.stdout.write(self.style.WARNING('No old IDs found in CSV file'))
                    return

                # Query database for existing old IDs
                self.stdout.write('Checking database for existing old IDs...')
                old_id_values = [old_id for _, old_id, _ in old_ids_in_csv]
                
                # Query in batches to avoid memory issues with large datasets
                existing_old_ids = set()
                batch_size = 1000
                for i in range(0, len(old_id_values), batch_size):
                    batch = old_id_values[i:i + batch_size]
                    existing = Contact.objects.filter(
                        old_contact_id__in=batch
                    ).values_list('old_contact_id', flat=True)
                    existing_old_ids.update(str(id_val).strip() for id_val in existing if id_val)
                    
                    if (i // batch_size + 1) % 10 == 0:
                        self.stdout.write(f'  Processed {min(i + batch_size, len(old_id_values))} IDs...')

                self.stdout.write(f'Found {len(existing_old_ids)} existing old IDs in database')

                # Find rows with old IDs NOT in database
                missing_rows = []
                for row_index, old_id, row in old_ids_in_csv:
                    old_id_stripped = old_id.strip()
                    if old_id_stripped not in existing_old_ids:
                        missing_rows.append(row)

                self.stdout.write(f'Found {len(missing_rows)} rows with old IDs NOT in database')
                self.stdout.write(f'Found {len(old_ids_in_csv) - len(missing_rows)} rows with old IDs already in database')

                # Write missing rows to output CSV
                if missing_rows:
                    self.stdout.write(f'Writing missing rows to: {output_file}')
                    with open(output_file, 'w', encoding='utf-8', newline='') as out_f:
                        writer = csv.DictWriter(out_f, fieldnames=fieldnames)
                        writer.writeheader()
                        writer.writerows(missing_rows)
                    
                    self.stdout.write(self.style.SUCCESS(
                        f'\nSuccessfully created output file: {output_file}\n'
                        f'Total rows in input: {len(rows)}\n'
                        f'Rows with old IDs: {len(old_ids_in_csv)}\n'
                        f'Rows already in database: {len(old_ids_in_csv) - len(missing_rows)}\n'
                        f'Rows NOT in database (exported): {len(missing_rows)}'
                    ))
                else:
                    self.stdout.write(self.style.SUCCESS(
                        '\nAll old IDs from CSV are already in the database!\n'
                        f'No output file created.'
                    ))

        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Error processing CSV file: {str(e)}'))
            import traceback
            self.stdout.write(self.style.ERROR(traceback.format_exc()))

