-- TEMPORARY SQL SCRIPT: Delete all contacts and related data
-- WARNING: This operation cannot be undone!
-- Execute this script at your own risk
-- 
-- Usage:
--   SQLite: sqlite3 db.sqlite3 < delete_all_contacts.sql
--   PostgreSQL: psql -d your_database -f delete_all_contacts.sql
--   MySQL: mysql -u username -p database_name < delete_all_contacts.sql

BEGIN TRANSACTION;

-- Step 1: Delete Documents (CASCADE relationship - will be deleted automatically, but explicit is safer)
DELETE FROM api_document WHERE contact_id_id IN (SELECT id FROM api_contact);

-- Step 2: Delete Notes (CASCADE relationship - will be deleted automatically, but explicit is safer)
DELETE FROM api_note WHERE "contactId_id" IN (SELECT id FROM api_contact);

-- Step 3: Delete Events linked to contacts (SET_NULL relationship - we delete them)
DELETE FROM api_event WHERE "contactId_id" IN (SELECT id FROM api_contact);

-- Step 4: Delete Logs linked to contacts (SET_NULL relationship - we delete them)
DELETE FROM api_log WHERE contact_id_id IN (SELECT id FROM api_contact);

-- Step 5: Delete Emails linked to contacts (SET_NULL relationship - we delete them)
DELETE FROM api_email WHERE contact_id IN (SELECT id FROM api_contact);

-- Step 6: Finally, delete all contacts
DELETE FROM api_contact;

-- Commit the transaction (or ROLLBACK if something went wrong)
COMMIT;

-- Verify deletion (uncomment to check)
-- SELECT COUNT(*) as remaining_contacts FROM api_contact;
-- SELECT COUNT(*) as remaining_documents FROM api_document;
-- SELECT COUNT(*) as remaining_notes FROM api_note;
-- SELECT COUNT(*) as remaining_events FROM api_event;
-- SELECT COUNT(*) as remaining_logs FROM api_log;
-- SELECT COUNT(*) as remaining_emails FROM api_email;
