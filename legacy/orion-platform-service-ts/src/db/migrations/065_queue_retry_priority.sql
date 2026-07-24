ALTER TABLE queue_jobs ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0;
ALTER TABLE queue_jobs ADD COLUMN IF NOT EXISTS max_attempts INTEGER DEFAULT 3;
ALTER TABLE queue_jobs ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE queue_jobs ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE queue_jobs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_queue_jobs_priority ON queue_jobs(priority DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_queue_jobs_retry ON queue_jobs(status, next_retry_at);
