-- Migration: Fix table references in memory RPCs
-- Issue: hybrid_search_memories references 'memories' instead of 'memory_notes'
-- Date: 2025-11-25

-- Ensure pgvector extension is available and search path includes it
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Set search path to include extensions schema for vector type
SET search_path TO public, extensions;

-- Drop and recreate hybrid_search_memories with correct table reference
CREATE OR REPLACE FUNCTION hybrid_search_memories(
  query_text TEXT,
  query_embedding extensions.vector(1536),
  match_workspace_id UUID,
  limit_count INTEGER DEFAULT 20,
  bm25_weight REAL DEFAULT 0.3,
  vector_weight REAL DEFAULT 0.7,
  min_importance REAL DEFAULT 0.0
)
RETURNS TABLE(
  id UUID,
  content TEXT,
  summary TEXT,
  memory_type TEXT,
  category TEXT,
  symbols TEXT[],
  importance_score REAL,
  bm25_score REAL,
  vector_score REAL,
  hybrid_score REAL,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  WITH bm25_scores AS (
    SELECT
      m.id,
      ts_rank_cd(m.content_tsvector, plainto_tsquery('english', query_text)) as score
    FROM memory_notes m
    WHERE m.workspace_id = match_workspace_id
      AND m.content_tsvector @@ plainto_tsquery('english', query_text)
      AND m.importance_score >= min_importance
      AND (m.archived IS NULL OR m.archived = FALSE)
  ),
  vector_scores AS (
    SELECT
      m.id,
      1 - (m.embedding <=> query_embedding) as score
    FROM memory_notes m
    WHERE m.workspace_id = match_workspace_id
      AND m.embedding IS NOT NULL
      AND m.importance_score >= min_importance
      AND (m.archived IS NULL OR m.archived = FALSE)
    ORDER BY m.embedding <=> query_embedding
    LIMIT limit_count * 2
  ),
  combined AS (
    SELECT
      COALESCE(b.id, v.id) as memory_id,
      COALESCE(b.score, 0) * bm25_weight as weighted_bm25,
      COALESCE(v.score, 0) * vector_weight as weighted_vector
    FROM bm25_scores b
    FULL OUTER JOIN vector_scores v ON b.id = v.id
  )
  SELECT
    m.id,
    m.content,
    m.summary,
    m.memory_type,
    m.category,
    m.symbols,
    m.importance_score,
    c.weighted_bm25 / NULLIF(bm25_weight, 0) as bm25_score,
    c.weighted_vector / NULLIF(vector_weight, 0) as vector_score,
    (c.weighted_bm25 + c.weighted_vector) * m.importance_score as hybrid_score,
    m.created_at
  FROM combined c
  JOIN memory_notes m ON m.id = c.memory_id
  ORDER BY hybrid_score DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Also create a simpler promote_strategy function that doesn't require headline/narrative
-- (the original requires these but Dashboard.tsx doesn't provide them)
CREATE OR REPLACE FUNCTION promote_strategy_simple(
    p_strategy_id UUID
)
RETURNS UUID AS $$
DECLARE
    v_briefing_id UUID;
    v_metrics JSONB;
    v_strategy_name TEXT;
BEGIN
    -- Get strategy metrics and name for auto-generated briefing
    SELECT
        jsonb_build_object(
            'sharpe', sharpe_ratio,
            'sortino', sortino_ratio,
            'max_drawdown', max_drawdown,
            'win_rate', win_rate,
            'profit_factor', profit_factor,
            'fitness', fitness_score
        ),
        COALESCE(name, 'Strategy ' || LEFT(p_strategy_id::TEXT, 8))
    INTO v_metrics, v_strategy_name
    FROM strategy_genome
    WHERE id = p_strategy_id;

    -- Update strategy status
    UPDATE strategy_genome
    SET
        status = 'active',
        promoted_at = NOW()
    WHERE id = p_strategy_id;

    -- Create morning briefing with auto-generated content
    INSERT INTO morning_briefings (
        strategy_id,
        headline,
        narrative,
        key_metrics,
        priority_score
    ) VALUES (
        p_strategy_id,
        v_strategy_name || ' promoted to active',
        'Strategy promoted based on performance metrics. Review key metrics below.',
        v_metrics,
        COALESCE((v_metrics->>'fitness')::FLOAT, 0)
    )
    RETURNING id INTO v_briefing_id;

    RETURN v_briefing_id;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION hybrid_search_memories TO authenticated;
GRANT EXECUTE ON FUNCTION promote_strategy_simple TO authenticated;
