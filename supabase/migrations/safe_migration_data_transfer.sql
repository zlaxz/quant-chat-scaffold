-- Safe Data Migration: memory_notes → memories
-- This file contains the complete migration code ready to insert
-- Insert AFTER all CREATE TABLE and CREATE INDEX statements in the main migration file

-- ============================================================================
-- STEP 2: Migrate data from memory_notes_old → memories (SAFE MIGRATION)
-- ============================================================================

-- Validate that old table exists and migrate data with integrity checks
DO $$
DECLARE
  v_old_row_count INTEGER := 0;
  v_new_row_count INTEGER := 0;
  v_migration_success BOOLEAN := FALSE;
BEGIN
  -- Check if backup table exists and count rows
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'memory_notes_old' AND table_schema = 'public') THEN

    -- Count rows before migration
    SELECT COUNT(*) INTO v_old_row_count FROM memory_notes_old;
    RAISE NOTICE '[Migration] Starting data migration: Found % rows in memory_notes_old', v_old_row_count;

    -- Only migrate if there's data to migrate
    IF v_old_row_count > 0 THEN
      -- Migrate data from old simple schema to new enhanced schema
      -- Map old columns: id, workspace_id, content, created_at → new columns
      -- Fill new columns with sensible defaults
      INSERT INTO memories (
        id,
        workspace_id,
        content,
        summary,
        memory_type,
        importance_score,
        protection_level,
        created_at,
        updated_at,
        source,
        confidence,
        regime_context
      )
      SELECT
        id,
        workspace_id,
        content,
        content, -- Use content as summary initially
        'observation', -- Default type for migrated data (conservative choice)
        0.5, -- Default importance for existing data
        2, -- Default protection level (standard - not immutable, not ephemeral)
        created_at,
        created_at, -- Set updated_at to created_at initially
        'migration', -- Mark source as migration to distinguish from new data
        0.8, -- Lower confidence for legacy data to indicate manual review may be needed
        '{"migrated": true, "source": "memory_notes", "migration_date": "' || NOW()::TEXT || '"}' -- Mark migration context
      FROM memory_notes_old
      WHERE id IS NOT NULL AND workspace_id IS NOT NULL AND content IS NOT NULL;

      -- Validate migration success by counting new rows
      SELECT COUNT(*) INTO v_new_row_count FROM memories WHERE source = 'migration';

      IF v_new_row_count = v_old_row_count THEN
        v_migration_success := TRUE;
        RAISE NOTICE '[Migration] SUCCESS: Migrated % rows to memories table', v_new_row_count;
        RAISE NOTICE '[Migration] All data successfully transferred with protection_level=2 (standard)';
      ELSE
        RAISE WARNING '[Migration] Row count mismatch! Expected: %, Actually migrated: %', v_old_row_count, v_new_row_count;
      END IF;
    ELSE
      -- No data in old table - that's fine
      RAISE NOTICE '[Migration] No data in memory_notes_old to migrate (table may be empty)';
      v_migration_success := TRUE;
    END IF;

  ELSE
    -- No old table exists - could be a fresh installation
    RAISE NOTICE '[Migration] No memory_notes_old table found. Skipping data migration (fresh installation?)';
    v_migration_success := TRUE;
  END IF;

  -- Safety check: warn if migration appears incomplete
  IF NOT v_migration_success AND v_old_row_count > 0 THEN
    RAISE WARNING '[Migration] !! DATA INTEGRITY WARNING !!';
    RAISE WARNING '[Migration] Migration appears incomplete. Backup table preserved.';
    RAISE WARNING '[Migration] Rows expected: % | Rows migrated: %', v_old_row_count, v_new_row_count;
    RAISE WARNING '[Migration] Please investigate before cleanup.';
  END IF;
END $$;

-- ============================================================================
-- STEP 3: Verify migration integrity and generate report
-- ============================================================================

-- Run validation query to ensure counts match and no data was lost
DO $$
DECLARE
  v_old_count INTEGER := 0;
  v_new_count INTEGER := 0;
  v_migration_count INTEGER := 0;
  v_orphaned_count INTEGER := 0;
  v_new_data_count INTEGER := 0;
BEGIN
  -- Count rows in backup table
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'memory_notes_old') THEN
    SELECT COUNT(*) INTO v_old_count FROM memory_notes_old;
  END IF;

  -- Count total rows in new table
  SELECT COUNT(*) INTO v_new_count FROM memories;

  -- Count rows that were migrated
  SELECT COUNT(*) INTO v_migration_count FROM memories WHERE source = 'migration';

  -- Count new rows added since migration (not from migration)
  SELECT COUNT(*) INTO v_new_data_count FROM memories WHERE source != 'migration';

  -- Check for orphaned rows (shouldn't happen, but check anyway)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'memory_notes_old') THEN
    SELECT COUNT(*) INTO v_orphaned_count FROM memory_notes_old
      WHERE id NOT IN (SELECT id FROM memories WHERE source = 'migration');
  END IF;

  -- Print validation report
  RAISE NOTICE '';
  RAISE NOTICE '========== MIGRATION VALIDATION REPORT ==========';
  RAISE NOTICE 'Rows in memory_notes_old: %', v_old_count;
  RAISE NOTICE 'Total rows in memories: %', v_new_count;
  RAISE NOTICE '  - Migrated rows (source=migration): %', v_migration_count;
  RAISE NOTICE '  - New data rows (source!=migration): %', v_new_data_count;
  RAISE NOTICE 'Orphaned rows (not migrated): %', v_orphaned_count;
  RAISE NOTICE '================================================';

  -- Alert if there are orphaned rows
  IF v_orphaned_count > 0 THEN
    RAISE WARNING 'ALERT: % rows in memory_notes_old were NOT successfully migrated!', v_orphaned_count;
    RAISE WARNING 'The backup table memory_notes_old has been preserved.';
    RAISE WARNING 'Please manually review these orphaned rows before cleanup.';
  END IF;

  -- Confirm if migration succeeded
  IF v_old_count > 0 AND v_migration_count = v_old_count THEN
    RAISE NOTICE 'MIGRATION INTEGRITY: PASSED - All % rows successfully migrated', v_old_count;
  ELSIF v_old_count = 0 THEN
    RAISE NOTICE 'MIGRATION INTEGRITY: PASSED - No rows to migrate (fresh installation)';
  END IF;
END $$;

-- ============================================================================
-- STEP 4: Create audit view for post-migration review
-- ============================================================================

-- Create a view showing migration metadata for audit trail
CREATE OR REPLACE VIEW migration_audit_trail AS
SELECT
  'memory_notes_old' as source_table,
  (SELECT COUNT(*) FROM memory_notes_old)::INTEGER as total_rows,
  (SELECT MIN(created_at) FROM memory_notes_old) as oldest_record,
  (SELECT MAX(created_at) FROM memory_notes_old) as newest_record,
  NOW() as audit_timestamp;
