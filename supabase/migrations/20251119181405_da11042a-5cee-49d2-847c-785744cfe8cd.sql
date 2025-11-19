-- Add engine_source column to track backtest execution source
ALTER TABLE public.backtest_runs 
ADD COLUMN IF NOT EXISTS engine_source TEXT DEFAULT 'stub';

COMMENT ON COLUMN public.backtest_runs.engine_source IS 
'Tracks backtest execution source: stub, external, or stub_fallback';