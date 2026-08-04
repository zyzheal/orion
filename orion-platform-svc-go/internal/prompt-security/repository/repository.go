package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/prompt-security/models"

	"github.com/jmoiron/sqlx"
)

// SecurityScanRecord stores a scan result in DB.
type SecurityScanRecord struct {
	ID              int64     `db:"id"`
	TenantID        string    `db:"tenant_id"`
	PromptPreview   string    `db:"prompt_preview"`
	Score           float64   `db:"score"`
	IsSafe          bool      `db:"is_safe"`
	FindingsJSON    string    `db:"findings"`
	Severity        int       `db:"severity"`
	InjectionDetected bool    `db:"injection_detected"`
	PiiDetected     bool      `db:"pii_detected"`
	ScanTimeMs      int       `db:"scan_time_ms"`
	CreatedAt       time.Time `db:"created_at"`
	UpdatedAt       time.Time `db:"updated_at"`
}

// SecurityConfigRecord stores per-tenant config in DB.
type SecurityConfigRecord struct {
	ID               int64     `db:"id"`
	TenantID         string    `db:"tenant_id"`
	IsEnabled        bool      `db:"is_enabled"`
	InjectionEnabled bool      `db:"injection_detection"`
	PiiDetection     bool      `db:"pii_detection"`
	MaxPromptLength  int       `db:"max_prompt_length"`
	BlockedPatterns  string    `db:"blocked_patterns"`
	CreatedAt        time.Time `db:"created_at"`
	UpdatedAt        time.Time `db:"updated_at"`
}

// Repository handles prompt-security data persistence.
type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// ---------- Config ----------

// GetConfig returns the security config for a tenant. Creates a default if missing.
func (r *Repository) GetConfig(ctx context.Context, tenantID string) (*models.PromptSecurityConfig, error) {
	var rec SecurityConfigRecord
	err := r.db.GetContext(ctx, &rec,
		`SELECT * FROM prompt_security_configs WHERE tenant_id=$1`, tenantID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			// Create default config for this tenant
			cfg := r.createDefaultConfig(tenantID)
			if saveErr := r.saveConfig(ctx, cfg); saveErr != nil {
				return nil, fmt.Errorf("failed to create default config: %w", saveErr)
			}
			return cfg, nil
		}
		return nil, err
	}
	return r.recordToModel(&rec), nil
}

func (r *Repository) saveConfig(ctx context.Context, cfg *models.PromptSecurityConfig) error {
	var err error
	// Check if config exists
	var id int64
	err = r.db.GetContext(ctx, &id,
		`SELECT id FROM prompt_security_configs WHERE tenant_id=$1`, cfg.TenantID)
	if err == nil {
		// Update
		_, err = r.db.ExecContext(ctx,
			`UPDATE prompt_security_configs SET
				 is_enabled=$1, injection_detection=$2, pii_detection=$3,
				 max_prompt_length=$4, blocked_patterns=$5, updated_at=now()
				 WHERE tenant_id=$6`,
			cfg.IsEnabled, cfg.InjectionEnabled, cfg.PiiDetection,
			cfg.MaxPromptLength, cfg.BlockedPatterns, cfg.TenantID)
		return err
	}
	if errors.Is(err, sql.ErrNoRows) {
		// Insert
		now := time.Now().UTC()
		cfg.CreatedAt = now
		_, err = r.db.NamedExecContext(ctx,
			`INSERT INTO prompt_security_configs
				 (tenant_id, is_enabled, injection_detection, pii_detection,
				 max_prompt_length, blocked_patterns, created_at, updated_at)
			 VALUES (:tenantId, :is_enabled, :injection_detection, :pii_detection,
				 :max_prompt_length, :blocked_patterns, :createdAt, :createdAt)`,
			cfg)
		return err
	}
	return err
}

