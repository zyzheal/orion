package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"orion/monitor-svc-go/internal/models"
)

// MetricRegistrationRepository manages metric registrations.
type MetricRegistrationRepository struct {
	db *DB
}

func NewMetricRegistrationRepository(db *DB) *MetricRegistrationRepository {
	return &MetricRegistrationRepository{db: db}
}

func (r *MetricRegistrationRepository) Register(ctx context.Context, tenantID uuid.UUID, name, unit string, defaultTags map[string]string, description *string) (*models.MetricRegistration, error) {
	encoded, _ := json.Marshal(defaultTags)
	reg := &models.MetricRegistration{
		ID:          uuid.New(),
		TenantID:    tenantID,
		Name:        name,
		Unit:        unit,
		DefaultTags: encoded,
		Description: *description,
		CreatedAt:   time.Now(),
	}

	query := `INSERT INTO metric_registrations (id, tenant_id, name, unit, default_tags, description, created_at)
	VALUES ($1, $2, $3, $4, $5, $6, $7)
	ON CONFLICT (tenant_id, name) DO UPDATE SET unit = EXCLUDED.unit, default_tags = EXCLUDED.default_tags, description = EXCLUDED.description`
	_, err := r.db.Pool().Exec(ctx, query,
		reg.ID, tenantID, reg.Name, reg.Unit, reg.DefaultTags, reg.Description, reg.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("register metric: %w", err)
	}
	return reg, nil
}

func (r *MetricRegistrationRepository) List(ctx context.Context, tenantID uuid.UUID) (models.MetricRegistrationResponse, error) {
	var resp models.MetricRegistrationResponse

	countQuery := `SELECT COUNT(*) FROM metric_registrations WHERE tenant_id = $1`
	if err := r.db.Pool().QueryRow(ctx, countQuery, tenantID).Scan(&resp.Total); err != nil {
		return resp, fmt.Errorf("count metric registrations: %w", err)
	}

	query := `SELECT id, tenant_id, name, unit, default_tags, description, created_at
	FROM metric_registrations WHERE tenant_id = $1 ORDER BY name`
	rows, err := r.db.Pool().Query(ctx, query, tenantID)
	if err != nil {
		return resp, fmt.Errorf("query metric registrations: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var r models.MetricRegistration
		if err := rows.Scan(&r.ID, &r.TenantID, &r.Name, &r.Unit, &r.DefaultTags, &r.Description, &r.CreatedAt); err != nil {
			continue
		}
		resp.Data = append(resp.Data, r)
	}
	return resp, nil
}

func (r *MetricRegistrationRepository) GetByName(ctx context.Context, tenantID uuid.UUID, name string) (*models.MetricRegistration, error) {
	query := `SELECT id, tenant_id, name, unit, default_tags, description, created_at
	FROM metric_registrations WHERE tenant_id = $1 AND name = $2`
	var r models.MetricRegistration
	err := r.db.Pool().QueryRow(ctx, query, tenantID, name).Scan(
		&r.ID, &r.TenantID, &r.Name, &r.Unit, &r.DefaultTags, &r.Description, &r.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("get metric registration: %w", err)
	}
	return &r, nil
}

func (r *MetricRegistrationRepository) Delete(ctx context.Context, tenantID uuid.UUID, name string) error {
	query := `DELETE FROM metric_registrations WHERE tenant_id = $1 AND name = $2`
	tag, err := r.db.Pool().Exec(ctx, query, tenantID, name)
	if err != nil {
		return fmt.Errorf("delete metric registration: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("metric registration not found")
	}
	return nil
}
