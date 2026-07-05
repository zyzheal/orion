-- Rollback Migration 011_create_tickets_healing
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: tickets
DROP TABLE IF EXISTS tickets CASCADE;

-- Dropping table: ticket_comments
DROP TABLE IF EXISTS ticket_comments CASCADE;

-- Dropping table: self_healing_rules
DROP TABLE IF EXISTS self_healing_rules CASCADE;

-- Dropping table: self_healing_executions
DROP TABLE IF EXISTS self_healing_executions CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_ticket;
DROP INDEX IF EXISTS CREATE INDEX idx_ticket;
DROP INDEX IF EXISTS CREATE INDEX idx_ticket;
DROP INDEX IF EXISTS CREATE INDEX idx_ticket;
DROP INDEX IF EXISTS CREATE INDEX idx_ticket_comment;
DROP INDEX IF EXISTS CREATE INDEX idx_healing_rule;
DROP INDEX IF EXISTS CREATE INDEX idx_healing_execution;
