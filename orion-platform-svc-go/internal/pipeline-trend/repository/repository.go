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
	"orion/platform-svc-go/internal/pipeline-trend/models"
)

type RepositoryInterface interface {
	// CRUD for PipelineTrend records
	Create(ctx context.Context, trend *models.PipelineTrend) error
	GetByID(ctx context.Context, tenantID, id string) (*models.PipelineTrend, error)
	GetAll(ctx context.Context, tenantID string) ([]models.PipelineTrend, error)
	Update(ctx context.Context, trend *models.PipelineTrend) error
	Delete(ctx context.Context, tenantID, id string) error

	// Trend aggregation queries
	GetRunHistoryCompare(ctx context.Context, tenantID string, pipelineIDs []string, period, granularity string) (map[string][]models.TrendEntry, error)
	GetRunHistoryTrend(ctx context.Context, tenantID, pipelineID, period, granularity string) ([]models.TrendEntry, error)
	GetTrendByPipeline(ctx context.Context, tenantID, pipelineID string) ([]models.PipelineTrend, error)
}

// Repository implements RepositoryInterface using PostgreSQL via sqlx.
type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// Ensure *Repository implements RepositoryInterface at compile time.
var _ RepositoryInterface = (*Repository)(nil)

// ---------------------------------------------------------------------------
// CRUD operations for PipelineTrend
// ---------------------------------------------------------------------------

