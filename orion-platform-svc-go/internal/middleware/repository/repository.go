package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// Repository persists middleware configuration (rate limits, timeouts, tracing
// settings) per tenant in PostgreSQL.
type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

type TenantConfig struct {
	DefaultTimeout int64         `db:"timeout_ms"`
	TracingEnabled bool          `db:"enabled"`
	Name           string        `db:"name"`
	TenantID       string        `db:"tenant_id"`
	ID             string        `db:"id"`
	RateLimits     RateLimitList `json:"rateLimits"`
}

type RateLimitList struct {
	Data map[string]*RateLimit `json:"data"`
}

type RateLimit struct {
	RequestsPerMin int    `json:"requestsPerMin"`
	Burst          int    `json:"burst"`
	Path           string `json:"path"`
}

type cfgRow struct {
	ID           string `db:"id"`
	TenantID     string `db:"tenant_id"`
	Name         string `db:"name"`
	TimeoutMS    int64  `db:"timeout_ms"`
	Enabled      bool   `db:"enabled"`
	CreatedAt    string `db:"created_at"`
}

func (r *Repository) SaveConfig(ctx context.Context, tenantID string, cfg *TenantConfig) error {
	cfgJSON, err := json.Marshal(cfg.RateLimits)
	if err != nil {
		return fmt.Errorf("marshal rate limits: %w", err)
	}
	if cfg.ID == "" {
		cfg.ID = uuid.New().String()
	}
	_, err = r.db.ExecContext(ctx, `
		INSERT INTO middleware_configs (id, tenant_id, name, timeout_ms, enabled, rate_limits, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, NOW())
		ON CONFLICT (id) DO UPDATE SET tenant_id=EXCLUDED.tenant_id, name=EXCLUDED.name,
			timeout_ms=EXCLUDED.timeout_ms, enabled=EXCLUDED.enabled, rate_limits=EXCLUDED.rate_limits`,
		cfg.ID, tenantID, cfg.Name, cfg.DefaultTimeout, cfg.TracingEnabled, string(cfgJSON))
	return err
}

func (r *Repository) GetConfig(ctx context.Context, tenantID string) (*TenantConfig, error) {
	var row cfgRow
	err := r.db.GetContext(ctx, &row,
		`SELECT * FROM middleware_configs WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 1`, tenantID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &TenantConfig{
		ID:             row.ID,
		TenantID:       tenantID,
		Name:           row.Name,
		DefaultTimeout: row.TimeoutMS,
		TracingEnabled: row.Enabled,
	}, nil
}

func (r *Repository) ListConfigs(ctx context.Context) ([]string, error) {
	var configs []cfgRow
	err := r.db.SelectContext(ctx, &configs, `SELECT DISTINCT tenant_id FROM middleware_configs ORDER BY tenant_id`)
	if err != nil {
		return nil, err
	}
	names := make([]string, len(configs))
	for i, c := range configs {
		names[i] = c.TenantID
	}
	return names, nil
}

func (r *Repository) DeleteConfig(ctx context.Context, tenantID string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM middleware_configs WHERE tenant_id=$1`, tenantID)
	return err
}

func (r *Repository) UpdateTimeout(ctx context.Context, tenantID string, timeout int64) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO middleware_configs (id, tenant_id, name, timeout_ms, enabled, created_at)
		VALUES ($1, $2, $3, $4, $5, NOW())
		ON CONFLICT (tenant_id, name) DO UPDATE SET timeout_ms=EXCLUDED.timeout_ms`,
		uuid.New().String(), tenantID, "default", timeout, true)
	return err
}