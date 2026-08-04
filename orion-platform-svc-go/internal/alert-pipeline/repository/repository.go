package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/alert-pipeline/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// ErrNoResults is returned when no pipeline results are found.
var ErrNoResults = errors.New("no pipeline results found")

// Result is the persistent representation of a pipeline result.
type Result struct {
	ID         uuid.UUID   `db:"id"`
	TenantID   string      `db:"tenant_id"`
	ResultID   uuid.UUID   `db:"result_id"`
	AlertID    string      `db:"alert_id"`
	Status     string      `db:"status"`
	StagesJSON []byte      `db:"stages"`
	StageCount int         `db:"stage_count"`
	ErrorsJSON []byte      `db:"errors"`
	Error      sql.NullString `db:"error"`
	AlertName  sql.NullString `db:"alert_name"`
	Severity   sql.NullString `db:"severity"`
	CreatedAt  time.Time   `db:"created_at"`
}

// Repository persists alert pipeline results to PostgreSQL.
type Repository struct {
	db *sqlx.DB
}

// NewRepository creates a new alert-pipeline repository.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// Save inserts a pipeline result after execution.
func (r *Repository) Save(ctx context.Context, tenantID string, result *models.PipelineResult, alertName, severity string) error {
	if result == nil {
		return fmt.Errorf("result must not be nil")
	}

	id := uuid.New()
	resultID := uuid.New()

	stagesJSON, err := json.Marshal(result.Stages)
	if err != nil {
		return fmt.Errorf("marshal stages: %w", err)
	}
	errorsJSON, err := json.Marshal(result.Errors)
	if err != nil {
		return fmt.Errorf("marshal errors: %w", err)
	}

	var errorStr sql.NullString
	if len(result.Errors) > 0 {
		joined := ""
		for i, e := range result.Errors {
			if i > 0 {
				joined += "; "
			}
			joined += e
		}
		errorStr = sql.NullString{Valid: true, String: joined}
	}

	var alertNameNS sql.NullString
	if alertName != "" {
		alertNameNS = sql.NullString{Valid: true, String: alertName}
	}
	var severityNS sql.NullString
	if severity != "" {
		severityNS = sql.NullString{Valid: true, String: severity}
	}

	_, err = r.db.NamedExecContext(ctx, `
		INSERT INTO alert_pipeline_results
			(id, tenant_id, result_id, alert_id, status, stages, stage_count, errors, error, alert_name, severity, created_at)
		VALUES
			(:id, :tenantId, :resultId, :alertId, :status, :stages, :stageCount, :errors, :error, :alertName, :severity, :createdAt)
	`, map[string]interface{}{
		"id":         id,
		"tenantId":   tenantID,
		"resultId":   resultID,
		"alertId":    result.AlertID,
		"status":     result.Status,
		"stages":     string(stagesJSON),
		"stageCount": result.StageCount,
		"errors":     string(errorsJSON),
		"error":      errorStr,
		"alertName":  alertNameNS,
		"severity":   severityNS,
		"createdAt":  time.Now().UTC(),
	})
	return err
}

// GetByResultID retrieves a result by its result_id.
func (r *Repository) GetByResultID(ctx context.Context, resultID uuid.UUID) (*Result, error) {
	var row Result
	err := r.db.GetContext(ctx, &row,
		`SELECT * FROM alert_pipeline_results WHERE result_id=$1`, resultID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNoResults
	}
	if err != nil {
		return nil, err
	}
	return &row, nil
}

// GetByAlertID retrieves the latest result for a given alert_id.
func (r *Repository) GetByAlertID(ctx context.Context, alertID string) (*Result, error) {
	var row Result
	err := r.db.GetContext(ctx, &row,
		`SELECT * FROM alert_pipeline_results WHERE alert_id=$1 ORDER BY created_at DESC LIMIT 1`, alertID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNoResults
	}
	if err != nil {
		return nil, err
	}
	return &row, nil
}

// List returns recent pipeline results for a tenant with pagination.
func (r *Repository) List(ctx context.Context, tenantID string, limit, offset int) ([]*Result, error) {
	if limit <= 0 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}
	var rows []*Result
	err := r.db.SelectContext(ctx, &rows,
		`SELECT * FROM alert_pipeline_results WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
		tenantID, limit, offset)
	return rows, err
}

// Count returns the number of results for a tenant.
func (r *Repository) Count(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM alert_pipeline_results WHERE tenant_id=$1`, tenantID)
	return count, err
}
