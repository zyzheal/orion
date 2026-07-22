package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/ai-security/models"

	"github.com/jmoiron/sqlx"
)

var ErrVulnerabilityEngine = errors.New("vulnerability scanning engine unavailable")
var ErrNoFixAvailable = errors.New("no fix available for CVE")

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// ---- Core CRUD ----

func (r *Repository) List(ctx context.Context, tenantID string) ([]models.Record, error) {
	var records []models.Record
	err := r.db.SelectContext(ctx, &records, "SELECT * FROM ai_securitys WHERE tenant_id=$1", tenantID)
	return records, err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.Record, error) {
	var record models.Record
	err := r.db.GetContext(ctx, &record, "SELECT * FROM ai_securitys WHERE id=$1 AND tenant_id=$2", id, tenantID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, sentinel.NotFound
	}
	return &record, err
}

func (r *Repository) Create(ctx context.Context, tenantID string, req models.CreateRequest) (*models.Record, error) {
	var record models.Record
	err := r.db.GetContext(ctx, &record,
		"INSERT INTO ai_securitys (tenant_id, name, status, config) VALUES ($1, $2, $3, $4) RETURNING id, tenant_id, name, status, created_at",
		tenantID, req.Name, req.Status, req.Config,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, sentinel.NotFound
	}
	return &record, err
}

func (r *Repository) Update(ctx context.Context, tenantID, id string, req models.CreateRequest) (*models.Record, error) {
	var record models.Record
	err := r.db.GetContext(ctx, &record,
		"UPDATE ai_securitys SET name=$1, status=$2, config=$3 WHERE id=$4 AND tenant_id=$5 RETURNING id, tenant_id, name, status, created_at",
		req.Name, req.Status, req.Config, id, tenantID,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, sentinel.NotFound
	}
	return &record, err
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	result, err := r.db.ExecContext(ctx, "DELETE FROM ai_securitys WHERE id=$1 AND tenant_id=$2", id, tenantID)
	if err != nil {
		return err
	}
	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return sentinel.NotFound
	}
	return nil
}

// ---- Vulnerability / CVE scanning ----

func (r *Repository) FindVulnerabilities(ctx context.Context, tenantID string, image string) (*models.ScanVulnerabilitiesResult, error) {
	return nil, ErrVulnerabilityEngine
}

func (r *Repository) GetVulnerability(ctx context.Context, tenantID, cveID string) (*models.Vulnerability, error) {
	return nil, sentinel.NotFound
}

func (r *Repository) ListVulnerabilities(ctx context.Context, tenantID string) ([]models.Vulnerability, error) {
	return []models.Vulnerability{}, nil
}

func (r *Repository) FixVulnerability(ctx context.Context, tenantID, image string, cveIDs []string) (*models.FixVulnerabilityResult, error) {
	return nil, ErrNoFixAvailable
}

func (r *Repository) CheckVulnerability(ctx context.Context, tenantID, cveID string) (*models.CheckVulnerabilityResult, error) {
	return nil, ErrVulnerabilityEngine
}

// ---- AI Security engine: policies, audit, blocks ----

// ListPolicies retrieves all security policies for a tenant.
func (r *Repository) ListPolicies(ctx context.Context, tenantID string) ([]models.SecurityPolicy, error) {
	var policies []models.SecurityPolicy
	err := r.db.SelectContext(ctx, &policies,
		"SELECT * FROM ai_security_policies WHERE tenant_id=$1 ORDER BY created_at DESC", tenantID)
	return policies, err
}

// ListAuditLogs retrieves audit log entries with optional filtering.
func (r *Repository) ListAuditLogs(ctx context.Context, tenantID string, filter *models.AuditLogFilter) ([]models.AuditLog, error) {
	var logs []models.AuditLog
	stmt := "SELECT * FROM ai_security_audit_logs WHERE tenant_id=$1"
	args := []interface{}{tenantID}
	argPos := 2

	if filter != nil {
		if filter.EventType != "" {
			stmt += fmt.Sprintf(" AND event_type=$%d", argPos)
			args = append(args, filter.EventType)
			argPos++
		}
		if filter.Actor != "" {
			stmt += fmt.Sprintf(" AND actor=$%d", argPos)
			args = append(args, filter.Actor)
			argPos++
		}
		if filter.From != "" {
			stmt += fmt.Sprintf(" AND timestamp >= $%d", argPos)
			args = append(args, filter.From)
			argPos++
		}
		if filter.To != "" {
			stmt += fmt.Sprintf(" AND timestamp <= $%d", argPos)
			args = append(args, filter.To)
			argPos++
		}
	}
	stmt += " ORDER BY timestamp DESC"

	err := r.db.SelectContext(ctx, &logs, stmt, args...)
	return logs, err
}

// CreateBlock creates a new block record.
func (r *Repository) CreateBlock(ctx context.Context, tenantID string, block *models.BlockRecord) error {
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO ai_security_blocks (id, tenant_id, target, reason, blocked_by, expires_at, created_at)
		VALUES (:id, :tenant_id, :target, :reason, :blocked_by, :expires_at, :created_at)`,
		block)
	return err
}

// GetBlock retrieves a block by target.
func (r *Repository) GetBlock(ctx context.Context, tenantID, target string) (*models.BlockRecord, error) {
	var block models.BlockRecord
	err := r.db.GetContext(ctx, &block,
		"SELECT * FROM ai_security_blocks WHERE tenant_id=$1 AND target=$2 AND (expires_at IS NULL OR expires_at > NOW())",
		tenantID, target)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil // No block exists
	}
	return &block, err
}

// DeleteBlock removes a block record.
func (r *Repository) DeleteBlock(ctx context.Context, tenantID, target string) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM ai_security_blocks WHERE tenant_id=$1 AND target=$2", tenantID, target)
	return err
}
