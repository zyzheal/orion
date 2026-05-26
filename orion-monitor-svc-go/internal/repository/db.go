package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/zap"
)

// DB wraps pgxpool and provides common query helpers.
type DB struct {
	pool   *pgxpool.Pool
	logger *zap.Logger
}

func NewDB(pool *pgxpool.Pool, log *zap.Logger) *DB {
	return &DB{pool: pool, logger: log}
}

func (d *DB) Pool() *pgxpool.Pool {
	return d.pool
}

func (d *DB) Logger() *zap.Logger {
	return d.logger
}

// RunMigrations executes数据库迁移。
func (d *DB) RunMigrations(ctx context.Context, migrationsDir string) error {
	// Read and execute SQL files in order
	files, err := readMigrationFiles(migrationsDir)
	if err != nil {
		return fmt.Errorf("failed to read migration files: %w", err)
	}

	for _, f := range files {
		d.logger.Info("applying migration", zap.String("file", f.Name))
		if _, err := d.pool.Exec(ctx, f.SQL); err != nil {
			return fmt.Errorf("failed to apply migration %s: %w", f.Name, err)
		}
	}

	d.logger.Info("all migrations applied successfully", zap.Int("count", len(files)))
	return nil
}

type migrationFile struct {
	Name string
	SQL  string
}

func readMigrationFiles(dir string) ([]migrationFile, error) {
	// In production, use a proper migration tool like goose or migrate.
	// For simplicity, we embed the SQL directly.
	sql := `
CREATE TABLE IF NOT EXISTS metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    metric_name VARCHAR(255) NOT NULL,
    value DOUBLE PRECISION NOT NULL,
    tags JSONB,
    timestamp TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS traces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    trace_id VARCHAR(64) NOT NULL,
    span_id VARCHAR(64) NOT NULL,
    parent_span_id VARCHAR(64),
    service_name VARCHAR(255),
    operation_name VARCHAR(255),
    status VARCHAR(50),
    duration_ms INTEGER,
    attributes JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    rule_name VARCHAR(255),
    severity VARCHAR(50),
    status VARCHAR(50),
    description TEXT,
    triggered_at TIMESTAMP,
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alert_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255),
    metric_name VARCHAR(255),
    operator VARCHAR(10),
    threshold DOUBLE PRECISION,
    evaluation_interval_sec INTEGER,
    is_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_metrics_tenant_ts ON metrics(tenant_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_name ON metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_traces_tenant_ts ON traces(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_traces_trace_id ON traces(trace_id);
CREATE INDEX IF NOT EXISTS idx_traces_service ON traces(service_name);
CREATE INDEX IF NOT EXISTS idx_alerts_tenant ON alerts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_alert_rules_tenant ON alert_rules(tenant_id);
`
	return []migrationFile{{Name: "001_create_monitor_tables", SQL: sql}}, nil
}
