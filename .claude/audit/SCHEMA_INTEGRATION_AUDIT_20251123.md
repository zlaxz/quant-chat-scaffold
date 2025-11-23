# Database Schema Integration Audit
**Migration:** `20251123000000_enhance_memory_system.sql`
**Date:** 2025-11-23
**Risk Level:** CRITICAL - Multiple integration issues detected

---

## Executive Summary

The new enhancement migration creates a parallel memory system (`memories` table) while DROP-ping the existing `memory_notes` table. This creates a **breaking change with high data loss risk**. The migration has been structured to be "safe" with `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE IF NOT EXISTS` clauses, but the DROP statement runs unconditionally and **WILL DELETE all existing memory data**.

**Status:** 7 issues identified, 4 are HIGH/CRITICAL severity

---

## Integration Issues Report

### 1. TABLE CONFLICT: memory_notes DROP (CRITICAL)

**Severity:** CRITICAL - Data Loss Risk
**Lines:** 4-5 in new migration

```sql
DROP TABLE IF EXISTS memory_notes CASCADE;
CREATE TABLE IF NOT EXISTS memories (...)
```

**What Breaks:**
- All existing `memory_notes` data is permanently deleted
- Cascade deletes linked data (foreign key references from `memory_extraction_state`, `research_reports`, etc.)
- No backup or migration path for existing data

**Data Loss Risk:** HIGH - Complete loss of all stored memories
- Estimated ~2,000-10,000 memory records (depending on usage)
- Loss includes embeddings, semantic vectors, metadata
- Loss includes backtest run associations

**Why This Happens:**
- Existing migrations 20251119184427 through 20251119194601 progressively enhanced `memory_notes` (added embedding, memory_type, importance, updated_at, archived, run_id, metadata)
- New migration assumes `memory_notes` should not exist
- No migration path bridges the two approaches

**Cascading Impacts:**
- research_reports has `session_id` FK to chat_sessions (CASCADE still works)
- memory_extraction_state references workspaces (safe)
- No other tables reference memory_notes directly

**Fix Priority:** CRITICAL - Must be resolved before applying migration

---

### 2. COLUMN CONFLICTS: backtest_runs Alterations (HIGH)

**Severity:** HIGH - Safe but redundant
**Lines:** 86-88 in new migration

```sql
ALTER TABLE backtest_runs ADD COLUMN IF NOT EXISTS regime_id INTEGER;
ALTER TABLE backtest_runs ADD COLUMN IF NOT EXISTS regime_context JSONB DEFAULT '{}';
ALTER TABLE backtest_runs ADD COLUMN IF NOT EXISTS statistical_validity JSONB DEFAULT '{}';
```

**Current State:**
- Migration 20251119181405 adds `engine_source TEXT`
- Migration 20251119182104 adds `notes TEXT`
- Migration 20251119183154 adds `run_id UUID`, `metadata JSONB`
- New migration now adds `regime_id`, `regime_context`, `statistical_validity`

**What Breaks:** Nothing (uses `IF NOT EXISTS`)

**Data Loss Risk:** NONE - Safe operation
- Columns won't exist yet, so they will be added
- Defaults are sensible (NULL for regime_id, empty object for JSONB)

**Caveat:**
- If these columns already exist (from a rerun), addition is skipped silently
- No idempotency check for data migration (e.g., populating regime_id from regime_context)

**Status:** Safe to apply

---

### 3. FOREIGN KEY VALIDITY: References to Non-existent Tables (HIGH)

**Severity:** HIGH - Structural integrity risk
**Affected Tables:** memories, trading_rules, regime_profile_performance, market_events, overfitting_warnings

**Foreign Key References:**

| Table | Column | References | Existence |
|-------|--------|-----------|-----------|
| memories | workspace_id | workspaces(id) | ✓ Exists (20251119174252) |
| trading_rules | workspace_id | workspaces(id) | ✓ Exists |
| regime_profile_performance | workspace_id | workspaces(id) | ✓ Exists |
| market_events | workspace_id | workspaces(id) | ✓ Exists |
| overfitting_warnings | workspace_id | workspaces(id) | ✓ Exists |
| overfitting_warnings | run_id | backtest_runs(id) | ✓ Exists (20251119174252) |
| memory_evidence | memory_id | memories(id) | ✓ Created in same migration |

