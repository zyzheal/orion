-- Rollback Migration 061_create_ticketing_sub_services
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: ticket_assignments
DROP TABLE IF EXISTS ticket_assignments CASCADE;

-- Dropping table: ticket_relations
DROP TABLE IF EXISTS ticket_relations CASCADE;

-- Dropping table: dispatch_rules
DROP TABLE IF EXISTS dispatch_rules CASCADE;

-- Dropping table: ticket_transfers
DROP TABLE IF EXISTS ticket_transfers CASCADE;

-- Dropping table: engineer_suspensions
DROP TABLE IF EXISTS engineer_suspensions CASCADE;

-- Dropping table: dispatch_weights
DROP TABLE IF EXISTS dispatch_weights CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_ticket_a;
DROP INDEX IF EXISTS CREATE INDEX idx_ticket_a;
DROP INDEX IF EXISTS CREATE INDEX idx_ticket_relation;
DROP INDEX IF EXISTS CREATE INDEX idx_ticket_relation;
DROP INDEX IF EXISTS CREATE INDEX idx_ticket_relation;
DROP INDEX IF EXISTS CREATE INDEX idx_di;
DROP INDEX IF EXISTS CREATE INDEX idx_di;
DROP INDEX IF EXISTS CREATE INDEX idx_ticket_tran;
DROP INDEX IF EXISTS CREATE INDEX idx_ticket_tran;
DROP INDEX IF EXISTS CREATE INDEX idx_ticket_tran;
DROP INDEX IF EXISTS CREATE INDEX idx_ticket_tran;
DROP INDEX IF EXISTS CREATE INDEX idx_engineer_;
DROP INDEX IF EXISTS CREATE INDEX idx_engineer_;
DROP INDEX IF EXISTS CREATE INDEX idx_engineer_;
