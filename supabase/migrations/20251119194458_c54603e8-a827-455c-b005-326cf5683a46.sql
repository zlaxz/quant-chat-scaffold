-- Add updated_at and archived columns to memory_notes if they don't exist
DO $$ 
BEGIN
  -- Add updated_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'memory_notes' 
    AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE memory_notes 
    ADD COLUMN updated_at timestamp with time zone DEFAULT now();
  END IF;

  -- Add archived column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'memory_notes' 
    AND column_name = 'archived'
  ) THEN
    ALTER TABLE memory_notes 
    ADD COLUMN archived boolean DEFAULT false;
  END IF;
END $$;

-- Create trigger to auto-update updated_at on memory_notes if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_memory_notes_updated_at'
  ) THEN
    CREATE TRIGGER update_memory_notes_updated_at
    BEFORE UPDATE ON memory_notes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Create index on archived column for faster filtering
CREATE INDEX IF NOT EXISTS idx_memory_notes_archived ON memory_notes(archived);