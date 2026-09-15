-- Reversal of 685_create_job_source_missing_tables.sql.
--
-- 事件表先删: 它外键引用 job_sources(id), 反序删除会让 CASCADE 之外的
-- 约束先失败。

DROP TABLE IF EXISTS job_source_events;

DROP TABLE IF EXISTS job_sources;
