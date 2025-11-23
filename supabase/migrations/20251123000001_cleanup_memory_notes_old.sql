-- Cleanup Migration: Remove memory_notes_old backup table
-- ONLY RUN THIS AFTER CONFIRMING:
-- 1. Data migration from memory_notes_old → memories was successful
-- 2. Row counts match exactly
-- 3. Application is working with new memories table
-- 4. No orphaned rows exist
-- 5. Audit trail has been reviewed

-- ============================================================================
-- STEP 5: Final cleanup (ONLY AFTER VALIDATION PASSES)
-- ============================================================================

-- Final validation before cleanup
DO $$
DECLARE
  v_old_count INTEGER := 0;
  v_migration_count INTEGER := 0;
  v_orphaned_count INTEGER := 0;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'memory_notes_old') THEN
    SELECT COUNT(*) INTO v_old_count FROM memory_notes_old;
    SELECT COUNT(*) INTO v_migration_count FROM memories WHERE source = 'migration';
    SELECT COUNT(*) INTO v_orphaned_count FROM memory_notes_old
      WHERE id NOT IN (SELECT id FROM memories WHERE source = 'migration');

    RAISE NOTICE '';
    RAISE NOTICE '========== FINAL CLEANUP VALIDATION ==========';
    RAISE NOTICE 'Rows in memory_notes_old (to be deleted): %', v_old_count;
    RAISE NOTICE 'Rows in memories (migrated): %', v_migration_count;
    RAISE NOTICE 'Orphaned rows: %', v_orphaned_count;
    RAISE NOTICE '============================================';

    IF v_orphaned_count > 0 THEN
      RAISE WARNING 'CLEANUP BLOCKED: Found % orphaned rows!', v_orphaned_count;
      RAISE WARNING 'Please resolve orphaned rows before running cleanup.';
      RAISE EXCEPTION 'Cleanup aborted due to data integrity concerns';
    ELSIF v_old_count > 0 AND v_migration_count != v_old_count THEN
      RAISE WARNING 'CLEANUP BLOCKED: Row count mismatch!';
      RAISE WARNING 'Expected: %, Migrated: %', v_old_count, v_migration_count;
      RAISE EXCEPTION 'Cleanup aborted due to row count mismatch';
    ELSE
      RAISE NOTICE 'CLEANUP VALIDATION: PASSED - Safe to proceed';
    END IF;
  ELSE
    RAISE NOTICE 'memory_notes_old table does not exist - cleanup already completed or not applicable';
  END IF;
END $$;

-- Drop the backup table (only if validation passed above)
DROP TABLE IF EXISTS memory_notes_old;

-- Drop the audit trail view
DROP VIEW IF EXISTS migration_audit_trail;

-- Final confirmation
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========== CLEANUP COMPLETED ==========';
  RAISE NOTICE 'memory_notes_old table has been dropped';
  RAISE NOTICE 'migration_audit_trail view has been dropped';
  RAISE NOTICE 'Migration cleanup is complete';
  RAISE NOTICE '======================================';
END $$;
