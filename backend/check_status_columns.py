#!/usr/bin/env python
"""
Script to check if Status model columns exist in the database
Run: python manage.py shell < check_status_columns.py
Or: python manage.py shell
Then paste the code below
"""

import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.db import connection
from api.models import Status

# Check database columns
with connection.cursor() as cursor:
    # Get table name (usually api_status)
    table_name = Status._meta.db_table
    print(f"Checking table: {table_name}")
    
    # Get column information
    if 'sqlite' in connection.settings_dict['ENGINE']:
        cursor.execute(f"PRAGMA table_info({table_name})")
        columns = cursor.fetchall()
        print("\nColumns in database:")
        for col in columns:
            print(f"  - {col[1]} ({col[2]})")
    else:
        # PostgreSQL/MySQL
        cursor.execute(f"""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = '{table_name}'
            ORDER BY ordinal_position
        """)
        columns = cursor.fetchall()
        print("\nColumns in database:")
        for col in columns:
            print(f"  - {col[0]} ({col[1]})")

# Check model fields
print("\nModel fields:")
for field in Status._meta.get_fields():
    if hasattr(field, 'column'):
        print(f"  - {field.name} -> column: {field.column}")

# Check if specific fields exist
print("\nField existence check:")
print(f"  - hasattr(Status, 'is_event'): {hasattr(Status(), 'is_event')}")
print(f"  - hasattr(Status, 'is_fosse_default'): {hasattr(Status(), 'is_fosse_default')}")
print(f"  - hasattr(Status, 'is_admin'): {hasattr(Status(), 'is_admin')}")

# Try to get a status and check its fields
try:
    status = Status.objects.first()
    if status:
        print(f"\nSample status (ID: {status.id}):")
        print(f"  - is_event: {getattr(status, 'is_event', 'FIELD NOT FOUND')}")
        print(f"  - is_fosse_default: {getattr(status, 'is_fosse_default', 'FIELD NOT FOUND')}")
        print(f"  - is_admin: {getattr(status, 'is_admin', 'FIELD NOT FOUND')}")
except Exception as e:
    print(f"\nError checking status: {e}")

