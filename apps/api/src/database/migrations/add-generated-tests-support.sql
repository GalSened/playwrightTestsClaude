-- Migration: Add support for generated tests in the test bank
-- This adds columns to track AI-generated tests alongside discovered tests

-- Add new columns to tests table for generated test support
ALTER TABLE tests ADD COLUMN source_type TEXT DEFAULT 'discovered' CHECK (source_type IN ('discovered', 'generated'));
ALTER TABLE tests ADD COLUMN generated_metadata TEXT; -- JSON metadata for generated tests
ALTER TABLE tests ADD COLUMN parent_request_id INTEGER; -- Link to generation request
ALTER TABLE tests ADD COLUMN selection_mode TEXT CHECK (selection_mode IN ('all', 'selected', 'single', 'none'));
ALTER TABLE tests ADD COLUMN tags TEXT; -- Comma-separated tags
ALTER TABLE tests ADD COLUMN priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical'));

-- Rename and update existing columns to match new schema
ALTER TABLE tests ADD COLUMN name TEXT; -- Will be populated from test_name
ALTER TABLE tests ADD COLUMN status TEXT DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'archived'));
ALTER TABLE tests ADD COLUMN module TEXT; -- WeSign module (auth, documents, etc.)
ALTER TABLE tests ADD COLUMN language TEXT DEFAULT 'both' CHECK (language IN ('en', 'he', 'both'));
ALTER TABLE tests ADD COLUMN test_type TEXT DEFAULT 'test'; -- test, setup, helper, cleanup
ALTER TABLE tests ADD COLUMN framework TEXT; -- playwright, pytest

-- Update existing records to populate new columns
UPDATE tests SET 
    name = test_name,
    module = category,
    status = CASE WHEN is_active = 1 THEN 'active' ELSE 'disabled' END,
    test_type = 'test',
    framework = CASE 
        WHEN file_path LIKE '%.spec.ts' THEN 'playwright'
        WHEN file_path LIKE '%.py' THEN 'pytest'
        ELSE 'unknown'
    END
WHERE name IS NULL;

-- Create new indexes for performance on generated tests
CREATE INDEX IF NOT EXISTS idx_tests_source_type ON tests(source_type);
CREATE INDEX IF NOT EXISTS idx_tests_module ON tests(module);
CREATE INDEX IF NOT EXISTS idx_tests_status ON tests(status);
CREATE INDEX IF NOT EXISTS idx_tests_priority ON tests(priority);
CREATE INDEX IF NOT EXISTS idx_tests_framework ON tests(framework);
CREATE INDEX IF NOT EXISTS idx_tests_parent_request ON tests(parent_request_id);

-- Create view for generated tests specifically
CREATE VIEW IF NOT EXISTS generated_tests AS
SELECT 
    t.*,
    json_extract(t.generated_metadata, '$.originalAction') as original_action,
    json_extract(t.generated_metadata, '$.generatedAt') as generated_at,
    json_extract(t.generated_metadata, '$.category') as generation_category,
    json_extract(t.generated_metadata, '$.testIndex') as test_index
FROM tests t
WHERE t.source_type = 'generated'
ORDER BY t.created_at DESC;

-- Create view for test bank summary combining discovered and generated
CREATE VIEW IF NOT EXISTS test_bank_summary AS
SELECT 
    module,
    framework,
    source_type,
    status,
    COUNT(*) as test_count,
    COUNT(CASE WHEN last_status = 'passed' THEN 1 END) as passed_count,
    COUNT(CASE WHEN last_status = 'failed' THEN 1 END) as failed_count,
    COUNT(CASE WHEN last_status IS NULL THEN 1 END) as never_run_count,
    AVG(last_duration) as avg_duration_ms
FROM tests
WHERE status = 'active'
GROUP BY module, framework, source_type, status
ORDER BY module, framework, source_type;