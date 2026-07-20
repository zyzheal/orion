package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/chaos-gateway/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"orion/go-common/pkg/sentinel"
)

var (

	ErrConflict  = errors.New("chaos experiment conflict")
	ErrRunning   = errors.New("experiment is running")
	ErrPaused    = errors.New("experiment is not paused")
)

// Repository persists chaos-experiment entities in PostgreSQL via sqlx.
type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// ---------- Experiment ----------

func (r *Repository) CreateExperiment(ctx context.Context, exp *models.ChaosExperiment) error {
	now := models.UnixNow()
	exp.ID = uuid.New().String()
	exp.CreatedAt = now
	exp.UpdatedAt = now

	_, err := r.db.ExecContext(ctx,
		`INSERT INTO chaos_experiments
		  (id, name, description, status, scenario, targets, duration, intensity,
		   schedule, monitoring, safeguards, created_by, created_at, updated_at, started_at, completed_at, tenant_id)
		 VALUES
		  ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
		exp.ID, exp.Name, exp.Description, exp.Status,
		string(exp.Scenario), exp.Targets, exp.Duration, exp.Intensity,
		exp.Schedule, exp.Monitoring, exp.Safeguards, exp.CreatedBy,
		now, now, nullInt64(exp.StartedAt), nullInt64(exp.CompletedAt), exp.TenantID,
)
	return err
}

func (r *Repository) GetExperiment(ctx context.Context, tenantID, id string) (*models.ChaosExperiment, error) {
	var exp models.ChaosExperiment
	err := r.db.GetContext(ctx, &exp,
		`SELECT id, name, description, status, scenario, targets, duration, intensity,
		   schedule, monitoring, safeguards, created_by, created_at, updated_at, started_at, completed_at, tenant_id
		 FROM chaos_experiments WHERE id=$1 AND tenant_id=$2`, id, tenantID,
)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, sentinel.NotFound
		}
		return nil, err
	}
	return &exp, nil
}

func (r *Repository) UpdateExperiment(ctx context.Context, tenantID, id string, patch func(*models.ChaosExperiment)) error {
	exp, err := r.GetExperiment(ctx, tenantID, id)
	if err != nil {
		return err
	}
	patch(exp)

	now := models.UnixNow()
	exp.UpdatedAt = now
	_, err = r.db.ExecContext(ctx,
		`UPDATE chaos_experiments
		   SET name=$1, description=$2, status=$3, targets=$4, duration=$5, intensity=$6,
		       schedule=$7, monitoring=$8, safeguards=$9, updated_at=$10
		 WHERE id=$11 AND tenant_id=$12`,
		exp.Name, exp.Description, exp.Status, exp.Targets, exp.Duration, exp.Intensity,
		exp.Schedule, exp.Monitoring, exp.Safeguards, now, id, tenantID,
)
	return err
}

func (r *Repository) UpdateStatus(ctx context.Context, tenantID, id string, status models.ExperimentStatus, completedAt *int64) error {
	now := models.UnixNow()
	_, err := r.db.ExecContext(ctx,
		`UPDATE chaos_experiments
		   SET status=$1, completed_at=$2, updated_at=$3
		 WHERE id=$4 AND tenant_id=$5`,
		status, nullInt64(completedAt), now, id, tenantID,
)
	return err
}

func (r *Repository) DeleteExperiment(ctx context.Context, tenantID, id string) error {
	// Cascade: delete associated results and logs, then the experiment.
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM chaos_experiment_results WHERE experiment_id=$1 AND tenant_id=$2`, id, tenantID,
)
	if err != nil {
		return err
	}
	_, err = r.db.ExecContext(ctx,
		`DELETE FROM chaos_experiment_logs WHERE experiment_id=$1 AND tenant_id=$2`, id, tenantID,
)
	if err != nil {
		return err
	}
	_, err = r.db.ExecContext(ctx,
		`DELETE FROM chaos_experiments WHERE id=$1 AND tenant_id=$2`, id, tenantID,
)
	return err
}

// ---------- Experiment list ----------

