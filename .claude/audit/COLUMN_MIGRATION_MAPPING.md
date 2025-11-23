# Column Migration Mapping: memory_notes → memories

## Purpose
This document provides a detailed column-by-column mapping for migrating data from the existing `memory_notes` table to the new `memories` table, as well as field additions to `backtest_runs`.

---

## Part 1: memory_notes → memories Migration

### Table Schema Comparison

#### Existing memory_notes (20251119174252 through 20251119194601)
```
Columns Added Over Time:
- 20251119174252: id, workspace_id, source, content, tags, created_at
- 20251119184427: embedding (vector)
- 20251119184913: memory_type, importance
- 20251119194458: updated_at, archived
- 20251119183154: run_id (FK), metadata
```

#### New memories (20251123000000)
```
Core fields: id, workspace_id, session_id, content, summary, created_at, updated_at
Search fields: content_tsvector (GENERATED), embedding, embedding_model
Importance: importance_score, access_count, last_accessed, decay_factor
Classification: memory_type, category, symbols, strategies
Trading context: outcome, market_conditions
Knowledge graph: entities, related_memories, contradicts, supersedes
Regime context: regime_context (JSONB)
Protection: protection_level, immutable, financial_impact, last_recalled_at
Metadata: source, confidence, archived
```

### Column Mapping Table

| memory_notes Column | memories Column | Data Type | Mapping Logic | Example |
|---|---|---|---|---|
| id | id | UUID | Direct copy | `12345678-1234...` |
| workspace_id | workspace_id | UUID | Direct copy | `87654321-4321...` |
| — | session_id | TEXT | NULL (not tracked in old) | NULL |
| content | content | TEXT | Direct copy | "RSI > 70 triggers sell..." |
| — | summary | TEXT | Copy from content (truncate to 500 chars) | "RSI > 70 triggers sell..." |
| — | content_tsvector | tsvector | GENERATED from content | (auto) |
| embedding | embedding | vector(1536) | Direct copy | `[0.123, 0.456, ...]` |
| — | embedding_model | TEXT | Set to 'text-embedding-3-small' | 'text-embedding-3-small' |
| importance | importance_score | REAL | Map text to 0.0-1.0 scale | 'critical' → 0.95 |
| — | access_count | INTEGER | Set to 0 (new tracking) | 0 |
| — | last_accessed | TIMESTAMPTZ | Set to created_at (default) | created_at value |
| — | decay_factor | REAL | Set to 1.0 (no decay yet) | 1.0 |
| memory_type | memory_type | TEXT | Direct copy with defaults | 'insight', 'rule', ... |
| — | category | TEXT | NULL (not in old schema) | NULL |
| tags | symbols | TEXT[] | Direct copy (repurpose tags) | ['SPY', 'OPTIONS'] |
| — | strategies | TEXT[] | Empty array (new field) | '{}' |
| — | outcome | JSONB | NULL (not tracked) | NULL |
| — | market_conditions | JSONB | NULL (not tracked) | NULL |
| — | entities | JSONB | NULL (not tracked) | NULL |
| — | related_memories | UUID[] | NULL (new relationship) | NULL |
| — | contradicts | UUID[] | NULL (new relationship) | NULL |
| — | supersedes | UUID[] | NULL (new relationship) | NULL |
| — | regime_context | JSONB | Empty object (to be populated) | '{}' |
| — | protection_level | INTEGER | Set to 2 (standard) | 2 |
| — | immutable | BOOLEAN | FALSE (not enforced yet) | FALSE |
| — | financial_impact | NUMERIC | NULL (not tracked) | NULL |
| — | last_recalled_at | TIMESTAMPTZ | NULL (new tracking) | NULL |
| created_at | created_at | TIMESTAMPTZ | Direct copy | '2025-11-23T10:00:00Z' |
| updated_at | updated_at | TIMESTAMPTZ | Direct copy | '2025-11-23T10:30:00Z' |
| source | source | TEXT | Direct copy | 'manual' or 'auto' |
| — | confidence | REAL | Set to 1.0 (full confidence) | 1.0 |
| archived | archived | BOOLEAN | Direct copy | FALSE |
| metadata | — | JSONB | DROPPED (consolidate into outcome/market_conditions/entities) | — |
| run_id | — | UUID FK | DROPPED (new structure separates memories from backtests) | — |

### SQL Migration Statement

