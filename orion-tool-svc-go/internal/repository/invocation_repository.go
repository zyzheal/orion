package repository

import (
	"context"

	"github.com/jmoiron/sqlx"

	"orion-tool-svc-go/internal/models"
)

// InvocationRepository handles tool invocation records.
type InvocationRepository struct {
	db *sqlx.DB
}

func NewInvocationRepository(db *sqlx.DB) *InvocationRepository {
	return &InvocationRepository{db: db}
}

func (r *InvocationRepository) Create(ctx context.Context, inv *models.ToolInvocation) error {
	query := `INSERT INTO tool_invocations (id, tool_id, tenant_id, input, output, status, error, duration, called_by)
		VALUES (:id, :tool_id, :tenant_id, :input, :output, :status, :error, :duration, :called_by)`
	_, err := r.db.NamedExecContext(ctx, query, inv)
	return err
}

func (r *InvocationRepository) ListByTool(ctx context.Context, tenantID, toolID string, limit, offset int) ([]models.ToolInvocation, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	var invs []models.ToolInvocation
	err := r.db.SelectContext(ctx, &invs,
		`SELECT * FROM tool_invocations WHERE tenant_id=$1 AND tool_id=$2 ORDER BY created_at DESC LIMIT $3 OFFSET $4`,
		tenantID, toolID, limit, offset)
	return invs, err
}

func (r *InvocationRepository) CountByTool(ctx context.Context, tenantID, toolID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count, `SELECT COUNT(*) FROM tool_invocations WHERE tenant_id=$1 AND tool_id=$2`, tenantID, toolID)
	return count, err
}

// VersionRepository handles tool version history.
type VersionRepository struct {
	db *sqlx.DB
}

func NewVersionRepository(db *sqlx.DB) *VersionRepository {
	return &VersionRepository{db: db}
}

func (r *VersionRepository) Create(ctx context.Context, v *models.ToolVersion) error {
	query := `INSERT INTO tool_versions (id, tool_id, version, config, changelog, created_by)
		VALUES (:id, :tool_id, :version, :config, :changelog, :created_by)`
	_, err := r.db.NamedExecContext(ctx, query, v)
	return err
}

func (r *VersionRepository) ListByTool(ctx context.Context, toolID string) ([]models.ToolVersion, error) {
	var versions []models.ToolVersion
	err := r.db.SelectContext(ctx, &versions, `SELECT * FROM tool_versions WHERE tool_id=$1 ORDER BY created_at DESC`, toolID)
	return versions, err
}
