-- Reverse 587_widen_tracing_text_columns.sql.
--
-- Truncating with LEFT is the only reversible choice: a plain TYPE cast of a
-- TEXT column back to VARCHAR(255) is rejected by Postgres because it cannot
-- guarantee the length, and truncation matches what the forward migration would
-- have done to the data.

ALTER TABLE trace_spans ALTER COLUMN tags TYPE VARCHAR(255) USING LEFT(tags, 255);

ALTER TABLE otel_collector_configs ALTER COLUMN config_yaml TYPE VARCHAR(255) USING LEFT(config_yaml, 255);
