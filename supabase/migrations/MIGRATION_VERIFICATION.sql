-- Migration Verification & Audit Queries
-- Run these queries AFTER migration to verify data integrity

-- ============================================================================
-- QUERY 1: Basic Migration Status
-- ============================================================================

-- Check if both tables exist
SELECT
  'memory_notes_old' as table_name,
  EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'memory_notes_old') as exists
UNION ALL
SELECT
  'memories' as table_name,
  EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'memories') as exists;

-- ============================================================================
-- QUERY 2: Row Count Verification
-- ============================================================================

SELECT
  'memory_notes_old' as source,
  COUNT(*) as total_rows
FROM memory_notes_old
UNION ALL
SELECT
  'memories (all)' as source,
  COUNT(*) as total_rows
FROM memories
UNION ALL
SELECT
  'memories (migrated only)' as source,
  COUNT(*) as total_rows
FROM memories
WHERE source = 'migration'
UNION ALL
SELECT
  'memories (new data)' as source,
  COUNT(*) as total_rows
FROM memories
WHERE source != 'migration';

-- ============================================================================
-- QUERY 3: Orphaned Row Detection
-- ============================================================================

-- Find any rows not successfully migrated
SELECT
  'Orphaned rows' as check_type,
  COUNT(*) as count
FROM memory_notes_old
WHERE id NOT IN (SELECT id FROM memories WHERE source = 'migration');

-- If count > 0, these rows were not migrated:
SELECT
  id,
  workspace_id,
  content,
  created_at
FROM memory_notes_old
WHERE id NOT IN (SELECT id FROM memories WHERE source = 'migration')
LIMIT 20;

-- ============================================================================
-- QUERY 4: Migration Audit Trail
-- ============================================================================

SELECT * FROM migration_audit_trail;

-- ============================================================================
-- QUERY 5: Sample Migrated Data
-- ============================================================================

-- View first 10 migrated records
SELECT
  id,
  workspace_id,
  content,
  summary,
  memory_type,
  importance_score,
  protection_level,
  source,
  confidence,
  regime_context,
  created_at
FROM memories
WHERE source = 'migration'
ORDER BY created_at DESC
LIMIT 10;

-- ============================================================================
-- QUERY 6: Migration Success Summary
-- ============================================================================

DO $$
DECLARE
  v_old_count INTEGER := 0;
  v_migrated_count INTEGER := 0;
  v_orphaned_count INTEGER := 0;
  v_new_count INTEGER := 0;
  v_success BOOLEAN := FALSE;
BEGIN
  SELECT COUNT(*) INTO v_old_count FROM memory_notes_old;
  SELECT COUNT(*) INTO v_migrated_count FROM memories WHERE source = 'migration';
  SELECT COUNT(*) INTO v_new_count FROM memories;
  SELECT COUNT(*) INTO v_orphaned_count FROM memory_notes_old
    WHERE id NOT IN (SELECT id FROM memories WHERE source = 'migration');

  v_success := (v_old_count = v_migrated_count) AND (v_orphaned_count = 0);

  RAISE NOTICE '';
  RAISE NOTICE '========== MIGRATION VERIFICATION SUMMARY ==========';
  RAISE NOTICE 'Old table (memory_notes_old): % rows', v_old_count;
  RAISE NOTICE 'New table (memories total): % rows', v_new_count;
  RAISE NOTICE 'Successfully migrated: % rows', v_migrated_count;
  RAISE NOTICE 'Orphaned (not migrated): % rows', v_orphaned_count;
  RAISE NOTICE '';

  IF v_success THEN
    RAISE NOTICE 'STATUS: MIGRATION SUCCESSFUL';
    RAISE NOTICE 'All % rows have been successfully migrated', v_old_count;
    RAISE NOTICE 'No orphaned rows found';
    RAISE NOTICE 'Safe to proceed with cleanup';
  ELSE
    IF v_orphaned_count > 0 THEN
      RAISE WARNING 'STATUS: MIGRATION FAILED - Orphaned rows detected';
      RAISE WARNING 'Found % rows not migrated', v_orphaned_count;
    END IF;
    IF v_migrated_count != v_old_count THEN
      RAISE WARNING 'STATUS: MIGRATION INCOMPLETE - Row count mismatch';
      RAISE WARNING 'Expected: %, Migrated: %', v_old_count, v_migrated_count;
    END IF;
  END IF;

  RAISE NOTICE '====================================================';
