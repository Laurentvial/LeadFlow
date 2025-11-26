-- Script to verify if migration is needed or already done
-- Run this to check the current state

-- 1. Check column data types
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('api_contact', 'api_userdetails')
  AND column_name IN ('phone', 'mobile')
ORDER BY table_name, column_name;

-- 2. Check if there are any constraints
SELECT 
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.table_name IN ('api_contact', 'api_userdetails')
  AND kcu.column_name IN ('phone', 'mobile')
ORDER BY tc.table_name, kcu.column_name;

-- 3. Sample data check
SELECT 
    'api_contact' as table_name,
    COUNT(*) as total_rows,
    COUNT(phone) as phone_not_null_count,
    COUNT(mobile) as mobile_not_null_count,
    COUNT(*) - COUNT(phone) as phone_null_count,
    COUNT(*) - COUNT(mobile) as mobile_null_count
FROM api_contact;

-- 4. Check a few sample rows
SELECT 
    id,
    phone,
    mobile,
    pg_typeof(phone) as phone_type,
    pg_typeof(mobile) as mobile_type
FROM api_contact
LIMIT 3;

