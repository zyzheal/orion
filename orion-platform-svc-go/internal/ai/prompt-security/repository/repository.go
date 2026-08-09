package repository

import (
	"context"
	"database/sql"
	"errors"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/ai/prompt-security/models"
)

// RepositoryInterface defines persistence operations for prompt security checks.
type RepositoryInterface interface {
	Create(ctx context.Context, check *models.SecurityCheck) error
	GetAll(ctx context.Context, tenantID string) ([]models.SecurityCheck, error)
	GetByRiskScore(ctx context.Context, tenantID string, minScore int) ([]models.SecurityCheck, error)
	ListRecent(ctx context.Context, tenantID string, limit int) ([]models.SecurityCheck, error)
}

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// tenantUUID converts a string tenant ID to uuid.UUID for DB queries.
func tenantUUID(tenantID string) uuid.UUID {
	parsed, err := uuid.Parse(tenantID)
	if err != nil {
		return uuid.Nil
	}
	return parsed
}

// Create persists a security check record.
func (r *Repository) Create(ctx context.Context, check *models.SecurityCheck) error {
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO security_checks
			(id, tenant_id, check_type, prompt_hash, risk_score, is_safe, action, matched_keywords, findings, checked_at)
		VALUES
			(:id, :tenant_id, :type, :prompt_hash, :risk_score, :is_safe, :action, :matched_keywords, :findings, :checked_at)
	`, check)
	return err
}

// GetAll returns all security checks for a tenant.
func (r *Repository) GetAll(ctx context.Context, tenantID string) ([]models.SecurityCheck, error) {
	var checks []models.SecurityCheck
	err := r.db.SelectContext(ctx, &checks, `
		SELECT id, tenant_id, check_type, prompt_hash, risk_score, is_safe, action, matched_keywords, findings, checked_at, created_at
		FROM security_checks
		WHERE tenant_id = $1
		ORDER BY checked_at DESC
		LIMIT 1000
	`, tenantUUID(tenantID))
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, sentinel.NotFound
		}
		return nil, err
	}
	return checks, nil
}

// GetByRiskScore returns checks whose risk_score >= minScore for a tenant.
func (r *Repository) GetByRiskScore(ctx context.Context, tenantID string, minScore int) ([]models.SecurityCheck, error) {
	var checks []models.SecurityCheck
	err := r.db.SelectContext(ctx, &checks, `
		SELECT id, tenant_id, check_type, prompt_hash, risk_score, is_safe, action, matched_keywords, findings, checked_at, created_at
		FROM security_checks
		WHERE tenant_id = $1 AND risk_score >= $2
		ORDER BY risk_score DESC
		LIMIT 500
	`, tenantUUID(tenantID), minScore)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, sentinel.NotFound
		}
		return nil, err
	}
	return checks, nil
}

// ListRecent returns the most recent N checks for a tenant.
func (r *Repository) ListRecent(ctx context.Context, tenantID string, limit int) ([]models.SecurityCheck, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	var checks []models.SecurityCheck
	err := r.db.SelectContext(ctx, &checks, `
		SELECT id, tenant_id, check_type, prompt_hash, risk_score, is_safe, action, matched_keywords, findings, checked_at, created_at
		FROM security_checks
		WHERE tenant_id = $1
		ORDER BY checked_at DESC
		LIMIT $2
	`, tenantUUID(tenantID), limit)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, sentinel.NotFound
		}
		return nil, err
	}
	return checks, nil
}
