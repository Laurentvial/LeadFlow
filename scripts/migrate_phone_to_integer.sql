-- SQL script to migrate phone fields from CharField to BigIntegerField
-- Run this manually in your PostgreSQL database, then fake the migration

-- Step 1: First, set all empty strings to a temporary placeholder value
-- This avoids the NOT NULL constraint violation (we can't set NULL yet)
UPDATE api_contact SET phone = 'TEMP_NULL' WHERE phone = '' OR phone = ' ';
UPDATE api_contact SET mobile = 'TEMP_NULL' WHERE mobile = '' OR mobile = ' ';
UPDATE api_userdetails SET phone = 'TEMP_NULL' WHERE phone = '' OR phone = ' ';

-- Step 2: Drop NOT NULL constraints (now that all values are non-empty strings)
ALTER TABLE api_contact ALTER COLUMN phone DROP NOT NULL;
ALTER TABLE api_contact ALTER COLUMN mobile DROP NOT NULL;
ALTER TABLE api_userdetails ALTER COLUMN phone DROP NOT NULL;

-- Step 3: Convert temporary placeholder values to NULL (now that constraint is dropped)
UPDATE api_contact SET phone = NULL WHERE phone = 'TEMP_NULL';
UPDATE api_contact SET mobile = NULL WHERE mobile = 'TEMP_NULL';
UPDATE api_userdetails SET phone = NULL WHERE phone = 'TEMP_NULL';

-- Step 4: Change column types to bigint
-- PostgreSQL will automatically convert valid numeric strings to integers
-- Invalid values (non-numeric strings) will be set to NULL
ALTER TABLE api_contact ALTER COLUMN phone TYPE bigint USING 
    CASE 
        WHEN phone ~ '^[0-9]+$' THEN phone::bigint
        ELSE NULL
    END;
    
ALTER TABLE api_contact ALTER COLUMN mobile TYPE bigint USING 
    CASE 
        WHEN mobile ~ '^[0-9]+$' THEN mobile::bigint
        ELSE NULL
    END;
    
ALTER TABLE api_userdetails ALTER COLUMN phone TYPE bigint USING 
    CASE 
        WHEN phone ~ '^[0-9]+$' THEN phone::bigint
        ELSE NULL
    END;

