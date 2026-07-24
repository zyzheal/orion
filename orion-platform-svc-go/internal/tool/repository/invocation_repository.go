package repository

import (
	"context"
	"database/sql"

	"orion/go-common/pkg/database"
	"orion/platform-svc-go/internal/tool/models"
)

// InvocationRepository handles tool invocation records.
type InvocationRepository struct {
	db *database.DB
}

func NewInvocationRepository(db *database.DB) *InvocationRepository {
	return &InvocationRepository{db: db}
}

func (r *InvocationRepository) Create(ctx context.Context, inv *models.ToolInvocation) error {
	query := `INSERT INTO tool_invocations (id, tool_id, tenant_id, input, output, status, error, duration, called_by)
		VALUES (:id, :tool_id, :tenant_id, :input, :output, :status, :error, :duration, :called_by)`
	_, err := r.db.NamedExecContext(ctx, query, inv)
	return err
}

func (r *InvocationRepository) GetByID(ctx context.Context, tenantID, id string) (*models.ToolInvocation, error) {
	var inv models.ToolInvocation
	err := r.db.GetContext(ctx, &inv, `SELECT * FROM tool_invocations WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &inv, err
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

// StatsByPeriod returns overall usage statistics for a tenant over a time period.
func (r *InvocationRepository) StatsByPeriod(ctx context.Context, tenantID, period string) (*models.ToolStats, error) {
	periodExpr := invocationPeriodExpr(period)

	var stats models.ToolStats
	err := r.db.GetContext(ctx, &stats, `
		SELECT
			COUNT(*)::BIGINT AS total_invocations,
			SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END)::BIGINT AS successful_calls,
			SUM(CASE WHEN status != 'success' THEN 1 ELSE 0 END)::BIGINT AS failed_calls,
			ROUND(SUM(CASE WHEN status = 'success' THEN 1.0 ELSE 0.0 END) / NULLIF(COUNT(*), 0), 4) AS success_rate,
			ROUND(AVG(duration)::DOUBLE PRECISION, 2) AS avg_duration_ms,
			PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration)::BIGINT AS p95_duration_ms,
			PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration)::BIGINT AS p99_duration_ms,
			COUNT(DISTINCT called_by)::BIGINT AS active_users
		FROM tool_invocations
		WHERE tenant_id = $1 AND created_at >= `+periodExpr+`
	`, tenantID)
	if err == sql.ErrNoRows {
		return &models.ToolStats{}, nil
	}
	if err != nil {
		return nil, err
	}
	return &stats, nil
}

// StatsByTool returns usage statistics for a specific tool.
func (r *InvocationRepository) StatsByTool(ctx context.Context, tenantID, toolID string) (*models.ToolStats, error) {
	var stats models.ToolStats
	err := r.db.GetContext(ctx, &stats, `
		SELECT
			COUNT(*)::BIGINT AS total_invocations,
			SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END)::BIGINT AS successful_calls,
			SUM(CASE WHEN status != 'success' THEN 1 ELSE 0 END)::BIGINT AS failed_calls,
			ROUND(SUM(CASE WHEN status = 'success' THEN 1.0 ELSE 0.0 END) / NULLIF(COUNT(*), 0), 4) AS success_rate,
			ROUND(AVG(duration)::DOUBLE PRECISION, 2) AS avg_duration_ms,
			PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration)::BIGINT AS p95_duration_ms,
			PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration)::BIGINT AS p99_duration_ms,
			COUNT(DISTINCT called_by)::BIGINT AS active_users
		FROM tool_invocations
		WHERE tenant_id = $1 AND tool_id = $2
	`, tenantID, toolID)
	if err == sql.ErrNoRows {
		return &models.ToolStats{}, nil
	}
	return &stats, err
}

// TopToolsByInvocations returns the top N tools by invocation count.
func (r *InvocationRepository) TopToolsByInvocations(ctx context.Context, tenantID string, limit int) ([]models.ToolUsageRank, error) {
	var ranks []models.ToolUsageRank
	err := r.db.SelectContext(ctx, &ranks, `
		SELECT
			ti.tool_id,
			t.name AS tool_name,
			t.category,
			COUNT(*)::BIGINT AS invocation_count
		FROM tool_invocations ti
		JOIN tools t ON t.id = ti.tool_id
		WHERE ti.tenant_id = $1
		GROUP BY ti.tool_id, t.name, t.category
		ORDER BY invocation_count DESC
		LIMIT $2
	`, tenantID, limit)
	return ranks, err
}

// invocationPeriodExpr returns the SQL expression for a time period filter.
func invocationPeriodExpr(period string) string {
	switch period {
	case "day":
		return `NOW() - INTERVAL '1 day'`
	case "week":
		return `NOW() - INTERVAL '7 days'`
	case "month":
		return `NOW() - INTERVAL '30 days'`
	default:
		// Default to last day
		return `NOW() - INTERVAL '1 day'`
	}
}

// VersionRepository handles tool version history.
type VersionRepository struct {
	db *database.DB
}

func NewVersionRepository(db *database.DB) *VersionRepository {
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
