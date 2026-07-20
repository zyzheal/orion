package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"orion/platform-svc-go/internal/privacy/models"
	"orion/go-common/pkg/sentinel"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// EnsureTable creates the privacy_config table if it does not exist.
func (r *Repository) EnsureTable(ctx context.Context) error {
	_, err := r.db.ExecContext(ctx, `
	CREATE TABLE IF NOT EXISTS privacy_config (
		id UUID PRIMARY KEY,
		tenant_id UUID NOT NULL,
		data_mask VARCHAR(32) NOT NULL DEFAULT 'disabled',
		retention_days INTEGER DEFAULT 90,
		data_encryption BOOLEAN DEFAULT FALSE,
		anonymous_stats BOOLEAN DEFAULT TRUE,
		ccpa_enabled BOOLEAN DEFAULT FALSE,
		gdpr_compliance BOOLEAN DEFAULT FALSE,
		user_deletion_policy VARCHAR(32) NOT NULL DEFAULT 'graceful',
		metadata JSONB DEFAULT '{}',
		created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
		updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
		UNIQUE(tenant_id)
	);
	CREATE INDEX IF NOT EXISTS idx_privacy_config_tenant ON privacy_config(tenant_id);
	`)
	return err
}

func (r *Repository) GetConfig(ctx context.Context, tenantID string) (*models.PrivacyConfig, error) {
	var cfg models.PrivacyConfig
	err := r.db.GetContext(ctx, &cfg,
		`SELECT * FROM privacy_config WHERE tenant_id = $1`, tenantID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, sentinel.NotFound
		}
		return nil, err
	}
	return &cfg, nil
}

func (r *Repository) UpsertConfig(ctx context.Context, tenantID string, cfg *models.PrivacyConfig) (*models.PrivacyConfig, error) {
	now := time.Now().UTC()
	meta, _ := json.Marshal(cfg.Metadata)
	result, err := r.db.ExecContext(ctx, `
		INSERT INTO privacy_config
		(id, tenant_id, data_mask, retention_days, data_encryption, anonymous_stats,
		 ccpa_enabled, gdpr_compliance, user_deletion_policy, metadata, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		ON CONFLICT (tenant_id) DO UPDATE SET
			data_mask = EXCLUDED.data_mask,
			retention_days = EXCLUDED.retention_days,
			data_encryption = EXCLUDED.data_encryption,
			anonymous_stats = EXCLUDED.anonymous_stats,
			ccpa_enabled = EXCLUDED.ccpa_enabled,
			gdpr_compliance = EXCLUDED.gdpr_compliance,
			user_deletion_policy = EXCLUDED.user_deletion_policy,
			metadata = EXCLUDED.metadata,
			updated_at = EXCLUDED.updated_at`,
		uuid.New().String(), tenantID, cfg.DataMask, cfg.RetentionDays,
		cfg.DataEncryption, cfg.AnonymousStats, cfg.CCPAEnabled,
		cfg.GDPRCompliance, cfg.UserDeletionPolicy, string(meta), now, now)
	if err != nil {
		return nil, err
	}
	_, err = result.RowsAffected()
	if err != nil {
		return nil, err
	}
	return r.GetConfig(ctx, tenantID)
}

func (r *Repository) UpdateConfig(ctx context.Context, tenantID string, updates map[string]interface{}) (*models.PrivacyConfig, error) {
	updates["updated_at"] = time.Now().UTC()
	meta, ok := updates["metadata"]
	if ok {
		if m, ok := meta.(map[string]string); ok {
			b, _ := json.Marshal(m)
			updates["metadata"] = string(b)
		}
	}
	_, err := r.db.NamedExecContext(ctx,
		`UPDATE privacy_config SET @:updates WHERE tenant_id = :tenant_id`,
		map[string]interface{}{"updates": updates, "tenant_id": tenantID})
	if err != nil {
		return nil, err
	}
	return r.GetConfig(ctx, tenantID)
}

func (r *Repository) DeleteConfig(ctx context.Context, tenantID string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM privacy_config WHERE tenant_id = $1`, tenantID)
	return err
}

func (r *Repository) ListComplianceStatus(ctx context.Context) ([]models.ComplianceStatus, error) {
	type row struct {
		TenantID        string `db:"tenant_id"`
		CCPAEnabled     bool   `db:"ccpa_enabled"`
		GDPRCompliance  bool   `db:"gdpr_compliance"`
		DataEncryption  bool   `db:"data_encryption"`
		RetentionDays   int    `db:"retention_days"`
	}
	var rows []row
	err := r.db.SelectContext(ctx, &rows,
		`SELECT tenant_id, ccpa_enabled, gdpr_compliance, data_encryption, retention_days FROM privacy_config`)
	if err != nil {
		return nil, err
	}
	statuses := make([]models.ComplianceStatus, 0, len(rows))
	for _, r := range rows {
		statuses = append(statuses, models.ComplianceStatus{
			TenantID:       r.TenantID,
			CCPAEnabled:    r.CCPAEnabled,
			GDPRCompliance: r.GDPRCompliance,
			DataEncryption: r.DataEncryption,
			RetentionDays:  r.RetentionDays,
		})
	}
	return statuses, nil
}
