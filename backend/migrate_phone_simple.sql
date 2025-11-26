-- SIMPLE VERSION: Just convert types and drop constraints
-- Run this if columns are still varchar/text

-- Step 1: Drop NOT NULL constraints (safe to run multiple times)
ALTER TABLE api_contact ALTER COLUMN phone DROP NOT NULL;
ALTER TABLE api_contact ALTER COLUMN mobile DROP NOT NULL;
ALTER TABLE api_userdetails ALTER COLUMN phone DROP NOT NULL;

-- Step 2: Convert types to bigint (will fail if already bigint, that's OK)
-- If you get an error saying "type bigint does not exist" or similar, 
-- it means columns are already bigint - you can skip this step

ALTER TABLE api_contact ALTER COLUMN phone TYPE bigint USING 
    CASE 
        WHEN phone::text ~ '^[0-9]+$' THEN phone::text::bigint
        ELSE NULL
    END;

ALTER TABLE api_contact ALTER COLUMN mobile TYPE bigint USING 
    CASE 
        WHEN mobile::text ~ '^[0-9]+$' THEN mobile::text::bigint
        ELSE NULL
    END;

ALTER TABLE api_userdetails ALTER COLUMN phone TYPE bigint USING 
    CASE 
        WHEN phone::text ~ '^[0-9]+$' THEN phone::text::bigint
        ELSE NULL
    END;

