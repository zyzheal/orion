-- tracing module: two text payloads do not fit a VARCHAR(255).
--
-- 195_create_tracing_tables.sql declares
--   trace_spans.tags              VARCHAR(255) NOT NULL
--   otel_collector_configs.config_yaml VARCHAR(255) NOT NULL
-- Both columns hold structured payloads, not short labels:
--   - tags stores a JSON object of span attributes (encodeTags in
--     internal/tracing/repository/repository.go). A realistic set of a dozen
--     attributes already exceeds 255 characters.
--   - config_yaml stores an OpenTelemetry collector configuration, which is a
--     YAML document of hundreds of lines.
-- Any non-trivial write therefore failed with
--   pq: value too long for type character varying(255)
-- and the repository silently swallowed nothing -- the caller saw a 500.
--
-- TEXT scans into []byte exactly as VARCHAR does, so no Go change is required
-- and this is a strict widening. The repository writes encodeTags(...) which is
-- never empty ("{}" at minimum), so the NOT NULL constraints keep holding.
-- cmd/server/migration_tracing_tables_test.go pins the pair.

ALTER TABLE trace_spans ALTER COLUMN tags TYPE TEXT USING tags;

ALTER TABLE otel_collector_configs ALTER COLUMN config_yaml TYPE TEXT USING config_yaml;
