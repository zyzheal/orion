package repository

import ("orion/go-common/pkg/sentinel"

	"context"
	"database/sql"

	"orion/platform-svc-go/internal/pipeline-run-history/models"

	"github.com/jmoiron/sqlx"
)
// ErrNotFound is a sentinel for not-found errors.
var ErrNotFound = sentinel.NotFound


type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// GetRunHistory aggregates pipeline_runs by the given time period.
func (r *Repository) GetRunHistory(ctx context.Context, pipelineID string, tenantID string, period string, limit int) ([]models.RunHistoryEntry, error) {
	query := `
		SELECT
			date_trunc($1, created_at) AS period_start,
			date_trunc($1, created_at) + INTERVAL '1' || $1 AS period_end,
			COUNT(*) AS total_runs,
			COUNT(*) FILTER (WHERE status = 'succeeded') AS succeeded,
			COUNT(*) FILTER (WHERE status = 'failed') AS failed,
			COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled,
			AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) AS avg_duration
		FROM pipeline_runs
		WHERE pipeline_id = $2 AND tenant_id = $3
		GROUP BY period_start
		ORDER BY period_start DESC
		LIMIT $4
	`

	var entries []models.RunHistoryEntry
	err := r.db.SelectContext(ctx, &entries, query, period, pipelineID, tenantID, limit)
	if err != nil {
		return nil, err
	}
	return entries, nil
}

// CountRunHistory returns the total number of runs for a pipeline in a tenant.
func (r *Repository) CountRunHistory(ctx context.Context, pipelineID string, tenantID string) (int, error) {
	var count sql.NullInt64
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM pipeline_runs WHERE pipeline_id=$1 AND tenant_id=$2`,
		pipelineID, tenantID)
	if err != nil {
		return 0, err
	}
	if count.Valid {
		return int(count.Int64), nil
	}
	return 0, nil
}