func (r *Repository) ListExperiments(ctx context.Context, tenantID string, q models.ListQuery) ([]models.ChaosExperiment, int, error) {
	if q.Limit <= 0 || q.Limit > 100 {
		q.Limit = 20
	}
	if q.Order == "" {
		q.Order = "desc"
	}
	if q.Sort == "" {
		// safe list of allowed sort columns.
		q.Sort = "created_at"
	}
	allowedSort := map[string]struct{}{
		"created_at": {},
		"updated_at": {},
		"status":     {},
		"name":       {},
	}
	if _, ok := allowedSort[q.Sort]; !ok {
		q.Sort = "created_at"
	}
	orderBy := fmt.Sprintf("%s %s", q.Sort, q.Order)

	// Build WHERE clause with positional args.
	args := []interface{}{tenantID}
	placeholders := []string{"tenant_id=$1"}
	arg := 2
	if q.Status != "" {
		placeholders = append(placeholders, fmt.Sprintf("status=$%d", arg))
		args = append(args, q.Status)
		arg++
	}
	if q.Scenario != "" {
		placeholders = append(placeholders, fmt.Sprintf("scenario=$%d", arg))
		args = append(args, string(q.Scenario))
		arg++
	}
	if q.CreatedBy != "" {
		placeholders = append(placeholders, fmt.Sprintf("created_by=$%d", arg))
		args = append(args, q.CreatedBy)
		arg++
	}
	where := "WHERE " + joinPlaceholders(placeholders)

	// Count.
	var total int
	err := r.db.GetContext(ctx, &total, "SELECT COUNT(*) FROM chaos_experiments "+where, args...)
	if err != nil {
		return nil, 0, err
	}

	// Select page.
	selectArgs := append(args, q.Limit, q.Offset)
	query := fmt.Sprintf("SELECT id, name, description, status, scenario, targets, duration, intensity, schedule, monitoring, safeguards, created_by, created_at, updated_at, started_at, completed_at, tenant_id FROM chaos_experiments %s ORDER BY %s LIMIT $%d OFFSET $%d",
		where, orderBy, arg, arg+1)
	var exps []models.ChaosExperiment
	err = r.db.SelectContext(ctx, &exps, query, selectArgs...)
	return exps, total, err
}

func joinPlaceholders(p []string) string {
	out := ""
	for i, v := range p {
		if i > 0 {
			out += ", "
		}
		out += v
	}
	return out
}

// ---------- Results ----------

func (r *Repository) CreateResult(ctx context.Context, res *models.ExperimentResult) error {
	res.ID = uuid.New().String()
	now := models.UnixNow()
	res.CreatedAt = now
	if res.Metrics == "" {
		res.Metrics = "[]"
	}
	if res.ImpactedTargets == "" {
		res.ImpactedTargets = "[]"
	}
	if res.Insights == "" {
		res.Insights = "[]"
	}
	if res.Recommendations == "" {
		res.Recommendations = "[]"
	}
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO chaos_experiment_results
		  (id, experiment_id, status, start_time, end_time, duration,
		   metrics, impacted_targets, recovery_time, detection_time,
		   insights, recommendations, tenant_id, created_at)
		 VALUES
		  ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
		res.ID, res.ExperimentID, res.Status,
		nullInt64(res.StartTime), nullInt64(res.EndTime), res.Duration,
		res.Metrics, res.ImpactedTargets, res.RecoveryTime, res.DetectionTime,
		res.Insights, res.Recommendations, res.TenantID, now,
)
	return err
}

func (r *Repository) ListResults(ctx context.Context, tenantID, experimentID string, limit, offset int) ([]models.ExperimentResult, int, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	var total int
	err := r.db.GetContext(ctx, &total,
		`SELECT COUNT(*) FROM chaos_experiment_results WHERE experiment_id=$1 AND tenant_id=$2`, experimentID, tenantID)
	if err != nil {
		return nil, 0, err
	}
	var results []models.ExperimentResult
	err = r.db.SelectContext(ctx, &results,
		`SELECT id, experiment_id, status, start_time, end_time, duration, metrics,
		   impacted_targets, recovery_time, detection_time, insights, recommendations, tenant_id, created_at
		 FROM chaos_experiment_results WHERE experiment_id=$1 AND tenant_id=$2
		 ORDER BY created_at DESC LIMIT $3 OFFSET $4`,
		experimentID, tenantID, limit, offset,
)
	return results, total, err
}

// ---------- Logs ----------

func (r *Repository) CreateLog(ctx context.Context, log *models.ExperimentLog) error {
	log.ID = uuid.New().String()
	now := models.UnixNow()
	log.CreatedAt = now
	if log.Details == "" {
		log.Details = "null"
	}
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO chaos_experiment_logs
		  (id, experiment_id, timestamp, level, message, details, tenant_id, created_at)
		 VALUES
		  ($1, $2, $3, $4, $5, $6, $7, $8)`,
		log.ID, log.ExperimentID, log.Timestamp, log.Level, log.Message, log.Details, log.TenantID, now,
)
	return err
}

func (r *Repository) ListLogs(ctx context.Context, tenantID, experimentID string, limit, offset int) ([]models.ExperimentLog, int, error) {
	if limit <= 0 || limit > 200 {
		limit = 100
	}
	var total int
	err := r.db.GetContext(ctx, &total,
		`SELECT COUNT(*) FROM chaos_experiment_logs WHERE experiment_id=$1 AND tenant_id=$2`, experimentID, tenantID)
	if err != nil {
		return nil, 0, err
	}
	var logs []models.ExperimentLog
	err = r.db.SelectContext(ctx, &logs,
		`SELECT id, experiment_id, timestamp, level, message, details, tenant_id, created_at
		 FROM chaos_experiment_logs WHERE experiment_id=$1 AND tenant_id=$2
		 ORDER BY timestamp DESC, created_at DESC LIMIT $3 OFFSET $4`,
		experimentID, tenantID, limit, offset,
)
	return logs, total, err
}

// ---------- Helper ----------

func nullString(s *string) *string { return s }

func nullInt64(i *int64) *int64 {
	return i
}

// ensure unused package reference
var _ = fmt.Sprintf
var _ = time.Now
