"""
Management command to forcefully close all database connections.
Use this when the database connection pool is exhausted.
"""
from django.core.management.base import BaseCommand
from django.db import connections, close_old_connections


class Command(BaseCommand):
    help = 'Close all database connections forcefully'

    def handle(self, *args, **options):
        self.stdout.write('Closing all database connections...')
        
        # Close old connections
        close_old_connections()
        
        # Explicitly close all connections
        for alias, connection in connections.databases.items():
            try:
                conn = connections[alias]
                if conn.connection is not None:
                    conn.close()
                    self.stdout.write(self.style.SUCCESS(f'Closed connection for {alias}'))
            except Exception as e:
                self.stdout.write(self.style.WARNING(f'Error closing {alias}: {str(e)}'))
        
        self.stdout.write(self.style.SUCCESS('All connections closed successfully'))