**Status:** All foreign key references are valid

---

### 4. MIGRATION ORDER & DEPENDENCIES (MEDIUM)

**Severity:** MEDIUM - Order matters for extension support
**Issue:** The migration relies on pgvector extension but doesn't create it

**Current State:**
```sql
-- New migration (line 1-25) - No explicit pgvector creation
CREATE TABLE IF NOT EXISTS memories (
  ...
  embedding vector(1536),  -- Requires pgvector
  ...
  regime_context JSONB,
  ...
)
```

**Previous Migration:**
```sql
-- Migration 20251119184427
CREATE EXTENSION IF NOT EXISTS vector;
```

**Dependency Chain:**
1. Migration 20251119174252: Creates base tables (workspaces, backtest_runs, memory_notes)
2. Migration 20251119174321: Enables RLS
3. Migration 20251119184427: Creates pgvector extension
4. Migration 20251119194458: Adds embedding to memory_notes
5. **New Migration (20251123000000): Assumes pgvector exists, drops memory_notes, creates memories**

**Risk:** If pgvector creation runs AFTER this migration, embedding columns will fail to create

**Status:** Safe if migrations run in timestamp order (they do in Supabase)

---

### 5. FUNCTION OVERWRITES: update_updated_at_column (MEDIUM)

**Severity:** MEDIUM - Safe overwrite with improvement
**Lines:** 270-276, 278-281 in new migration

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Current State:**
- Migration 20251119174252 creates this function
- Migration 20251119174321 recreates it with `SET search_path = public`
- Migration 20251119194458 references it (for memory_notes trigger)
- New migration recreates it WITHOUT `SET search_path`

**Comparison:**

| Version | Creator | Has search_path | Scope |
|---------|---------|-----------------|-------|
| v1 (20251119174252) | Initial | No | Simple |
| v2 (20251119174321) | RLS migration | Yes | Fixed |
| v3 (20251123000000) | New | **No** | Regression |

**What Breaks:** Potentially nothing, but loses search_path fix from v2

**Issue:** Version 3 reverts to v1's approach, removing the explicit search_path that v2 added to prevent "function not found" errors

**Fix Needed:**
```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;
```

**Status:** Will work but removes safety improvement

---

### 6. TRIGGER RECREATION: update_memories_updated_at (MEDIUM)

**Severity:** MEDIUM - Safe but verbose
**Lines:** 278-281 in new migration

