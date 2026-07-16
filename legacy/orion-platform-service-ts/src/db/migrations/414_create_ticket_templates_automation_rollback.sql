-- Rollback Migration 414_create_ticket_templates_automation

-- Dropping table: automation_rule_executions
DROP TABLE IF EXISTS automation_rule_executions CASCADE;

-- Dropping table: automation_rules
DROP TABLE IF EXISTS automation_rules CASCADE;

-- Dropping table: ticket_templates
DROP TABLE IF EXISTS ticket_templates CASCADE;
