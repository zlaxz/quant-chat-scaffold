-- Update search_memory_notes function to filter archived notes
CREATE OR REPLACE FUNCTION public.search_memory_notes(
  query_embedding vector(1536),
  match_workspace_id uuid,
  match_threshold double precision DEFAULT 0.7,
  match_count integer DEFAULT 5
)
RETURNS TABLE(
  id uuid,
  workspace_id uuid,
  content text,
  source text,
  tags text[],
  created_at timestamp with time zone,
  run_id uuid,
  metadata jsonb,
  memory_type text,
  importance text,
  similarity double precision
)
LANGUAGE plpgsql
SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    memory_notes.id,
    memory_notes.workspace_id,
    memory_notes.content,
    memory_notes.source,
    memory_notes.tags,
    memory_notes.created_at,
    memory_notes.run_id,
    memory_notes.metadata,
    COALESCE(memory_notes.memory_type, 'insight') as memory_type,
    COALESCE(memory_notes.importance, 'normal') as importance,
    1 - (memory_notes.embedding <=> query_embedding) AS similarity
  FROM memory_notes
  WHERE memory_notes.workspace_id = match_workspace_id
    AND memory_notes.embedding IS NOT NULL
    AND memory_notes.archived = false  -- Only return active notes
    AND 1 - (memory_notes.embedding <=> query_embedding) > match_threshold
  ORDER BY memory_notes.embedding <=> query_embedding
  LIMIT match_count;
END;
$function$;