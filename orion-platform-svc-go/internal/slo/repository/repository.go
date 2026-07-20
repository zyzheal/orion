package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/slo/models"

	"orion/go-common/pkg/sentinel"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) CreateSLO(ctx context.Context, slo *models.SLODefinition) error {
	slo.ID = uuid.New().String()
	slo.CreatedAt = time.Now().UTC()
	slo.UpdatedAt = slo.CreatedAt

	tagsJSON := "{}"
	if slo.Tags != nil {
		b, err := json.Marshal(slo.Tags)
		if err != nil {
			return fmt.Errorf("failed to marshal tags: %w", err)
		}
		tagsJSON = string(b)
	}

	_, err := r.db.ExecContext(ctx, `
		INSERT INTO slo_definitions (id, tenant_id, name, display_name, slo_type, target,
			measurement_window, alert_threshold, metric_query, enabled, description, tags,
			created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
	`, slo.ID, slo.TenantID, slo.Name, slo.DisplayName, slo.SLOType, slo.Target,
		slo.MeasurementWindow, slo.AlertThreshold, slo.MetricQuery, slo.Enabled,
		slo.Description, tagsJSON, slo.CreatedAt, slo.UpdatedAt)
	return err
}

func (r *Repository) GetSLO(ctx context.Context, tenantID, id string) (*models.SLODefinition, error) {
	var slo models.SLODefinition
	err := r.db.GetContext(ctx, &slo, `SELECT * FROM slo_definitions WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		return nil, sentinel.NotFound
	}
	return &slo, nil
}

func (r *Repository) ListSLOs(ctx context.Context, tenantID string, sloType string, enabled *bool) ([]models.SLODefinition, error) {
	where := "WHERE tenant_id = $1"
	args := []interface{}{tenantID}
	idx := 2

	if sloType != "" {
		where += fmt.Sprintf(" AND slo_type = $%d", idx)
		args = append(args, sloType)
		idx++
	}
	if enabled != nil {
		where += fmt.Sprintf(" AND enabled = $%d", idx)
		args = append(args, *enabled)
		idx++
	}
	where += " ORDER BY created_at DESC"

	var sloes []models.SLODefinition
	err := r.db.SelectContext(ctx, &sloes, fmt.Sprintf("SELECT * FROM slo_definitions %s", where), args...)
	return sloes, err
}

func (r *Repository) UpdateSLO(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.SLODefinition, error) {
	if len(updates) == 0 {
		return r.GetSLO(ctx, tenantID, id)
	}

	if tags, ok := updates["tags"]; ok {
		if t, ok := tags.(map[string]string); ok {
			b, err := json.Marshal(t)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal tags: %w", err)
			}
			updates["tags"] = string(b)
		}
	}

	setClauses := make([]string, 0, len(updates))
	args := make([]interface{}, 0, len(updates)+2)
	idx := 1
	for k, v := range updates {
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", k, idx))
		args = append(args, v)
		idx++
	}
	args = append(args, id, tenantID)

	_, err := r.db.ExecContext(ctx, fmt.Sprintf(
		"UPDATE slo_definitions SET %s, updated_at = CURRENT_TIMESTAMP WHERE id = $%d AND tenant_id = $%d",
		setClauses, len(args)-1, len(args)), args...)
	if err != nil {
		return nil, err
	}
	return r.GetSLO(ctx, tenantID, id)
}

func (r *Repository) DeleteSLO(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM slo_definitions WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	return err
}

func (r *Repository) RecordSLI(ctx context.Context, m *models.SLIMeasurement) error {
	m.ID = uuid.New().String()
	m.CreatedAt = time.Now().UTC()
	if m.MeasuredAt.IsZero() {
		m.MeasuredAt = m.CreatedAt
	}

	_, err := r.db.ExecContext(ctx, `
		INSERT INTO sli_measurements (id, slo_id, tenant_id, value, measured_at, total, success, error_count, metadata, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`, m.ID, m.SLOID, m.TenantID, m.Value, m.MeasuredAt, m.Total, m.Success, m.ErrorCount, m.Metadata, m.CreatedAt)
	return err
}

func (r *Repository) GetSLIHistory(ctx context.Context, sloID, tenantID string, limit int) ([]models.SLIMeasurement, error) {
	if limit <= 0 {
		limit = 100
	}
	var rows []models.SLIMeasurement
	err := r.db.SelectContext(ctx, &rows, `
		SELECT * FROM sli_measurements WHERE slo_id = $1 AND tenant_id = $2
		ORDER BY measured_at DESC LIMIT $3
	`, sloID, tenantID, limit)
	return rows, err
}

func (r *Repository) GetLatestErrorBudget(ctx context.Context, sloID, tenantID string) (*models.ErrorBudget, error) {
	var eb models.ErrorBudget
	err := r.db.GetContext(ctx, &eb, `
		SELECT * FROM error_budgets WHERE slo_id = $1 AND tenant_id = $2
		ORDER BY period_start DESC LIMIT 1
	`, sloID, tenantID)
	if err != nil {
		return nil, sentinel.NotFound
	}
	return &eb, nil
}

func (r *Repository) GetErrorBudgetHistory(ctx context.Context, sloID, tenantID string, limit int) ([]models.ErrorBudget, error) {
	if limit <= 0 {
		limit = 100
	}
	var rows []models.ErrorBudget
	err := r.db.SelectContext(ctx, &rows, `
		SELECT * FROM error_budgets WHERE slo_id = $1 AND tenant_id = $2
		ORDER BY period_start DESC LIMIT $3
	`, sloID, tenantID, limit)
	return rows, err
}

func (r *Repository) GetDashboard(ctx context.Context, tenantID string) ([]models.SLODefinition, error) {
	var sloes []models.SLODefinition
	err := r.db.SelectContext(ctx, &sloes, `
		SELECT * FROM slo_definitions WHERE tenant_id = $1 AND enabled = true
		ORDER BY created_at DESC
	`, tenantID)
	return sloes, err
}
