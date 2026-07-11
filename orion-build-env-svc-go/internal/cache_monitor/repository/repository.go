package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"orion-build-env-svc-go/internal/models"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// RecordEvent records a cache event
func (r *Repository) RecordEvent(ctx context.Context, tenantID string, event *models.CacheEvent) error {
	event.ID = uuid.New().String()
	event.TenantID = tenantID
	event.CreatedAt = time.Now().UTC()

	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO cache_event (id, tenant_id, cache_id, event_type, latency_saved_ms, created_at)
		 VALUES (:id, :tenant_id, :cache_id, :event_type, :latency_saved_ms, :created_at)`,
		event)
	if err != nil {
		return fmt.Errorf("failed to record cache event: %w", err)
	}
	return nil
}

// ListEvents lists cache events for a tenant
func (r *Repository) ListEvents(ctx context.Context, tenantID string, limit, offset int) ([]models.CacheEvent, error) {
	if limit <= 0 {
		limit = 50
	}
	var items []models.CacheEvent
	err := r.db.SelectContext(ctx, &items,
		`SELECT id, tenant_id, cache_id, event_type, latency_saved_ms, created_at
		 FROM cache_event WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
		tenantID, limit, offset)
	if err != nil {
		return nil, err
	}
	return items, nil
}

// GetDashboardStats returns aggregate stats for dashboard
func (r *Repository) GetDashboardStats(ctx context.Context, tenantID string) (totalEvents int64, totalHits int64, totalMisses int64, avgLatencySaved float64, err error) {
	err = r.db.GetContext(ctx, &struct {
		TotalEvents   int64
		TotalHits     int64
		TotalMisses   int64
		AvgLatencySaved float64
	}{},
		`SELECT
			COUNT(*) as total_events,
			SUM(CASE WHEN event_type = 'hit' THEN 1 ELSE 0 END) as total_hits,
			SUM(CASE WHEN event_type = 'miss' THEN 1 ELSE 0 END) as total_misses,
			AVG(latency_saved_ms) as avg_latency_saved
		 FROM cache_event WHERE tenant_id = $1`,
		tenantID)
	if err != nil {
		return 0, 0, 0, 0, err
	}
	return totalEvents, totalHits, totalMisses, avgLatencySaved, nil
}
