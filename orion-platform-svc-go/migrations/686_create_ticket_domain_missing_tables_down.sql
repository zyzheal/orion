-- 686_create_ticket_domain_missing_tables.sql 的逆操作。
-- sla_records 引用 sla_targets(id), 所以必须在前者已删除之后才删 sla_targets,
-- 否则 DROP TABLE sla_targets 会报 dependent objects still exist。

DROP TABLE IF EXISTS suspend_records;
DROP TABLE IF EXISTS dispatch_queue;
DROP TABLE IF EXISTS dispatch_rules;
DROP TABLE IF EXISTS dispatch_records;
DROP TABLE IF EXISTS dispatch_engineers;
DROP TABLE IF EXISTS ticket_comments;
DROP TABLE IF EXISTS sla_records;
DROP TABLE IF EXISTS sla_targets;
