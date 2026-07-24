package repository

import (
	"context"
	"errors"
	"strconv"
	"time"

	"orion/platform-svc-go/internal/service-catalog/models"

	"github.com/google/uuid"
)

var ErrRequestNotFound = errors.New("service request not found")

// GetRequest retrieves a service request by ID for the tenant.
func (r *Repository) GetRequest(ctx context.Context, tenantID, id string) (*models.ServiceRequest, error) {
	var req models.ServiceRequest
	err := r.db.GetContext(ctx, &req,
		`SELECT * FROM service-catalog-requests WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		return nil, ErrRequestNotFound
	}
	return &req, nil
}

// UpdateRequestStatus validates and persists a status transition, appending a timeline entry.
func (r *Repository) UpdateRequestStatus(ctx context.Context, tenantID, id string,
	newStatus string, comment string, assignedTo *string, by string) (*models.ServiceRequest, error) {
	// Read current
	cur, err := r.GetRequest(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	// Validate transition
	allowed, ok := validRepoTransitions[cur.Status]
	if !ok {
		return nil, errors.New("unknown current status: " + cur.Status)
	}
	allowedMap := make(map[string]bool)
	for _, s := range allowed {
		allowedMap[s] = true
	}
	if !allowedMap[newStatus] {
		return nil, errors.New("invalid status transition: " + cur.Status + " -> " + newStatus)
	}
	// Build update
	now := time.Now().UTC()
	updateSQL := "UPDATE service-catalog-requests SET status = $1, assigned_to = $2, updated_at = $3 WHERE id = $4 AND tenant_id = $5"
	_, err = r.db.ExecContext(ctx, updateSQL, newStatus, assignedTo, now, id, tenantID)
	if err != nil {
		return nil, err
	}
	// Insert timeline entry
	timelineID := uuid.New().String()
	_, err = r.db.ExecContext(ctx, `
		INSERT INTO service-catalog-timeline (id, request_id, tenant_id, action, by, comment, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		timelineID, id, tenantID, "status_change:"+newStatus, by, comment, now)
	if err != nil {
		return nil, err
	}
	cur.Status = newStatus
	cur.UpdatedAt = now.Unix()
	return cur, nil
}

// GetRequestTimeline returns timeline entries for a request.
func (r *Repository) GetRequestTimeline(ctx context.Context, tenantID, requestID string) ([]models.TimelineEntry, error) {
	var entries []models.TimelineEntry
	err := r.db.SelectContext(ctx, &entries, `
		SELECT action, by, comment, created_at as at
		FROM service-catalog-timeline
		WHERE request_id = $1 AND tenant_id = $2
		ORDER BY created_at DESC`, requestID, tenantID)
	return entries, err
}

// GetSLABreaches returns requests that have breached SLA targets.
func (r *Repository) GetSLABreaches(ctx context.Context, tenantID string,
	serviceFilter string, from int64, limit int) ([]models.SLABreach, error) {
	var breaches []models.SLABreach
	query := `SELECT request_id as "requestId", service as "service", sla_target_ms as "slaTargetMs",
				actual_ms as "actualMs", (actual_ms - sla_target_ms) as "overdueMs", status
			FROM service-catalog-requests
			WHERE tenant_id = $1 AND status = 'fulfilled' AND actual_ms > sla_target_ms`
	args := []interface{}{tenantID}
	if serviceFilter != "" {
		query += " AND service = $" + strconv.Itoa(len(args)+1)
		args = append(args, serviceFilter)
	}
	if from > 0 {
		query += " AND created_at >= $" + strconv.Itoa(len(args)+1)
		args = append(args, time.Unix(from, 0))
	}
	query += " ORDER BY overdue_ms DESC LIMIT $" + strconv.Itoa(len(args)+1)
	args = append(args, limit)
	err := r.db.SelectContext(ctx, &breaches, query, args...)
	return breaches, err
}

// validRepoTransitions defines allowed status transitions (kept internal to repository).
var validRepoTransitions = map[string][]string{
	"pending":     {"approved", "rejected", "cancelled"},
	"approved":    {"in_progress", "cancelled"},
	"in_progress": {"fulfilled", "cancelled"},
	"fulfilled":   {},
	"rejected":    {},
	"cancelled":   {},
}
