// Package repository provides the data access layer for the job operation processor.
package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"

	"orion/platform-svc-go/internal/job-processor/models"
)

// ErrNotFound is returned when a requested record does not exist.
var ErrNotFound = errors.New("job operation not found")

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// ---------------------------------------------------------------------------
// AutoMigrate
// ---------------------------------------------------------------------------

func (r *Repository) AutoMigrate(ctx context.Context) error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS job_operation_chains (
			id          VARCHAR(64) PRIMARY KEY,
			tenant_id   VARCHAR(64)  NOT NULL,
			name        VARCHAR(255)  NOT NULL DEFAULT '',
			status      VARCHAR(16)   NOT NULL DEFAULT 'pending',
			error       TEXT          DEFAULT '',
			created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
			updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS job_operations (
			id           VARCHAR(64)  PRIMARY KEY,
			tenant_id    VARCHAR(64)  NOT NULL,
			chain_id     VARCHAR(64),
			type         VARCHAR(16)  NOT NULL,
			target       VARCHAR(255) NOT NULL,
			params       TEXT         DEFAULT '{}',
			result       TEXT         DEFAULT '{}',
			status       VARCHAR(16)  NOT NULL DEFAULT 'pending',
			error        TEXT         DEFAULT '',
			order        INT          NOT NULL DEFAULT 0,
			created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
			updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
		)`,
	}
	for _, s := range stmts {
		if _, err := r.db.ExecContext(ctx, s); err != nil {
			return fmt.Errorf("job-processor AutoMigrate failed: %w", err)
		}
	}
	for _, s := range []string{
		`CREATE INDEX IF NOT EXISTS idx_job_ops_tenant ON job_operations(tenant_id)`,
		`CREATE INDEX IF NOT EXISTS idx_job_ops_chain ON job_operations(chain_id)`,
		`CREATE INDEX IF NOT EXISTS idx_job_ops_status ON job_operations(status)`,
		`CREATE INDEX IF NOT EXISTS idx_job_ops_type ON job_operations(type)`,
		`CREATE INDEX IF NOT EXISTS idx_job_ops_order ON job_operations(chain_id, order)`,
		`CREATE INDEX IF NOT EXISTS idx_job_chains_tenant ON job_operation_chains(tenant_id)`,
	} {
		if _, err := r.db.ExecContext(ctx, s); err != nil {
			return fmt.Errorf("job-processor index migration failed: %w", err)
		}
	}
	return nil
}

// ---------------------------------------------------------------------------
// JobOperationChain CRUD
// ---------------------------------------------------------------------------

func (r *Repository) CreateChain(ctx context.Context, tenantID string, name string) (*models.JobOperationChain, error) {
	now := time.Now().UTC()
	chain := &models.JobOperationChain{
		ID:        uuid.New().String(),
		TenantID:  tenantID,
		Name:      name,
		Status:    models.StatusPending,
		CreatedAt: now,
		UpdatedAt: now,
	}
	q := `INSERT INTO job_operation_chains (id, tenant_id, name, status, error, created_at, updated_at)
		VALUES (:id, :tenant_id, :name, :status, :error, :created_at, :updated_at)`
	_, err := r.db.NamedExecContext(ctx, q, chain)
	return chain, err
}

func (r *Repository) GetChain(ctx context.Context, tenantID, id string) (*models.JobOperationChain, error) {
	var c models.JobOperationChain
	err := r.db.GetContext(ctx, &c, `SELECT * FROM job_operation_chains WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	return &c, err
}

func (r *Repository) UpdateChain(ctx context.Context, tenantID, id string, fields map[string]interface{}) (*models.JobOperationChain, error) {
	fields["updated_at"] = time.Now().UTC()
	delete(fields, "id")
	delete(fields, "tenant_id")
	if len(fields) == 0 {
		return r.GetChain(ctx, tenantID, id)
	}
	var parts []string
	for k := range fields {
		parts = append(parts, fmt.Sprintf("%s=:%s", k, k))
	}
	bind := map[string]interface{}{
		"id":        id,
		"tenant_id": tenantID,
	}
	for k, v := range fields {
		bind[k] = v
	}
	_, err := r.db.NamedExecContext(ctx,
		`UPDATE job_operation_chains SET `+strings.Join(parts, ", ")+` WHERE id=:id AND tenant_id=:tenant_id`,
		bind,
	)
	if err != nil {
		return nil, err
	}
	return r.GetChain(ctx, tenantID, id)
}