**Option A: Full Preservation (Recommended)**
```sql
INSERT INTO memories (
  id, workspace_id, session_id, content, summary,
  content_tsvector,  -- GENERATED, skip in INSERT
  embedding, embedding_model,
  importance_score, access_count, last_accessed, decay_factor,
  memory_type, category,
  symbols, strategies,
  outcome, market_conditions,
  entities, related_memories, contradicts, supersedes,
  regime_context,
  protection_level, immutable, financial_impact, last_recalled_at,
  created_at, updated_at,
  source, confidence, archived
)
SELECT
  -- IDs and workspace
  mn.id,
  mn.workspace_id,
  NULL as session_id,

  -- Content
  mn.content,
  LEFT(mn.content, 500) as summary,  -- Truncate for summary

  -- SKIP content_tsvector (GENERATED)

  -- Embedding
  mn.embedding,
  'text-embedding-3-small' as embedding_model,

  -- Importance scaling
  CASE
    WHEN mn.importance = 'critical' THEN 0.95
    WHEN mn.importance = 'high' THEN 0.8
    WHEN mn.importance = 'normal' THEN 0.5
    WHEN mn.importance = 'low' THEN 0.2
    ELSE 0.5
  END as importance_score,
  0 as access_count,
  mn.created_at as last_accessed,  -- Use created_at as initial access
  1.0 as decay_factor,

  -- Classification
  COALESCE(mn.memory_type, 'observation') as memory_type,
  NULL as category,

  -- Trading context
  mn.tags as symbols,
  '{}' as strategies,

  -- Outcomes (reconstruct from metadata if possible)
  CASE WHEN mn.metadata ? 'outcome' THEN mn.metadata->'outcome' ELSE NULL END as outcome,
  CASE WHEN mn.metadata ? 'market_conditions' THEN mn.metadata->'market_conditions' ELSE NULL END as market_conditions,

  -- Knowledge graph
  CASE WHEN mn.metadata ? 'entities' THEN mn.metadata->'entities' ELSE NULL END as entities,
  NULL as related_memories,
  NULL as contradicts,
  NULL as supersedes,

  -- Regime context
  '{}' as regime_context,

  -- Protection
  2 as protection_level,
  FALSE as immutable,
  NULL as financial_impact,
  NULL as last_recalled_at,

  -- Timestamps
  mn.created_at,
  COALESCE(mn.updated_at, mn.created_at) as updated_at,

  -- Metadata
  COALESCE(mn.source, 'chat') as source,
  1.0 as confidence,
  COALESCE(mn.archived, FALSE) as archived

FROM memory_notes mn
WHERE 1=1;  -- Add WHERE clause if selective migration needed
```

**Validation After Insert:**
```sql
-- Verify row counts match
SELECT COUNT(*) as memory_notes_count FROM memory_notes;
SELECT COUNT(*) as memories_count FROM memories;

-- Verify workspace distribution
SELECT workspace_id, COUNT(*)
FROM memory_notes
GROUP BY workspace_id
ORDER BY COUNT(*) DESC;

SELECT workspace_id, COUNT(*)
FROM memories
GROUP BY workspace_id
ORDER BY COUNT(*) DESC;

-- Spot check random records
SELECT * FROM memories LIMIT 5;

-- Verify embeddings preserved
SELECT COUNT(*) as with_embedding FROM memories WHERE embedding IS NOT NULL;

-- Verify memory types
SELECT memory_type, COUNT(*) FROM memories GROUP BY memory_type;

-- Verify importance distribution
SELECT
  CASE
    WHEN importance_score >= 0.9 THEN 'critical'
    WHEN importance_score >= 0.7 THEN 'high'
    WHEN importance_score >= 0.4 THEN 'normal'
    ELSE 'low'
  END as importance_band,
  COUNT(*) as count
FROM memories
GROUP BY importance_band
ORDER BY importance_score DESC;
```

---

## Part 2: backtest_runs Column Additions

### New Columns (20251123000000)

| Column | Type | Default | Purpose | Existing Data |
|---|---|---|---|---|
| regime_id | INTEGER | NULL | Links run to market regime (1-6) | No existing data |
| regime_context | JSONB | '{}' | Full regime metadata snapshot | No existing data |
| statistical_validity | JSONB | '{}' | Validation metrics (pbo, deflated_sharpe) | No existing data |

### backtest_runs Current Schema (as of 20251120155733)

```
id UUID PRIMARY KEY
session_id UUID FK references chat_sessions
strategy_key TEXT NOT NULL
params JSONB
status TEXT DEFAULT 'pending'
started_at TIMESTAMPTZ DEFAULT NOW()
completed_at TIMESTAMPTZ
metrics JSONB
equity_curve JSONB
raw_results_url TEXT
error TEXT
engine_source TEXT DEFAULT 'stub' (from 20251119181405)
notes TEXT (from 20251119182104)
```

### No Migration Required for Existing Rows

The new columns are:
- **regime_id**: Optional (NULL by default) - can be populated later
- **regime_context**: Has default '{}' - won't break existing rows
- **statistical_validity**: Has default '{}' - won't break existing rows