// UpdateConfig updates security config for a tenant.
func (r *Repository) UpdateConfig(ctx context.Context, tenantID string, updates map[string]interface{}) (*models.PromptSecurityConfig, error) {
	cfg, err := r.GetConfig(ctx, tenantID)
	if err != nil {
		return nil, fmt.Errorf("failed to get config for update: %w", err)
	}

	for key, value := range updates {
		switch key {
		case "is_enabled":
			if v, ok := value.(bool); ok {
				cfg.IsEnabled = v
			}
		case "injection_detection":
			if v, ok := value.(bool); ok {
				cfg.InjectionEnabled = v
			}
		case "pii_detection":
			if v, ok := value.(bool); ok {
				cfg.PiiDetection = v
			}
		case "max_prompt_length":
			if v, ok := value.(float64); ok {
				cfg.MaxPromptLength = int(v)
			}
		case "blocked_patterns":
			if v, ok := value.(string); ok {
				cfg.BlockedPatterns = v
			}
		}
	}

	if err := r.saveConfig(ctx, cfg); err != nil {
		return nil, fmt.Errorf("failed to update config: %w", err)
	}
	return cfg, nil
}

// ---------- Scan ----------

// SaveScan persists a scan result.
func (r *Repository) SaveScan(ctx context.Context, record *SecurityScanRecord) error {
	now := time.Now().UTC()
	record.CreatedAt = now
	record.UpdatedAt = now

	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO prompt_security_scans
			 (tenant_id, prompt_preview, score, is_safe, findings, severity,
			 injection_detected, pii_detected, scan_time_ms, created_at, updated_at)
		 VALUES (:tenantId, :promptPreview, :score, :isSafe, :findingsJSON::jsonb, :severity,
			 :injectionDetected, :piiDetected, :scanTimeMs, :createdAt, :updatedAt)`,
		record)
	return err
}

// ListScans retrieves scans for a tenant with pagination.
func (r *Repository) ListScans(ctx context.Context, tenantID string, page, limit int) ([]SecurityScanRecord, error) {
	if limit <= 0 {
		limit = 20
	}
	offset := page * limit

	var scans []SecurityScanRecord
	err := r.db.SelectContext(ctx, &scans,
		`SELECT * FROM prompt_security_scans WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
		tenantID, limit, offset)
	return scans, err
}

