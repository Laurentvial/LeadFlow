-- SQL script to migrate phone fields from CharField to BigIntegerField
-- FIXED VERSION: Handles cases where columns might already be bigint or have no empty strings

-- Step 1: Check current column types first (run check_phone_columns.sql to see current state)

-- Step 2: Drop NOT NULL constraints if they exist (safe to run even if already dropped)
DO $$
BEGIN
    -- Drop NOT NULL constraints if they exist
    BEGIN
        ALTER TABLE api_contact ALTER COLUMN phone DROP NOT NULL;
    EXCEPTION WHEN OTHERS THEN
        -- Constraint might not exist, ignore
    END;
    
    BEGIN
        ALTER TABLE api_contact ALTER COLUMN mobile DROP NOT NULL;
    EXCEPTION WHEN OTHERS THEN
        -- Constraint might not exist, ignore
    END;
    
    BEGIN
        ALTER TABLE api_userdetails ALTER COLUMN phone DROP NOT NULL;
    EXCEPTION WHEN OTHERS THEN
        -- Constraint might not exist, ignore
    END;
END $$;

-- Step 3: Convert empty strings to NULL (only if columns are still varchar/text)
-- This will return 0 rows if columns are already bigint or if there are no empty strings
UPDATE api_contact 
SET phone = NULL 
WHERE (phone::text = '' OR phone::text = ' ' OR phone::text = 'TEMP_NULL')
  AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'api_contact' 
      AND column_name = 'phone' 
      AND data_type IN ('character varying', 'text', 'varchar')
  );

UPDATE api_contact 
SET mobile = NULL 
WHERE (mobile::text = '' OR mobile::text = ' ' OR mobile::text = 'TEMP_NULL')
  AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'api_contact' 
      AND column_name = 'mobile' 
      AND data_type IN ('character varying', 'text', 'varchar')
  );

UPDATE api_userdetails 
SET phone = NULL 
WHERE (phone::text = '' OR phone::text = ' ' OR phone::text = 'TEMP_NULL')
  AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'api_userdetails' 
      AND column_name = 'phone' 
      AND data_type IN ('character varying', 'text', 'varchar')
  );

-- Step 4: Change column types to bigint (only if they are not already bigint)
-- IMPORTANT: We must ensure NOT NULL constraints are dropped BEFORE converting types
DO $$
BEGIN
    -- Convert api_contact.phone
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'api_contact' 
          AND column_name = 'phone' 
          AND data_type NOT IN ('bigint', 'integer')
    ) THEN
        -- Ensure NOT NULL constraint is dropped first
        BEGIN
            ALTER TABLE api_contact ALTER COLUMN phone DROP NOT NULL;
        EXCEPTION WHEN OTHERS THEN
            -- Constraint might not exist, ignore
        END;
        
        -- Now convert the type
        ALTER TABLE api_contact ALTER COLUMN phone TYPE bigint USING 
            CASE 
                WHEN phone::text ~ '^[0-9]+$' THEN phone::text::bigint
                ELSE NULL
            END;
    END IF;
    
    -- Convert api_contact.mobile
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'api_contact' 
          AND column_name = 'mobile' 
          AND data_type NOT IN ('bigint', 'integer')
    ) THEN
        -- Ensure NOT NULL constraint is dropped first
        BEGIN
            ALTER TABLE api_contact ALTER COLUMN mobile DROP NOT NULL;
        EXCEPTION WHEN OTHERS THEN
            -- Constraint might not exist, ignore
        END;
        
        -- Now convert the type
        ALTER TABLE api_contact ALTER COLUMN mobile TYPE bigint USING 
            CASE 
                WHEN mobile::text ~ '^[0-9]+$' THEN mobile::text::bigint
                ELSE NULL
            END;
    END IF;
    
    -- Convert api_userdetails.phone
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'api_userdetails' 
          AND column_name = 'phone' 
          AND data_type NOT IN ('bigint', 'integer')
    ) THEN
        -- Ensure NOT NULL constraint is dropped first
        BEGIN
            ALTER TABLE api_userdetails ALTER COLUMN phone DROP NOT NULL;
        EXCEPTION WHEN OTHERS THEN
            -- Constraint might not exist, ignore
        END;
        
        -- Now convert the type
        ALTER TABLE api_userdetails ALTER COLUMN phone TYPE bigint USING 
            CASE 
                WHEN phone::text ~ '^[0-9]+$' THEN phone::text::bigint
                ELSE NULL
            END;
    END IF;
END $$;