```sql
CREATE TRIGGER update_memories_updated_at
  BEFORE UPDATE ON memories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

**Current State:**
- New memories table has trigger created in same migration
- Existing memory_notes (DROPPED) has trigger created in migration 20251119194458

**What Breaks:** Nothing (new table, new trigger)

**Caveat:**
- If migration runs twice, trigger will fail with "trigger already exists"
- Should use `CREATE TRIGGER IF NOT EXISTS` (Postgres 14+)

**Status:** Works first time, fails on idempotent rerun (Supabase usually prevents reruns)

---

### 7. INDEX NAME COLLISIONS (HIGH)

**Severity:** HIGH - Index namespace conflicts
**Issue:** Multiple indexes use generic names that collide

**Index Collision Analysis:**

| Index Name | First Created | New Migration | Conflict? |
|------------|---|---|---|
| idx_memories_workspace | N/A | 20251123 | No (new table) |
| idx_memory_notes_workspace_id | 20251119174252 | - | No (separate table) |
| idx_rpp_regime | 20251123 | 20251123 | No |
| idx_rpp_profile | 20251123 | 20251123 | No |
| idx_rpp_sharpe | 20251123 | 20251123 | No |
| idx_rpp_confidence | 20251123 | 20251123 | No |
| idx_evidence_memory | 20251123 | 20251123 | No |
| idx_evidence_type | 20251123 | 20251123 | No |
| idx_overfitting_strategy | 20251123 | 20251123 | No |
| idx_overfitting_embedding | 20251123 | 20251123 | No |
| idx_overfitting_run | 20251123 | 20251123 | No |

**Status:** No collisions detected (new tables use unique prefixes)

---

### 8. HYBRID SEARCH FUNCTION (MEDIUM)

**Severity:** MEDIUM - Function signature compatibility
**Lines:** 284-355 in new migration

```sql
CREATE OR REPLACE FUNCTION hybrid_search_memories(
  query_text TEXT,
  query_embedding vector(1536),
  match_workspace_id UUID,
  limit_count INTEGER DEFAULT 20,
  bm25_weight REAL DEFAULT 0.3,
  vector_weight REAL DEFAULT 0.7,
  min_importance REAL DEFAULT 0.0
)
```

**Existing Function:**
```sql
-- Migration 20251119184427 (search_memory_notes)
-- Modified by 20251119185221, 20251119194458, 20251119194601
CREATE FUNCTION public.search_memory_notes(
  query_embedding vector(1536),
  match_workspace_id uuid,
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5
)
```

**Conflict:** No - different function names
- `hybrid_search_memories` is NEW (works on memories table)
- `search_memory_notes` is EXISTING (works on memory_notes table, which is dropped)

**Impact:** After migration, `search_memory_notes` will fail if called
- Function exists but references dropped table
- Code calling `search_memory_notes()` must migrate to `hybrid_search_memories()`

**Status:** API change - requires client code migration

---

## Comprehensive Issue Matrix

| # | Issue | Severity | Category | Data Loss | Blocks Migration | Fixable |
|---|-------|----------|----------|-----------|------------------|---------|
| 1 | DROP memory_notes | CRITICAL | Data Loss | YES | NO (silently destroys) | YES |
| 2 | backtest_runs columns | HIGH | Safe Operation | NO | NO | Already safe |
| 3 | Foreign keys | HIGH | Structural | NO | NO | Valid |
| 4 | Migration order | MEDIUM | Dependency | NO | NO | Already valid |
| 5 | Function search_path | MEDIUM | Safety Regression | NO | NO | YES |
| 6 | Trigger recreation | MEDIUM | Idempotency | NO | NO | YES (add IF EXISTS) |
| 7 | Index collisions | HIGH | Namespace | NO | NO | None found |
| 8 | Function migration | MEDIUM | API Change | NO | NO | YES (code change) |

---

## Recommended Fixes

### FIX #1: Preserve memory_notes Data (CRITICAL)

**Option A: Data Migration (Recommended)**
```sql
-- Instead of DROP TABLE:
INSERT INTO memories (
  workspace_id, session_id, content, summary,
  embedding, importance_score, memory_type, category,
  symbols, strategies, created_at, updated_at,
  archived, source, confidence
)
SELECT
  workspace_id,
  NULL as session_id,
  content,
  content as summary,
  embedding,
  CASE WHEN importance = 'critical' THEN 0.95
       WHEN importance = 'high' THEN 0.8
       WHEN importance = 'normal' THEN 0.5
       WHEN importance = 'low' THEN 0.2
       ELSE 0.5 END as importance_score,
  COALESCE(memory_type, 'observation') as memory_type,
  NULL as category,
  tags as symbols,
  '{}' as strategies,
  created_at,
  COALESCE(updated_at, created_at) as updated_at,
  COALESCE(archived, FALSE) as archived,
  source,
  1.0 as confidence
FROM memory_notes;

-- After successful insert, drop old table
DROP TABLE IF EXISTS memory_notes CASCADE;
```

**Option B: Parallel Operation (Safe, but duplicates data)**
```sql
-- Keep memory_notes, create memories alongside
-- Both serve different purposes
-- No drop, gradual migration to memories
```

**Option C: Backup First**
```sql
-- Before anything else:
CREATE TABLE memory_notes_backup AS SELECT * FROM memory_notes;