**After migration, you can:**
```sql
-- Populate regime_id from external regime mapping
UPDATE backtest_runs SET regime_id = 3 WHERE created_at BETWEEN '2025-11-01' AND '2025-11-15';

-- Populate regime_context with analysis
UPDATE backtest_runs SET regime_context = jsonb_build_object(
  'primary_regime', regime_id,
  'regime_name', 'Trend Up',
  'temporal_context', jsonb_build_object(
    'date_range', '[2025-11-01, 2025-11-15]',
    'vix_regime', 'elevated',
    'vix_range', '[20, 35]'
  ),
  'statistical_validity', jsonb_build_object(
    'n_observations', 150,
    'confidence_level', 0.95,
    'pbo_score', 0.65,
    'deflated_sharpe', 1.2
  )
) WHERE regime_id IS NOT NULL;
```

---

## Part 3: Tables Dropped in Migration

### memory_notes

**Created By:** Migration 20251119174252
**Modified By:** 6 subsequent migrations
**Status After 20251123000000:** DROPPED CASCADE

**Backup Before Migration:**
```sql
-- Create backup table
CREATE TABLE memory_notes_backup AS SELECT * FROM memory_notes;

-- Verify backup
SELECT COUNT(*) FROM memory_notes_backup;

-- After migration, if needed:
-- Restore (if something goes wrong)
INSERT INTO memories (...) SELECT (...) FROM memory_notes_backup;

-- Or inspect historical data
SELECT * FROM memory_notes_backup WHERE created_at > NOW() - INTERVAL '30 days';
```

---

## Part 4: New Tables Created (No Migration Needed)

These are entirely new tables with no predecessors:

| Table | Purpose | Record Count | Notes |
|---|---|---|---|
| trading_rules | Consolidated rules from repeated lessons | 0 (empty) | Will be populated by application |
| memory_extraction_state | Daemon state tracking | 0 (empty) | Session tracking |
| regime_profile_performance | Aggregated strategy performance | 0 (empty) | Will be populated by analysis |
| memory_queries | Query performance tracking | 0 (empty) | Diagnostic data |
| market_events | Temporal event anchors | 0 (empty) | Manual or auto-populated |
| memory_evidence | Provenance chains | 0 (empty) | Links memories to evidence |
| overfitting_warnings | Critical failure modes | 0 (empty) | Populated by validation |

No data preservation needed for these tables.

---

## Part 5: Index Creation Checklist

### memory_notes Indexes (Will be Deleted)
```
idx_memory_notes_workspace_id (20251119174252)
idx_memory_notes_created_at (20251119174252)
idx_memory_notes_tags (20251119174252)
memory_notes_embedding_idx (20251119184427)
memory_notes_type_idx (20251119184913)
memory_notes_importance_idx (20251119184913)
memory_notes_workspace_type_importance_idx (20251119184913)
idx_memory_notes_archived (20251119194458)
idx_memory_notes_run_id (20251119183154)
idx_memory_notes_workspace_created (20251119183154)
```

### memories Indexes (New)
```
idx_memories_workspace (workspace_id)
idx_memories_session (session_id)
idx_memories_content_fts (content_tsvector USING GIN)
idx_memories_embedding (embedding USING ivfflat)
idx_memories_importance (importance_score DESC)
idx_memories_category (category)
idx_memories_created (created_at DESC)
idx_memories_symbols (symbols USING GIN)
idx_memories_strategies (strategies USING GIN)
idx_memories_type_importance (workspace_id, memory_type, importance_score DESC)
idx_memories_protection_level (protection_level)
idx_memories_regime (regime_context USING GIN)
idx_memories_last_recalled (last_recalled_at)
```

**Verify Indexes Created:**
```sql
SELECT schemaname, tablename, indexname
FROM pg_indexes
WHERE tablename IN ('memories', 'memory_notes_backup')
ORDER BY tablename, indexname;
```

---

## Part 6: Function Migration

### search_memory_notes() - Status AFTER migration

**Current Function (20251119194601):**
```
Operates on: memory_notes table
Will fail if called: "relation 'public.memory_notes' does not exist"
Status: BROKEN post-migration
```

**Replacement:**
```
Function: hybrid_search_memories()
Operates on: memories table
New parameters: query_text, bm25_weight, vector_weight
Old parameters: query_embedding, match_workspace_id (kept)
```

