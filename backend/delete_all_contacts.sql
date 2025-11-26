-- SQL script to delete all contacts from the database
-- WARNING: This will permanently delete ALL contacts and cannot be undone!
-- Make sure you have a backup before running this script.

-- Step 1: Set foreign keys to NULL for records that use SET_NULL
-- This must be done BEFORE deleting contacts to avoid foreign key constraint violations
-- Django creates columns with _id suffix for ForeignKey fields

-- Set contact_id_id to NULL in logs table (Django adds _id suffix to ForeignKey field names)
UPDATE api_log SET contact_id_id = NULL WHERE contact_id_id IS NOT NULL;

-- Set contactId_id to NULL in events table
UPDATE api_event SET "contactId_id" = NULL WHERE "contactId_id" IS NOT NULL;

-- Set contact_id to NULL in emails table
UPDATE api_email SET contact_id = NULL WHERE contact_id IS NOT NULL;

-- Step 2: Delete records that have CASCADE relationships
-- Even though Django models specify CASCADE, raw SQL requires manual deletion

-- Delete documents associated with contacts (CASCADE relationship)
DELETE FROM api_document WHERE contact_id_id IS NOT NULL;

-- Delete notes associated with contacts (CASCADE relationship)
DELETE FROM api_note WHERE "contactId_id" IS NOT NULL;

-- Step 3: Now delete all contacts
DELETE FROM api_contact;

-- Verify deletion
SELECT COUNT(*) as remaining_contacts FROM api_contact;

-- Optional: Check related records that were set to NULL
-- SELECT COUNT(*) as events_with_null_contact FROM api_event WHERE "contactId_id" IS NULL;
-- SELECT COUNT(*) as logs_with_null_contact FROM api_log WHERE contact_id_id IS NULL;
-- SELECT COUNT(*) as emails_with_null_contact FROM api_email WHERE contact_id IS NULL;

