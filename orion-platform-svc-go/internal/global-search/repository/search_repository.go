// Package repository provides persistence for global search configuration.
package repository

import (
	"context"
	"database/sql"

	"github.com/jmoiron/sqlx"
)

// SearchConfig stores module-specific indexing configuration in PostgreSQL.
type SearchConfig struct {
	ID              sql.NullInt64 `db:"id"`
	Module          string        `db:"module"`
	IndexName       string        `db:"index_name"`
	Enabled         bool          `db:"enabled"`
	FullTextField   sql.NullString `db:"full_text_field"`
	RefreshInterval sql.NullString `db:"refresh_interval"`
	Shards          int           `db:"shards"`
	Replicas        int           `db:"replicas"`
	LastReindexedAt sql.NullTime  `db:"last_reindexed_at"`
	CreatedAt       sql.NullTime  `db:"created_at"`
	UpdatedAt       sql.NullTime  `db:"updated_at"`
}

// IndexerStatusRecord stores the last-known status of a module indexer.
type IndexerStatusRecord struct {
	ID        sql.NullInt64 `db:"id"`
	Module    string        `db:"module"`
	IndexName string        `db:"index_name"`
	DocCount  int64         `db:"doc_count"`
	Healthy   bool          `db:"healthy"`
	Error     sql.NullString `db:"error"`
	CreatedAt sql.NullTime  `db:"created_at"`
	UpdatedAt sql.NullTime  `db:"updated_at"`
}

// Repository manages search configuration in PostgreSQL.
type Repository struct {
	db *sqlx.DB
}

// NewRepository creates a new search repository.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// AutoMigrate creates the tables if they do not exist.
func (r *Repository) AutoMigrate(ctx context.Context) error {
	stmt := `
	CREATE TABLE IF NOT EXISTS global_search_configs (
		id SERIAL PRIMARY KEY,
		module VARCHAR(64) NOT NULL UNIQUE,
		index_name VARCHAR(128) NOT NULL,
		enabled BOOLEAN DEFAULT true,
		full_text_field VARCHAR(64),
		refresh_interval VARCHAR(32),
		shards INT DEFAULT 1,
		replicas INT DEFAULT 0,
		last_reindexed_at TIMESTAMP,
		created_at TIMESTAMP DEFAULT NOW(),
		updated_at TIMESTAMP DEFAULT NOW()
	);
	CREATE TABLE IF NOT EXISTS global_search_statuses (
		id SERIAL PRIMARY KEY,
		module VARCHAR(64) NOT NULL UNIQUE,
		index_name VARCHAR(128) NOT NULL,
		doc_count BIGINT DEFAULT 0,
		healthy BOOLEAN DEFAULT false,
		"error" TEXT,
		created_at TIMESTAMP DEFAULT NOW(),
		updated_at TIMESTAMP DEFAULT NOW()
	);`
	_, err := r.db.ExecContext(ctx, stmt)
	return err
}

// GetConfig returns the configuration for a module.
func (r *Repository) GetConfig(ctx context.Context, module string) (*SearchConfig, error) {
	var cfg SearchConfig
	err := r.db.GetContext(ctx, &cfg, "SELECT * FROM global_search_configs WHERE module = $1", module)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &cfg, nil
}

// UpsertConfig saves or updates a module's configuration.
func (r *Repository) UpsertConfig(ctx context.Context, cfg *SearchConfig) error {
	stmt := `INSERT INTO global_search_configs (module, index_name, enabled, full_text_field, refresh_interval, shards, replicas, last_reindexed_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		ON CONFLICT (module) DO UPDATE SET
			index_name = EXCLUDED.index_name,
			enabled = EXCLUDED.enabled,
			full_text_field = EXCLUDED.full_text_field,
			refresh_interval = EXCLUDED.refresh_interval,
			shards = EXCLUDED.shards,
			replicas = EXCLUDED.replicas,
			last_reindexed_at = EXCLUDED.last_reindexed_at,
			updated_at = NOW()`
	_, err := r.db.ExecContext(ctx, stmt,
		cfg.Module, cfg.IndexName, cfg.Enabled,
		cfg.FullTextField, cfg.RefreshInterval, cfg.Shards, cfg.Replicas, cfg.LastReindexedAt)
	return err
}

// ListConfigs returns all search configurations.
func (r *Repository) ListConfigs(ctx context.Context) ([]*SearchConfig, error) {
	var configs []*SearchConfig
	err := r.db.SelectContext(ctx, &configs, "SELECT * FROM global_search_configs ORDER BY module")
	return configs, err
}

// GetStatus returns the last-known status for a module.
func (r *Repository) GetStatus(ctx context.Context, module string) (*IndexerStatusRecord, error) {
	var rec IndexerStatusRecord
	err := r.db.GetContext(ctx, &rec, "SELECT * FROM global_search_statuses WHERE module = $1", module)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &rec, nil
}

// UpdateStatus saves the status for a module.
func (r *Repository) UpdateStatus(ctx context.Context, rec *IndexerStatusRecord) error {
	stmt := `INSERT INTO global_search_statuses (module, index_name, doc_count, healthy, error)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (module) DO UPDATE SET
			index_name = EXCLUDED.index_name,
			doc_count = EXCLUDED.doc_count,
			healthy = EXCLUDED.healthy,
			"error" = EXCLUDED.error,
			updated_at = NOW()`
	_, err := r.db.ExecContext(ctx, stmt,
		rec.Module, rec.IndexName, rec.DocCount, rec.Healthy, rec.Error)
	return err
}
