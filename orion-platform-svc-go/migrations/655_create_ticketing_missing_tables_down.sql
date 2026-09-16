-- Reverse 655_create_ticketing_missing_tables.sql.
DROP TABLE IF EXISTS ticket_transfer_history;
DROP TABLE IF EXISTS ticketing_suspensions;
DROP TABLE IF EXISTS ticketing_sla_targets;
DROP TABLE IF EXISTS ticketing_sla_policies;
DROP TABLE IF EXISTS ticketing_sla_breaches;
DROP TABLE IF EXISTS ticketing_service_state;
DROP TABLE IF EXISTS ticketing_dispatch_weights;
DROP TABLE IF EXISTS ticketing_dispatch_rules;
DROP TABLE IF EXISTS ticketing_dispatch_engineers;
DROP TABLE IF EXISTS ticketing_automation_rules;
DROP TABLE IF EXISTS ticketing_assignment_rules;