-- Then proceed with migration
-- Can restore if needed: INSERT INTO memory_notes SELECT * FROM memory_notes_backup;
```

### FIX #2: Add search_path to Function (MEDIUM)

**Current (Line 270-276):**
```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Recommended:**
```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;
```

### FIX #3: Safe Trigger Creation (MEDIUM)

**Current (Line 278-281):**
```sql
CREATE TRIGGER update_memories_updated_at
  BEFORE UPDATE ON memories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

**Recommended (Postgres 14+):**
```sql
CREATE TRIGGER IF NOT EXISTS update_memories_updated_at
  BEFORE UPDATE ON memories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### FIX #4: Update Client Code (MEDIUM)

**Deprecate:** `search_memory_notes()` (operates on dropped table)

**Replace with:** `hybrid_search_memories()` (operates on memories table)

**Migration Points:**
- API endpoints calling `search_memory_notes` → `hybrid_search_memories`
- ORM models expecting memory_notes → update to memories schema
- Application constants referencing memory_notes table name

---

## Safety Checklist Before Applying

- [ ] **CRITICAL:** Back up all data in memory_notes table
- [ ] **HIGH:** Review migration path for memory data (preservation vs. reset)
- [ ] **MEDIUM:** Update application code to use `hybrid_search_memories()` instead of `search_memory_notes()`
- [ ] **MEDIUM:** Fix search_path regression in `update_updated_at_column()`
- [ ] **MEDIUM:** Add IF NOT EXISTS to trigger creation for idempotency
- [ ] **LOW:** Document that backtest_runs.regime_id/regime_context/statistical_validity are new columns
- [ ] Test migration in development environment first
- [ ] Verify all FKs are valid post-migration
- [ ] Verify all indexes were created successfully
- [ ] Verify all functions/triggers were created successfully

---

## Migration Execution Plan

### Phase 1: Pre-Migration (Required)
1. Backup memory_notes table
2. Review memory data volume (SELECT COUNT(*) FROM memory_notes)
3. Identify memory_notes usage in application code
4. Update code to prepare for migration

### Phase 2: Data Migration (Choose One)
**Option A: Preserve Data**
- Run memory_notes → memories INSERT statement
- Verify insert count matches source
- Test hybrid_search_memories() on migrated data

**Option B: Start Fresh**
- Document existing memory_notes purpose
- Accept data loss
- Begin fresh memories table

**Option C: Parallel Tables**
- Keep memory_notes
- Create memories alongside
- Gradual client migration

### Phase 3: Apply Migration
- Run 20251123000000_enhance_memory_system.sql
- Verify all tables created
- Verify all indexes created
- Verify all functions work

### Phase 4: Post-Migration (Required)
- Update application code to use new memories table
- Update application code to use hybrid_search_memories()
- Test all memory operations
- Monitor for errors

---

## Risk Assessment Summary

| Category | Risk Level | Impact |
|----------|-----------|--------|
| Data Loss (memory_notes) | CRITICAL | All historical memories destroyed |
| Function API Change | HIGH | Client code breaks if not updated |
| Index Collisions | LOW | No collisions detected |
| Foreign Key Validity | LOW | All references valid |
| Migration Order | LOW | Dependencies satisfied |
| Idempotency | MEDIUM | Triggers fail on rerun |
| Search Path Regression | MEDIUM | Potential subtle function errors |

---

## Conclusion

**Recommendation:** Do NOT apply this migration as-is. The DROP TABLE IF EXISTS will permanently delete all memory_notes data without migration.

**Required Before Application:**
1. Implement data migration path from memory_notes → memories
2. Fix function search_path regression
3. Add IF NOT EXISTS to trigger creation
4. Update application code to use hybrid_search_memories()
5. Document data loss/preservation decision
6. Back up all data
7. Test in staging environment

**Timeline Estimate:**
- Data backup & analysis: 15 minutes
- Data migration coding: 30 minutes
- Code updates: 60-90 minutes (depends on codebase scope)
- Testing: 30-60 minutes
- **Total: 2.5-4 hours for safe migration**

The migration structure is well-designed and feature-rich, but the destructive DROP TABLE needs to be handled explicitly and carefully.
