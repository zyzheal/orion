package repository

import (
	"context"
	"fmt"
	"time"

	"orion/notification-svc-go/internal/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// AnomalyRepository provides data access for anomaly detection records.
type AnomalyRepository struct {
	db *sqlx.DB
}

// NewAnomalyRepository creates a new AnomalyRepository.
func NewAnomalyRepository(db *sqlx.DB) *AnomalyRepository {
	return &AnomalyRepository{db: db}
}

// CreateAnomaly inserts a new anomaly record.
func (r *AnomalyRepository) CreateAnomaly(ctx context.Context, a *models.Anomaly) error {
	a.ID = uuid.New().String()
	a.Status = "open"
	a.CreatedAt = time.Now()
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO anomalies (id, tenant_id, type, severity, message, details, source_id, source_id_type, status, created_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
		a.ID, a.TenantID, a.Type, a.Severity, a.Message, a.Details, a.SourceID, a.SourceIDType, a.Status, a.CreatedAt)
	return err
}

// GetAnomalyByID returns an anomaly by id and tenant.
func (r *AnomalyRepository) GetAnomalyByID(ctx context.Context, tenantID, id string) (*models.Anomaly, error) {
	a := &models.Anomaly{}
	err := r.db.GetContext(ctx, a,
		`SELECT * FROM anomalies WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return a, nil
}

// ListAnomalies returns anomalies for a tenant with optional filters.
func (r *AnomalyRepository) ListAnomalies(ctx context.Context, tenantID string, opts models.ListAnomaliesQuery) ([]models.Anomaly, int, error) {
	if opts.Page == 0 {
		opts.Page = 1
	}
	if opts.Size == 0 {
		opts.Size = 20
	}

	conditions := []string{"tenant_id=$1"}
	args := []interface{}{tenantID}
	param := 2

	if opts.Severity != nil {
		conditions = append(conditions, fmt.Sprintf("severity=$%d", param))
		args = append(args, *opts.Severity)
		param++
	}
	if opts.Status != nil {
		conditions = append(conditions, fmt.Sprintf("status=$%d", param))
		args = append(args, *opts.Status)
		param++
	}
	if opts.Type != nil {
		conditions = append(conditions, fmt.Sprintf("type=$%d", param))
		args = append(args, *opts.Type)
		param++
	}

	// Count query
	countQuery := "SELECT COUNT(*) FROM anomalies WHERE " + joinConditions(conditions)
	argsCount := make([]interface{}, len(args))
	copy(argsCount, args)
	var count int
	err := r.db.GetContext(ctx, &count, countQuery, argsCount...)
	if err != nil {
		return nil, 0, err
	}

	// Data query
	dataQuery := "SELECT * FROM anomalies WHERE " + joinConditions(conditions) + fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d OFFSET $%d", param, param+1)
	args = append(args, opts.Size, (opts.Page-1)*opts.Size)

	var items []models.Anomaly
	err = r.db.SelectContext(ctx, &items, dataQuery, args...)
	if err != nil {
		return nil, 0, err
	}
	return items, count, nil
}


// UpdateStatus updates the status of an anomaly.
func (r *AnomalyRepository) UpdateStatus(ctx context.Context, tenantID, id, status string) error {
	var resolvedAt *time.Time
	if status == "resolved" {
		now := time.Now()
		resolvedAt = &now
	}
	_, err := r.db.ExecContext(ctx,
		`UPDATE anomalies SET status=$1, resolved_at=$2 WHERE id=$3 AND tenant_id=$4`,
		status, resolvedAt, id, tenantID)
	return err
}

// CountByType returns anomaly counts grouped by type for a tenant.
func (r *AnomalyRepository) CountByType(ctx context.Context, tenantID string) (map[string]int, error) {
	var rows []struct {
		AnomalyType string `db:"type"`
		Count       int    `db:"count"`
	}
	err := r.db.SelectContext(ctx, &rows,
		`SELECT type, COUNT(*) as count FROM anomalies WHERE tenant_id=$1 GROUP BY type`, tenantID)
	if err != nil {
		return nil, err
	}
	result := make(map[string]int)
	for _, row := range rows {
		// AnomalyType is an alias for the type column
		result[string(row.AnomalyType)] = row.Count
	}
	return result, nil
}