func (r *Repository) ListChains(ctx context.Context, tenantID string, limit, offset int) (*models.ChainListResponse, error) {
	limit = clamp(limit, 1, 100)
	resp := &models.ChainListResponse{}
	if err := r.db.GetContext(ctx, &resp.Total, `SELECT COUNT(*) FROM job_operation_chains WHERE tenant_id=$1`, tenantID); err != nil {
		return nil, err
	}
	if err := r.db.SelectContext(ctx, &resp.Data,
		`SELECT * FROM job_operation_chains WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, tenantID, limit, offset); err != nil {
		return nil, err
	}
	return resp, nil
}

// ---------------------------------------------------------------------------
// JobOperation CRUD
// ---------------------------------------------------------------------------

func (r *Repository) CreateOperation(ctx context.Context, op *models.JobOperation) error {
	op.ID = uuid.New().String()
	op.CreatedAt = time.Now().UTC()
	op.UpdatedAt = op.CreatedAt
	paramsJSON := "{}"
	if op.Params != "" {
		paramsJSON = op.Params
	}
	op.Params = paramsJSON
	op.Result = "{}"
	_, err := r.db.NamedExecContext(ctx, `INSERT INTO job_operations (id, tenant_id, chain_id, type, target, params, result, status, error, order, created_at, updated_at) VALUES (:id, :tenant_id, :chain_id, :type, :target, :params, :result, :status, :error, :order, :created_at, :updated_at)`, op)
	return err
}

func (r *Repository) GetOperation(ctx context.Context, tenantID, id string) (*models.JobOperation, error) {
	var op models.JobOperation
	err := r.db.GetContext(ctx, &op, `SELECT * FROM job_operations WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	return &op, err
}

func (r *Repository) ListOperations(ctx context.Context, tenantID, chainID string, limit, offset int) (*models.OperationListResponse, error) {
	limit = clamp(limit, 1, 100)
	resp := &models.OperationListResponse{}
	if chainID != "" {
		if err := r.db.GetContext(ctx, &resp.Total, `SELECT COUNT(*) FROM job_operations WHERE tenant_id=$1 AND chain_id=$2`, tenantID, chainID); err != nil {
			return nil, err
		}
		if err := r.db.SelectContext(ctx, &resp.Data,
			`SELECT * FROM job_operations WHERE tenant_id=$1 AND chain_id=$2 ORDER BY order ASC LIMIT $3 OFFSET $4`, tenantID, chainID, limit, offset); err != nil {
			return nil, err
		}
	} else {
		if err := r.db.GetContext(ctx, &resp.Total, `SELECT COUNT(*) FROM job_operations WHERE tenant_id=$1`, tenantID); err != nil {
			return nil, err
		}
		if err := r.db.SelectContext(ctx, &resp.Data,
			`SELECT * FROM job_operations WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, tenantID, limit, offset); err != nil {
			return nil, err
		}
	}
	return resp, nil
}

// UpdateStatus updates the status and optionally result/error on an operation.
func (r *Repository) UpdateStatus(ctx context.Context, tenantID, id string, status string, resultJSON string, errMsg string) error {
	now := time.Now().UTC()
	_, err := r.db.ExecContext(ctx,
		`UPDATE job_operations SET status=$1, result=$2, error=$3, updated_at=$4 WHERE id=$5 AND tenant_id=$6`,
		status, resultJSON, errMsg, now, id, tenantID,
	)
	return err
}

// ---------------------------------------------------------------------------
// Bind helpers — return sqlx-compatible parameter maps
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// internal helpers
// ---------------------------------------------------------------------------

func clamp(v, lo, hi int) int {
	if v < lo {
		return lo
	}
	if v > hi {
		return hi
	}
	return v
}
