-- SQLite Local Memory Cache Schema
-- Provides fast BM25 search and hot memory caching

-- Hot memory cache (most accessed memories)
CREATE TABLE IF NOT EXISTS memory_cache (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  content TEXT NOT NULL,
  summary TEXT,
  embedding BLOB, -- Stored as binary for SQLite
  importance_score REAL DEFAULT 0.5,
  access_count INTEGER DEFAULT 0,
  last_accessed INTEGER, -- Unix timestamp
  memory_type TEXT,
  category TEXT,
  symbols TEXT, -- JSON array as text
  created_at INTEGER,
  synced_at INTEGER,
  protection_level INTEGER DEFAULT 2 -- 0=immutable, 1=protected, 2=standard, 3=ephemeral
);

CREATE INDEX IF NOT EXISTS idx_cache_workspace ON memory_cache(workspace_id);
CREATE INDEX IF NOT EXISTS idx_cache_importance ON memory_cache(importance_score DESC);
CREATE INDEX IF NOT EXISTS idx_cache_accessed ON memory_cache(last_accessed DESC);
CREATE INDEX IF NOT EXISTS idx_cache_type ON memory_cache(memory_type);
CREATE INDEX IF NOT EXISTS idx_cache_workspace_importance ON memory_cache(workspace_id, importance_score DESC);

-- Full-text search virtual table (BM25)
CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(
  id UNINDEXED,
  content,
  summary,
  category,
  tokenize='porter'
);

-- Session state for daemon tracking
CREATE TABLE IF NOT EXISTS extraction_state (
  session_id TEXT PRIMARY KEY,
  workspace_id TEXT,
  last_message_id TEXT,
  last_extraction INTEGER, -- Unix timestamp
  messages_processed INTEGER DEFAULT 0,
  memories_extracted INTEGER DEFAULT 0
);

-- Query cache for frequently accessed queries
CREATE TABLE IF NOT EXISTS query_cache (
  query_hash TEXT PRIMARY KEY,
  query_text TEXT,
  workspace_id TEXT,
  result_ids TEXT, -- JSON array
  created_at INTEGER,
  hit_count INTEGER DEFAULT 0,
  avg_response_time_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_query_cache_workspace ON query_cache(workspace_id);
CREATE INDEX IF NOT EXISTS idx_query_cache_hits ON query_cache(hit_count DESC);