// Create persists a new PipelineTrend record.
func (r *Repository) Create(ctx context.Context, trend *models.PipelineTrend) error {
	if trend.ID == "" {
		trend.ID = uuid.New().String()
	}
	now := time.Now().UTC().Format("2006-01-02T15:04:05Z")
	if trend.CreatedAt == "" {
		trend.CreatedAt = now
	}
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO pipeline_trends
			(id, pipeline_id, success_rate, avg_duration, total_runs, failed_runs,
			 period, period_start, tenant_id, created_at)
		VALUES
			(:id, :pipeline_id, :success_rate, :avg_duration, :total_runs, :failed_runs,
			 :period, :period_start, :tenant_id, :created_at)
	`, trend)
	return err
}

// GetByID retrieves a single PipelineTrend by its id scoped to the tenant.
func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.PipelineTrend, error) {
	var trend models.PipelineTrend
	err := r.db.GetContext(ctx, &trend, `
		SELECT id, pipeline_id, success_rate, avg_duration, total_runs, failed_runs,
		       period, period_start, tenant_id, created_at
		FROM pipeline_trends
		WHERE id = $1 AND tenant_id = $2
	`, id, tenantID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrTrendNotFound
		}
		return nil, fmt.Errorf("get pipeline trend by id: %w", err)
	}
	return &trend, nil
}

// GetAll returns all PipelineTrend records for a given tenant.
func (r *Repository) GetAll(ctx context.Context, tenantID string) ([]models.PipelineTrend, error) {
	var trends []models.PipelineTrend
	err := r.db.SelectContext(ctx, &trends, `
		SELECT id, pipeline_id, success_rate, avg_duration, total_runs, failed_runs,
		       period, period_start, tenant_id, created_at
		FROM pipeline_trends
		WHERE tenant_id = $1
		ORDER BY created_at DESC
	`, tenantID)
	if err != nil {
		return nil, fmt.Errorf("get all pipeline trends: %w", err)
	}
	return trends, nil
}

// Update modifies an existing PipelineTrend record.
func (r *Repository) Update(ctx context.Context, trend *models.PipelineTrend) error {
	_, err := r.db.NamedExecContext(ctx, `
		UPDATE pipeline_trends
		SET pipeline_id  = :pipeline_id,
		    success_rate = :success_rate,
		    avg_duration = :avg_duration,
		    total_runs   = :total_runs,
		    failed_runs  = :failed_runs,
		    period       = :period,
		    period_start = :period_start
		WHERE id = :id AND tenant_id = :tenant_id
	`, trend)
	if err != nil {
		return fmt.Errorf("update pipeline trend: %w", err)
	}
	return nil
}

// Delete removes a PipelineTrend record scoped to the tenant.
func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	result, err := r.db.ExecContext(ctx, `
		DELETE FROM pipeline_trends
		WHERE id = $1 AND tenant_id = $2
	`, id, tenantID)
	if err != nil {
		return fmt.Errorf("delete pipeline trend: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return ErrTrendNotFound
	}
	return nil
}

// ---------------------------------------------------------------------------
// Trend aggregation queries (pre-existing)
// ---------------------------------------------------------------------------

// intervalFromPeriod converts a period string to a PostgreSQL interval.
func intervalFromPeriod(period string) string {
	switch period {
	case "7d":
		return "7 days"
	case "30d":
		return "30 days"
	case "90d":
		return "90 days"
	default:
		return "30 days"
	}
}

// dateTruncFmt returns the date_trunc granularity argument.
func dateTruncFmt(granularity string) string {
	switch granularity {
	case "hour":
		return "hour"
	case "day":
		return "day"
	case "week":
		return "week"
	default:
		return "day"
	}
}

// GetRunHistoryTrend returns aggregated run history for a single pipeline.
func (r *Repository) GetRunHistoryTrend(ctx context.Context, tenantID, pipelineID, period, granularity string) ([]models.TrendEntry, error) {
	interval := intervalFromPeriod(period)
	trunc := dateTruncFmt(granularity)

	query := fmt.Sprintf(`
		SELECT
			to_char(date_trunc('%s', started_at), 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS date,
			COUNT(*)                                                                  AS total,
			COUNT(*) FILTER (WHERE status = 'succeeded')                               AS succeeded,
			COUNT(*) FILTER (WHERE status = 'failed')                                  AS failed,
			COUNT(*) FILTER (WHERE status = 'cancelled')                               AS cancelled,
			AVG(EXTRACT(EPOCH FROM (COALESCE(completed_at, NOW()) - started_at)))      AS avg_duration
		FROM pipeline_runs
		WHERE pipeline_id = $1
		  AND tenant_id = $2
		  AND started_at >= NOW() - INTERVAL '%s'
		GROUP BY date_trunc('%s', started_at)
		ORDER BY date_trunc('%s', started_at) ASC
	`, trunc, interval, trunc, trunc)

	var entries []struct {
		Date        string   `db:"date"`
		Total       int      `db:"total"`
		Succeeded   int      `db:"succeeded"`
		Failed      int      `db:"failed"`
		Cancelled   int      `db:"cancelled"`
		AvgDuration *float64 `db:"avg_duration"`
	}

	err := r.db.SelectContext(ctx, &entries, query, pipelineID, tenantID)
	if err != nil {
		return nil, fmt.Errorf("query pipeline trend: %w", err)
	}

	result := make([]models.TrendEntry, len(entries))
	for i, e := range entries {
		result[i] = models.TrendEntry{
			Date:        e.Date,
			Total:       e.Total,
			Succeeded:   e.Succeeded,
			Failed:      e.Failed,
			Cancelled:   e.Cancelled,
			AvgDuration: e.AvgDuration,
		}
	}
	return result, nil
}

// GetRunHistoryCompare returns aggregated run history for multiple pipelines in a
// single SQL query using `WHERE pipeline_id IN (?, ?, ...)`, avoiding N+1 roundtrips.
func (r *Repository) GetRunHistoryCompare(ctx context.Context, tenantID string, pipelineIDs []string, period, granularity string) (map[string][]models.TrendEntry, error) {
	if len(pipelineIDs) == 0 {
		return make(map[string][]models.TrendEntry), nil
	}
	interval := intervalFromPeriod(period)
	trunc := dateTruncFmt(granularity)
	placeholders := strings.Repeat(",?", len(pipelineIDs)-1)

	query := fmt.Sprintf(`
		SELECT
			pipeline_id,
			to_char(date_trunc('%s', started_at), 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS date,
			COUNT(*)                                                                  AS total,
			COUNT(*) FILTER (WHERE status = 'succeeded')                               AS succeeded,
			COUNT(*) FILTER (WHERE status = 'failed')                                  AS failed,
			COUNT(*) FILTER (WHERE status = 'cancelled')                               AS cancelled,
			AVG(EXTRACT(EPOCH FROM (COALESCE(completed_at, NOW()) - started_at)))      AS avg_duration
		FROM pipeline_runs
		WHERE pipeline_id IN (?$%s)
		  AND tenant_id = $%d
		  AND started_at >= NOW() - INTERVAL '%s'
		GROUP BY pipeline_id, date_trunc('%s', started_at)
		ORDER BY pipeline_id, date_trunc('%s', started_at) ASC
	`, trunc, placeholders, len(pipelineIDs)+1, interval, trunc, trunc)

	var args []any
	for _, pid := range pipelineIDs {
		args = append(args, pid)
	}
	args = append(args, tenantID)

	var rows []struct {
		PipelineID  string   `db:"pipeline_id"`
		Date        string   `db:"date"`
		Total       int      `db:"total"`
		Succeeded   int      `db:"succeeded"`
		Failed      int      `db:"failed"`
		Cancelled   int      `db:"cancelled"`
		AvgDuration *float64 `db:"avg_duration"`
	}
	err := r.db.SelectContext(ctx, &rows, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query pipeline trend compare: %w", err)
	}

	result := make(map[string][]models.TrendEntry, len(pipelineIDs))
	for _, row := range rows {
		result[row.PipelineID] = append(result[row.PipelineID], models.TrendEntry{
			Date:        row.Date,
			Total:       row.Total,
			Succeeded:   row.Succeeded,
			Failed:      row.Failed,
			Cancelled:   row.Cancelled,
			AvgDuration: row.AvgDuration,
		})
	}
	return result, nil
}

// GetTrendByPipeline returns all PipelineTrend records for a given pipeline
// scoped to a tenant.
func (r *Repository) GetTrendByPipeline(ctx context.Context, tenantID, pipelineID string) ([]models.PipelineTrend, error) {
	var trends []models.PipelineTrend
	err := r.db.SelectContext(ctx, &trends, `
		SELECT id, pipeline_id, success_rate, avg_duration, total_runs, failed_runs,
		       period, period_start, tenant_id, created_at
		FROM pipeline_trends
		WHERE pipeline_id = $1 AND tenant_id = $2
		ORDER BY period_start ASC
	`, pipelineID, tenantID)
	if err != nil {
		return nil, fmt.Errorf("get trend by pipeline: %w", err)
	}
	return trends, nil
}

// ErrTrendNotFound indicates the requested trend record does not exist.
var ErrTrendNotFound = errors.New("pipeline trend not found")

// Ensure the repository is usable at package init.
var _ = time.Now
