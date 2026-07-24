-- Add description column to secrets table for better secret management
ALTER TABLE secrets ADD COLUMN IF NOT EXISTS description TEXT;
