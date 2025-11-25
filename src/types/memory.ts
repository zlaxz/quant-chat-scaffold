/**
 * Memory System Types
 *
 * Consolidated interface for memory_notes table records.
 * Used across all memory-related functionality.
 */

/**
 * Core MemoryNote interface matching Supabase memory_notes table
 *
 * Optional fields use `| null` for database nullability.
 * Use this type for all memory operations.
 */
export interface MemoryNote {
  id: string;
  workspace_id?: string;
  content: string;
  summary?: string | null;
  memory_type: string | null;
  category?: string | null;
  importance?: string | null;
  importance_score?: number | null;
  tags?: string[] | null;
  symbols?: string[] | null;
  strategies?: string[] | null;
  source: string;
  run_id?: string | null;
  session_id?: string | null;
  created_at: string | null;
  updated_at?: string | null;
  metadata?: Record<string, unknown> | null;
  archived?: boolean | null;
  protection_level?: number | null;
  financial_impact?: number | null;
  last_recalled_at?: string | null;
  recall_count?: number | null;
  confidence?: number | null;
  embedding?: number[] | null;
  regime_context?: {
    primary_regime?: number | null;
    convexity_profile?: number | null;
  } | null;
  entities?: Array<{
    type: string;
    name: string;
    value?: unknown;
  }> | null;
}

/**
 * Simplified MemoryNote for UI display (subset of fields)
 */
export interface MemoryNoteSummary {
  id: string;
  content: string;
  summary?: string | null;
  memory_type: string | null;
  importance?: string | null;
  tags?: string[] | null;
  source: string;
  created_at: string | null;
  archived?: boolean | null;
}

/**
 * Memory search result with scoring
 */
export interface MemorySearchResult extends MemoryNote {
  bm25_score?: number;
  vector_score?: number;
  hybrid_score?: number;
  similarity?: number;
}

/**
 * Memory creation payload
 */
export interface CreateMemoryPayload {
  workspace_id: string;
  content: string;
  summary?: string;
  memory_type?: string;
  category?: string;
  importance_score?: number;
  tags?: string[];
  source: string;
  run_id?: string | null;
  session_id?: string | null;
  metadata?: Record<string, unknown>;
  protection_level?: number;
  confidence?: number;
}

/**
 * Memory type categories
 */
export type MemoryType =
  | 'observation'
  | 'lesson'
  | 'rule'
  | 'strategy'
  | 'mistake'
  | 'success'
  | 'warning'
  | 'insight';

/**
 * Memory category classifications
 */
export type MemoryCategory =
  | 'backtest_result'
  | 'overfitting_warning'
  | 'regime_insight'
  | 'parameter_sensitivity'
  | 'statistical_pattern'
  | 'execution_gotcha'
  | 'risk_management'
  | 'general';

/**
 * Protection levels (higher = more protection)
 */
export enum ProtectionLevel {
  IMMUTABLE = 0,    // Cannot be modified or archived
  PROTECTED = 1,    // Requires confirmation to modify
  STANDARD = 2,     // Normal memories
  EPHEMERAL = 3,    // Can be auto-archived
}
