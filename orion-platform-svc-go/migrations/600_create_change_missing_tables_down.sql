-- Reverse 600_create_change_missing_tables.sql.
-- Order: drop child tables first; then drop added columns on change_requests last.
DROP TABLE IF EXISTS cab_decisions;
DROP TABLE IF EXISTS cab_meetings;
DROP TABLE IF EXISTS change_rfcs;
DROP TABLE IF EXISTS change_timeline_events;

ALTER TABLE change_requests DROP COLUMN IF EXISTS approval_id;
ALTER TABLE change_requests DROP COLUMN IF EXISTS image_digest;
ALTER TABLE change_requests DROP COLUMN IF EXISTS target_env;
ALTER TABLE change_requests DROP COLUMN IF EXISTS branch;
ALTER TABLE change_requests DROP COLUMN IF EXISTS requester_id;
ALTER TABLE change_requests DROP COLUMN IF EXISTS assigned_to;
ALTER TABLE change_requests DROP COLUMN IF EXISTS priority;
ALTER TABLE change_requests DROP COLUMN IF EXISTS change_type;
