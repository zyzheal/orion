package explain

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// Repository persists ExplainJob rows for historical audit. Plans
// can be several KB, so we only keep the raw text — the parsed tree
// is regenerated on demand.
type Repository struct {
	db *sqlx.DB
}

// NewRepository returns a Repository backed by db.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// Insert writes one job. ID is generated when empty.
func (r *Repository) Insert(ctx context.Context, job *ExplainJob) error {
	if job.ID == "" {
		job.ID = uuid.NewString()
	}
	if job.CreatedAt.IsZero() {
		job.CreatedAt = time.Now().UTC()
	}
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO dba_explain_history
			(id, tenant_id, data_source_id, db_type, sql, plan_text, passed, duration_ms, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
	`,
		job.ID, job.TenantID, job.DataSourceID, job.DBType, job.SQL, job.PlanText,
		job.Passed, job.DurationMs, job.CreatedAt,
	)
	return err
}

// Recent returns the most recent jobs for a tenant, newest first.
func (r *Repository) Recent(ctx context.Context, tenantID string, limit int) ([]ExplainJob, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	var out []ExplainJob
	err := r.db.SelectContext(ctx, &out, `
		SELECT id, tenant_id, data_source_id, db_type, sql, plan_text, passed, duration_ms, created_at
		FROM dba_explain_history
		WHERE tenant_id = $1
		ORDER BY created_at DESC
		LIMIT $2
	`, tenantID, limit)
	return out, err
}

// Prune deletes jobs older than the cutoff.
func (r *Repository) Prune(ctx context.Context, cutoff time.Time) (int64, error) {
	res, err := r.db.ExecContext(ctx,
		`DELETE FROM dba_explain_history WHERE created_at < $1`, cutoff,
	)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}
