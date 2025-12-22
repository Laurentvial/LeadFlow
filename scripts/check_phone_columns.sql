-- Script to check the current state of phone columns
-- Run this first to see what needs to be migrated

-- Check column types
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('api_contact', 'api_userdetails')
  AND column_name IN ('phone', 'mobile')
ORDER BY table_name, column_name;

-- Check sample data and types
SELECT 
    'api_contact' as table_name,
    id,
    phone,
    mobile,
    pg_typeof(phone) as phone_type,
    pg_typeof(mobile) as mobile_type
FROM api_contact
LIMIT 5;

-- Check if there are any empty strings or what values exist
SELECT 
    'api_contact' as table_name,
    COUNT(*) as total_rows,
    COUNT(CASE WHEN phone::text = '' OR phone::text = ' ' THEN 1 END) as empty_phone_count,
    COUNT(CASE WHEN mobile::text = '' OR mobile::text = ' ' THEN 1 END) as empty_mobile_count,
    COUNT(CASE WHEN phone IS NULL THEN 1 END) as null_phone_count,
    COUNT(CASE WHEN mobile IS NULL THEN 1 END) as null_mobile_count,
    COUNT(CASE WHEN phone IS NOT NULL THEN 1 END) as non_null_phone_count,
    COUNT(CASE WHEN mobile IS NOT NULL THEN 1 END) as non_null_mobile_count
FROM api_contact;