**Code Update Required:**
```javascript
// OLD (will break)
const results = await db.rpc('search_memory_notes', {
  query_embedding: embedding,
  match_workspace_id: workspaceId,
  match_threshold: 0.7,
  match_count: 5
});

// NEW (after migration)
const results = await db.rpc('hybrid_search_memories', {
  query_text: "RSI indicator trading rules",
  query_embedding: embedding,
  match_workspace_id: workspaceId,
  limit_count: 5,
  bm25_weight: 0.3,
  vector_weight: 0.7,
  min_importance: 0.0
});
```

---

## Part 7: Pre-Migration Safety Checklist

Before applying migration:

```
Data Preservation:
  [ ] Backup memory_notes table (CREATE TABLE ... AS SELECT)
  [ ] Count records in memory_notes
  [ ] Verify embeddings exist (SELECT COUNT(*) WHERE embedding IS NOT NULL)
  [ ] Verify metadata contains useful data (sample JSONB fields)
  [ ] Check for run_id references (any memories linked to backtests?)

Code Updates:
  [ ] Find all search_memory_notes() calls
  [ ] Find all memory_notes table references
  [ ] Find all memory_type/importance filters
  [ ] Update ORM models
  [ ] Update API endpoints

SQL Fixes:
  [ ] Add SET search_path = public to update_updated_at_column()
  [ ] Add IF NOT EXISTS to trigger creation
  [ ] Prepare data migration INSERT statement

Testing:
  [ ] Test INSERT statement on copy of memory_notes
  [ ] Verify counts match
  [ ] Test hybrid_search_memories() on migrated data
  [ ] Test regime_profile_performance inserts
  [ ] Test memory_evidence creation
  [ ] Test overfitting_warnings creation
```

---

## Part 8: Quick Reference SQL

**Migration Decision Tree:**

```
IF you want to preserve existing memories:
  → Run data migration INSERT statement
  → DROP memory_notes after verification

ELSE IF you want to start fresh:
  → CREATE TABLE memory_notes_backup AS SELECT * FROM memory_notes
  → DROP memory_notes (via migration)
  → Document why (e.g., "Schema incompatible, starting fresh")

ELSE IF you want gradual migration:
  → Don't drop memory_notes
  → Create memories alongside
  → Migrate application code to use memories
  → Archive memory_notes after 30 days
```

**Validate Migration Success:**

```sql
-- 1. Verify tables
\dt memories
\dt memory_notes  -- Should not exist
\dt trading_rules
\dt overfitting_warnings

-- 2. Verify data (if preserved)
SELECT COUNT(*) as memory_count FROM memories;
SELECT COUNT(*) FROM memories WHERE embedding IS NOT NULL;
SELECT memory_type, COUNT(*) FROM memories GROUP BY memory_type;

-- 3. Verify indexes
\di idx_memories_*

-- 4. Verify functions
\df hybrid_search_memories
\df find_similar_warnings
\df get_regime_performance

-- 5. Test hybrid search
SELECT * FROM hybrid_search_memories(
  query_text => 'RSI trading',
  query_embedding => '[0.1, 0.2, ...]'::vector(1536),
  match_workspace_id => '12345678-...',
  limit_count => 5
);
```

---

## Part 9: Importance Score Mapping Reference

If you need to adjust the importance scaling, use this reference:

| Old (memory_notes) | New (memories) | Scale | Meaning |
|---|---|---|---|
| 'critical' | 0.95 | Near-certain | Mission-critical rule, must follow |
| 'high' | 0.8 | Very likely | Important pattern, strong evidence |
| 'normal' | 0.5 | Moderate | Regular insight, worth remembering |
| 'low' | 0.2 | Possible | Minor observation, low confidence |
| (null/default) | 0.5 | Moderate | Treated as 'normal' |

Adjust the CASE statement in the migration if you prefer different mapping.

---

## Part 10: Rollback Plan

If migration fails:

```sql
-- 1. Drop new tables (if partially created)
DROP TABLE IF EXISTS memories CASCADE;
DROP TABLE IF EXISTS trading_rules CASCADE;
DROP TABLE IF EXISTS regime_profile_performance CASCADE;
DROP TABLE IF EXISTS memory_queries CASCADE;
DROP TABLE IF EXISTS market_events CASCADE;
DROP TABLE IF EXISTS memory_evidence CASCADE;
DROP TABLE IF EXISTS overfitting_warnings CASCADE;
DROP TABLE IF EXISTS memory_extraction_state CASCADE;

-- 2. Restore memory_notes (if you created backup)
CREATE TABLE memory_notes AS SELECT * FROM memory_notes_backup;

-- 3. Verify restored data
SELECT COUNT(*) FROM memory_notes;

-- 4. Run original search function
SELECT * FROM search_memory_notes(
  query_embedding => $1,
  match_workspace_id => $2
);

-- 5. Remove migration record (or Supabase handles this)
```

---

This mapping document should serve as a complete reference for the memory_notes → memories migration.
