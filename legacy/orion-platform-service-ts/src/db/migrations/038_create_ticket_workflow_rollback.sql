-- Rollback Migration 038_create_ticket_workflow
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: ticket_workflow_history
DROP TABLE IF EXISTS ticket_workflow_history CASCADE;

-- Dropping table: ticket_sla
DROP TABLE IF EXISTS ticket_sla CASCADE;

-- Dropping table: dispatch_queue
DROP TABLE IF EXISTS dispatch_queue CASCADE;

-- Dropping table: engineer_load
DROP TABLE IF EXISTS engineer_load CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_ticket_workflow_ticket ON ticket_workflow_hi;
DROP INDEX IF EXISTS CREATE INDEX idx_ticket_workflow_created ON ticket_workflow_hi;
DROP INDEX IF EXISTS CREATE INDEX idx_ticket_;
DROP INDEX IF EXISTS CREATE INDEX idx_di;
DROP INDEX IF EXISTS CREATE INDEX idx_engineer_load_availability ON engineer_load(availability);;