END $$;

-- ============================================================================
-- QUERY 7: Data Quality Checks
-- ============================================================================

-- Check for NULL values in critical columns (should be 0)
SELECT
  'NULL values in migrated data' as check_type,
  SUM(CASE WHEN id IS NULL THEN 1 ELSE 0 END) as null_ids,
  SUM(CASE WHEN workspace_id IS NULL THEN 1 ELSE 0 END) as null_workspace_ids,
  SUM(CASE WHEN content IS NULL THEN 1 ELSE 0 END) as null_content
FROM memories
WHERE source = 'migration';

-- Check for invalid importance scores
SELECT
  'Invalid importance scores' as check_type,
  COUNT(*) as count
FROM memories
WHERE source = 'migration'
AND (importance_score < 0.0 OR importance_score > 1.0);

-- Check for invalid protection levels
SELECT
  'Invalid protection levels' as check_type,
  COUNT(*) as count
FROM memories
WHERE source = 'migration'
AND (protection_level < 0 OR protection_level > 3);

-- ============================================================================
-- QUERY 8: Migration Timeline
-- ============================================================================

-- Check distribution of migrated data by creation date
SELECT
  DATE(created_at) as creation_date,
  COUNT(*) as migrated_count
FROM memories
WHERE source = 'migration'
GROUP BY DATE(created_at)
ORDER BY DATE(created_at) DESC;

-- ============================================================================
-- QUERY 9: Workspace Distribution (Verify mapping)
-- ============================================================================

-- Show count of migrated records per workspace
SELECT
  workspace_id,
  COUNT(*) as migrated_count,
  MIN(created_at) as oldest,
  MAX(created_at) as newest
FROM memories
WHERE source = 'migration'
GROUP BY workspace_id
ORDER BY COUNT(*) DESC;

-- ============================================================================
-- QUERY 10: Cleanup Checklist
-- ============================================================================

-- Run this to generate cleanup verification
DO $$
DECLARE
  v_old_count INTEGER := 0;
  v_migration_count INTEGER := 0;
  v_orphaned_count INTEGER := 0;
BEGIN
  SELECT COUNT(*) INTO v_old_count FROM memory_notes_old;
  SELECT COUNT(*) INTO v_migration_count FROM memories WHERE source = 'migration';
  SELECT COUNT(*) INTO v_orphaned_count FROM memory_notes_old
    WHERE id NOT IN (SELECT id FROM memories WHERE source = 'migration');

  RAISE NOTICE '';
  RAISE NOTICE '========== CLEANUP READINESS CHECKLIST ==========';
  RAISE NOTICE '[%] All rows migrated: % == %', CASE WHEN v_old_count = v_migration_count THEN 'X' ELSE ' ' END, v_old_count, v_migration_count;
  RAISE NOTICE '[%] No orphaned rows: count = %', CASE WHEN v_orphaned_count = 0 THEN 'X' ELSE ' ' END, v_orphaned_count;
  RAISE NOTICE '[%] Audit trail available: SELECT * FROM migration_audit_trail';
  RAISE NOTICE '[%] Application tested with new schema';
  RAISE NOTICE '[%] Rollback plan understood (in SAFE_DATA_MIGRATION_STRATEGY.md)';
  RAISE NOTICE '';

  IF v_old_count = v_migration_count AND v_orphaned_count = 0 THEN
    RAISE NOTICE 'SAFE TO RUN CLEANUP: Execute 20251123000001_cleanup_memory_notes_old.sql';
  ELSE
    RAISE WARNING 'NOT SAFE TO RUN CLEANUP: Address issues above first';
  END IF;

  RAISE NOTICE '=================================================';
END $$;