// ScanCount returns the total number of scans for a tenant.
func (r *Repository) ScanCount(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM prompt_security_scans WHERE tenant_id=$1`, tenantID)
	return count, err
}

// ---------- Helpers ----------

func (r *Repository) createDefaultConfig(tenantID string) *models.PromptSecurityConfig {
	return &models.PromptSecurityConfig{
		ID:               fmt.Sprintf("cfg_%d", time.Now().UnixNano()),
		TenantID:         tenantID,
		IsEnabled:        true,
		InjectionEnabled: true,
		PiiDetection:     true,
		MaxPromptLength:  10000,
		BlockedPatterns:  "ignore previous,disregard,discard,forget",
	}
}

func (r *Repository) recordToModel(rec *SecurityConfigRecord) *models.PromptSecurityConfig {
	return &models.PromptSecurityConfig{
		ID:               fmt.Sprintf("cfg_%d", rec.ID),
		TenantID:         rec.TenantID,
		IsEnabled:        rec.IsEnabled,
		InjectionEnabled: rec.InjectionEnabled,
		PiiDetection:     rec.PiiDetection,
		MaxPromptLength:  rec.MaxPromptLength,
		BlockedPatterns:  rec.BlockedPatterns,
		CreatedAt:        rec.CreatedAt,
	}
}

// ---------- Init ----------

// AutoMigrate creates tables if they do not exist. Safe to call multiple times.
// This is a no-op if the migration system is used, but provides defense-in-depth
// for dev/test environments.
func AutoMigrate(db *sqlx.DB) error {
	createConfigs := `CREATE TABLE IF NOT EXISTS prompt_security_configs (
		id                BIGSERIAL PRIMARY KEY,
		tenant_id         TEXT NOT NULL,
		is_enabled        BOOLEAN DEFAULT TRUE,
		injection_detection BOOLEAN DEFAULT TRUE,
		pii_detection     BOOLEAN DEFAULT TRUE,
		max_prompt_length INT DEFAULT 10000,
		blocked_patterns  TEXT DEFAULT 'ignore previous,disregard,discard,forget',
		created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
	)`
	createScans := `CREATE TABLE IF NOT EXISTS prompt_security_scans (
		id                 BIGSERIAL PRIMARY KEY,
		tenant_id          TEXT NOT NULL,
		prompt_preview     TEXT DEFAULT '',
		score            DOUBLE PRECISION DEFAULT 0,
		is_safe          BOOLEAN DEFAULT TRUE,
		findings         JSONB DEFAULT '[]',
		severity         INT DEFAULT 0,
		injection_detected BOOLEAN DEFAULT FALSE,
		pii_detected       BOOLEAN DEFAULT FALSE,
		scan_time_ms       INT DEFAULT 0,
		created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
	)`

	_, err := db.Exec(createConfigs)
	if err != nil {
		return fmt.Errorf("failed to create prompt_security_configs table: %w", err)
	}
	_, err = db.Exec(createScans)
	if err != nil {
		return fmt.Errorf("failed to create prompt_security_scans table: %w", err)
	}

	_, err = db.Exec(`CREATE INDEX IF NOT EXISTS idx_psc_tenant ON prompt_security_configs(tenant_id)`)
	if err != nil {
		return fmt.Errorf("failed to create index on prompt_security_configs: %w", err)
	}
	_, err = db.Exec(`CREATE INDEX IF NOT EXISTS idx_pss_tenant ON prompt_security_scans(tenant_id)`)
	if err != nil {
		return fmt.Errorf("failed to create index on prompt_security_scans: %w", err)
	}
	_, err = db.Exec(`CREATE INDEX IF NOT EXISTS idx_pss_created ON prompt_security_scans(created_at)`)
	if err != nil {
		return fmt.Errorf("failed to create index on prompt_security_scans created_at: %w", err)
	}
	return nil
}

// ---------- Scan record builder ----------

// NewScanRecord converts a SecurityScan model into a DB-ready SecurityScanRecord.
func NewScanRecord(scan *models.SecurityScan) *SecurityScanRecord {
	findingsJSON := "[]"
	if scan.Findings != nil {
		b, _ := json.Marshal(scan.Findings)
		findingsJSON = string(b)
	}
	severity := calculateSeverity(scan)

	return &SecurityScanRecord{
		TenantID:        scan.TenantID,
		PromptPreview:   scan.Prompt,
		Score:           scan.Score,
		IsSafe:          scan.IsSafe,
		FindingsJSON:    findingsJSON,
		Severity:        severity,
		InjectionDetected: scan.InjectionDetected,
		PiiDetected:     scan.PiiDetected,
		ScanTimeMs:      scan.ScanTimeMs,
	}
}

func calculateSeverity(scan *models.SecurityScan) int {
	severity := 0
	if scan.InjectionDetected {
		severity += 3
	}
	if scan.PiiDetected {
		severity += 2
	}
	// Score-based severity floor
	if scan.Score >= 0.5 {
		if severity < 1 {
			severity = 1
		}
	}
	return severity
}

// ---------- Interface ----------

// RepositoryInterface abstracts the repository for testing.
type RepositoryInterface interface {
	GetConfig(ctx context.Context, tenantID string) (*models.PromptSecurityConfig, error)
	UpdateConfig(ctx context.Context, tenantID string, updates map[string]interface{}) (*models.PromptSecurityConfig, error)
	SaveScan(ctx context.Context, record *SecurityScanRecord) error
	ListScans(ctx context.Context, tenantID string, page, limit int) ([]SecurityScanRecord, error)
	ScanCount(ctx context.Context, tenantID string) (int, error)
}

// Ensure concrete implementation
var _ RepositoryInterface = (*Repository)(nil)
