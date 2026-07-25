package repository

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/sla-engine/models"

	"github.com/google/uuid"
)

// CreateViolation persists a new SLA violation event.
func (r *Repository) CreateViolation(ctx context.Context, v *models.SLAViolation) error {
	v.ID = uuid.New().String()
	now := time.Now().UTC()
	v.CreatedAt = now
	if v.OverdueMs <= 0 {
		v.OverdueMs = 1 // minimum 1ms to avoid zero
	}
	query := `INSERT INTO sla_violations (id, tenant_id, tracker_id, severity, violation_type,
		violated_at, deadline, actual_time, overdue_ms, details, notified, notified_at, created_at)
		VALUES (:id, :tenant_id, :tracker_id, :severity, :violation_type,
		:violated_at, :deadline, :actual_time, :overdue_ms, :details, :notified, :notified_at, :created_at)`
	_, err := r.db.NamedExecContext(ctx, query, v)
	return err
}

// ListViolations lists violations for a tenant, optionally filtered by tracker and severity.
func (r *Repository) ListViolations(ctx context.Context, tenantID string, q models.ViolationListQuery) ([]models.SLAViolation, error) {
	if q.Limit <= 0 {
		q.Limit = 50
	}
	args := []interface{}{tenantID}
	idx := 2
	conds := []string{"tenant_id=$1"}
	if q.TrackerID != "" {
		conds = append(conds, fmt.Sprintf("tracker_id=$%d", idx))
		args = append(args, q.TrackerID)
		idx++
	}
	if q.Severity != "" {
		conds = append(conds, fmt.Sprintf("severity=$%d", idx))
		args = append(args, q.Severity)
		idx++
	}
	if q.ViolationType != "" {
		conds = append(conds, fmt.Sprintf("violation_type=$%d", idx))
		args = append(args, q.ViolationType)
		idx++
	}
	where := conds[0]
	for i := 1; i < len(conds); i++ {
		where += " AND " + conds[i]
	}
	sql := fmt.Sprintf("SELECT * FROM sla_violations WHERE %s ORDER BY violated_at DESC LIMIT $%d OFFSET $%d",
		where, idx, idx+1)
	args = append(args, q.Limit, q.Offset)
	var items []models.SLAViolation
	err := r.db.SelectContext(ctx, &items, sql, args...)
	return items, err
}

// MarkViolated updates a tracker to "breached" and records the violation.
func (r *Repository) MarkViolated(ctx context.Context, tenantID, trackerID string, violationType, details string) (*models.SLAViolation, error) {
	t, err := r.GetTracker(ctx, tenantID, trackerID)
	if err != nil {
		return nil, err
	}
	now := time.Now().UTC()

	// Determine severity from profile
	var severity models.SeverityLevel
	switch t.SLAProfileID {
	case "":
		severity = models.SeverityP2 // default
	default:
		profile, err := r.GetProfile(ctx, tenantID, t.SLAProfileID)
		if err == nil && profile.Priority != "" {
			severity = models.SeverityLevel(profile.Priority)
			if !severity.IsValid() {
				severity = models.SeverityP2
			}
		} else {
			severity = models.SeverityP2
		}
	}

	var deadline time.Time
	var overdueMs int64
	switch violationType {
	case "response":
		deadline = t.ResponseDeadline
		overdueMs = int64(now.Sub(deadline).Milliseconds())
	case "resolution":
		deadline = t.ResolutionDeadline
		overdueMs = int64(now.Sub(deadline).Milliseconds())
	}
	if overdueMs < 0 {
		overdueMs = 1
	}

	// Mark tracker breached
	if err := r.UpdateTracker(ctx, tenantID, trackerID, map[string]interface{}{
		"status":        "breached",
		"breach_reason": details,
	}); err != nil {
		return nil, err
	}

	// Create violation record
	v := &models.SLAViolation{
		TenantID:      tenantID,
		TrackerID:     trackerID,
		Severity:      severity,
		ViolationType: violationType,
		ViolatedAt:    now,
		Deadline:      deadline,
		ActualTime:    now,
		OverdueMs:     overdueMs,
		Details:       details,
		Notified:      false,
	}
	if err := r.CreateViolation(ctx, v); err != nil {
		return nil, err
	}
	return v, nil
}

// GetViolationsByTracker fetches all violations for a single tracker.
func (r *Repository) GetViolationsByTracker(ctx context.Context, trackerID string) ([]models.SLAViolation, error) {
	var items []models.SLAViolation
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM sla_violations WHERE tracker_id=$1 ORDER BY violated_at DESC`, trackerID)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return items, nil
}

// GetViolationStatistics returns a count summary of violations for a tenant.
func (r *Repository) GetViolationStatistics(ctx context.Context, tenantID string) (models.ViolationStatistics, error) {
	var stats models.ViolationStatistics
	_ = r.db.GetContext(ctx, &stats.TotalViolations,
		`SELECT COUNT(*) FROM sla_violations WHERE tenant_id=$1`, tenantID)
	_ = r.db.GetContext(ctx, &stats.ResponseBreach,
		`SELECT COUNT(*) FROM sla_violations WHERE tenant_id=$1 AND violation_type=$2`, tenantID, "response")
	_ = r.db.GetContext(ctx, &stats.ResolutionBreach,
		`SELECT COUNT(*) FROM sla_violations WHERE tenant_id=$1 AND violation_type=$2`, tenantID, "resolution")
	_ = r.db.GetContext(ctx, &stats.Notified,
		`SELECT COUNT(*) FROM sla_violations WHERE tenant_id=$1 AND notified=$2`, tenantID, true)
	return stats, nil
}

// Ensure compile-time check: Repository implements ViolationRepository.
var _ ViolationRepository = (*Repository)(nil)

// ViolationRepository defines the violation-specific data access contract.
type ViolationRepository interface {
	CreateViolation(ctx context.Context, v *models.SLAViolation) error
	ListViolations(ctx context.Context, tenantID string, q models.ViolationListQuery) ([]models.SLAViolation, error)
	MarkViolated(ctx context.Context, tenantID, trackerID string, violationType, details string) (*models.SLAViolation, error)
	GetViolationsByTracker(ctx context.Context, trackerID string) ([]models.SLAViolation, error)
	GetViolationStatistics(ctx context.Context, tenantID string) (models.ViolationStatistics, error)
}
