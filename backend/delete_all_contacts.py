"""
TEMPORARY SCRIPT: Delete all contacts and related data
WARNING: This operation cannot be undone!

Usage:
    python manage.py shell < delete_all_contacts.py
    OR
    python manage.py shell
    >>> exec(open('delete_all_contacts.py').read())
"""

from api.models import Contact, Document, Note, Event, Log, Email

# Get counts before deletion
contacts_count = Contact.objects.count()
documents_count = Document.objects.count()
notes_count = Note.objects.count()
events_count = Event.objects.filter(contactId__isnull=False).count()
logs_count = Log.objects.filter(contact_id__isnull=False).count()
emails_count = Email.objects.filter(contact__isnull=False).count()

print(f"Before deletion:")
print(f"  Contacts: {contacts_count}")
print(f"  Documents: {documents_count}")
print(f"  Notes: {notes_count}")
print(f"  Events (with contact): {events_count}")
print(f"  Logs (with contact): {logs_count}")
print(f"  Emails (with contact): {emails_count}")

# Confirm deletion
confirm = input("\nType 'DELETE_ALL' to confirm deletion: ")
if confirm != 'DELETE_ALL':
    print("Deletion cancelled.")
    exit()

# Step 1: Delete Documents (CASCADE - will be deleted automatically, but explicit is safer)
deleted_docs, _ = Document.objects.all().delete()
print(f"\nDeleted {deleted_docs} documents")

# Step 2: Delete Notes (CASCADE - will be deleted automatically, but explicit is safer)
deleted_notes, _ = Note.objects.all().delete()
print(f"Deleted {deleted_notes} notes")

# Step 3: Delete Events linked to contacts
deleted_events, _ = Event.objects.filter(contactId__isnull=False).delete()
print(f"Deleted {deleted_events} events")

# Step 4: Delete Logs linked to contacts
deleted_logs, _ = Log.objects.filter(contact_id__isnull=False).delete()
print(f"Deleted {deleted_logs} logs")

# Step 5: Delete Emails linked to contacts
deleted_emails, _ = Email.objects.filter(contact__isnull=False).delete()
print(f"Deleted {deleted_emails} emails")

# Step 6: Finally, delete all contacts
deleted_contacts, _ = Contact.objects.all().delete()
print(f"Deleted {deleted_contacts} contacts")

print(f"\nDeletion complete!")
print(f"Total deleted: {deleted_contacts} contacts")

