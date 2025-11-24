-- Experiments Workflow Migration
-- Adds experiment tracking and checkpoint support for iterative backtesting

-- Experiments table - for grouping related backtest runs
CREATE TABLE IF NOT EXISTS experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,

  -- Experiment identification
  name TEXT NOT NULL,
  description TEXT,

  -- Status tracking
  status TEXT NOT NULL CHECK (status IN ('active', 'completed', 'archived')) DEFAULT 'active',

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  -- Prevent duplicate experiment names in same workspace
  UNIQUE(workspace_id, name)
);

-- Indexes for experiments
CREATE INDEX IF NOT EXISTS idx_experiments_workspace ON experiments(workspace_id);
CREATE INDEX IF NOT EXISTS idx_experiments_session ON experiments(session_id);
CREATE INDEX IF NOT EXISTS idx_experiments_status ON experiments(status);
CREATE INDEX IF NOT EXISTS idx_experiments_created ON experiments(created_at DESC);

-- Experiment checkpoints - save experiment state with notes
CREATE TABLE IF NOT EXISTS experiment_checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID REFERENCES experiments(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,

  -- Checkpoint content
  notes TEXT NOT NULL,
  run_count INTEGER DEFAULT 0,

  -- Snapshot of key metrics at checkpoint time
  snapshot_data JSONB DEFAULT '{}',
  -- Structure: {
  --   best_sharpe: 1.25,
  --   best_run_id: uuid,
  --   params_tested: [{lookback: 20}, {lookback: 25}],
  --   next_steps: "Try different thresholds"
  -- }

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for checkpoints
CREATE INDEX IF NOT EXISTS idx_checkpoints_experiment ON experiment_checkpoints(experiment_id);
CREATE INDEX IF NOT EXISTS idx_checkpoints_session ON experiment_checkpoints(session_id);
CREATE INDEX IF NOT EXISTS idx_checkpoints_created ON experiment_checkpoints(created_at DESC);

-- Add experiment tracking to backtest_runs
ALTER TABLE backtest_runs ADD COLUMN IF NOT EXISTS experiment_id UUID REFERENCES experiments(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_backtest_runs_experiment ON backtest_runs(experiment_id);

-- Auto-update trigger for experiments updated_at
CREATE TRIGGER update_experiments_updated_at
  BEFORE UPDATE ON experiments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security
ALTER TABLE experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiment_checkpoints ENABLE ROW LEVEL SECURITY;

-- RLS policies for experiments
CREATE POLICY experiments_read ON experiments
  FOR SELECT
  USING (true);

CREATE POLICY experiments_insert ON experiments
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY experiments_update ON experiments
  FOR UPDATE
  USING (true);

-- RLS policies for checkpoints
CREATE POLICY checkpoints_read ON experiment_checkpoints
  FOR SELECT
  USING (true);

CREATE POLICY checkpoints_insert ON experiment_checkpoints
  FOR INSERT
  WITH CHECK (true);

-- Helper function: Get experiment summary
CREATE OR REPLACE FUNCTION get_experiment_summary(
  match_workspace_id UUID,
  match_experiment_id UUID
)
RETURNS TABLE(
  experiment_name TEXT,
  total_runs BIGINT,
  best_sharpe NUMERIC,
  best_run_id UUID,
  checkpoint_count BIGINT,
  last_checkpoint_notes TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.name,
    COUNT(DISTINCT br.id) as total_runs,
    MAX((br.metrics->>'sharpe')::NUMERIC) as best_sharpe,
    (
      SELECT br2.id
      FROM backtest_runs br2
      WHERE br2.experiment_id = e.id AND br2.status = 'completed'
      ORDER BY (br2.metrics->>'sharpe')::NUMERIC DESC
      LIMIT 1
    ) as best_run_id,
    COUNT(DISTINCT ec.id) as checkpoint_count,
    (
      SELECT ec2.notes
      FROM experiment_checkpoints ec2
      WHERE ec2.experiment_id = e.id
      ORDER BY ec2.created_at DESC
      LIMIT 1
    ) as last_checkpoint_notes
  FROM experiments e
  LEFT JOIN backtest_runs br ON br.experiment_id = e.id
  LEFT JOIN experiment_checkpoints ec ON ec.experiment_id = e.id
  WHERE e.workspace_id = match_workspace_id
    AND e.id = match_experiment_id
  GROUP BY e.id, e.name;
END;
$$ LANGUAGE plpgsql;
