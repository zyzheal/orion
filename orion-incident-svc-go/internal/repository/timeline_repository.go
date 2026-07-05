package repository

import (
	"context"
	"database/sql"
	"fmt"

	"orion/go-common/pkg/database"
	"orion/incident-svc-go/internal/models"
)

// TimelineEventRepository provides data access for incident timeline events.
type TimelineEventRepository struct {
	database.BaseRepository
}

func NewTimelineEventRepository(db *database.DB) *TimelineEventRepository {
	return &TimelineEventRepository{
		BaseRepository: database.NewBaseRepository(db),
	}
}

func (r *TimelineEventRepository) Create(ctx context.Context, event *models.TimelineEvent) error {
	query := `INSERT INTO incident_timeline (id, incident_id, tenant_id, event_type, actor_id, content, metadata, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, created_at`
	err := r.DB().QueryRowContext(ctx, query,
		event.ID, event.IncidentID, event.TenantID, event.EventType,
		event.ActorID, event.Content, event.Metadata, event.CreatedAt,
	).Scan(&event.ID, &event.CreatedAt)
	return err
}

func (r *TimelineEventRepository) FindByIncident(ctx context.Context, incidentID string, limit, offset int) ([]models.TimelineEvent, error) {
	query := `SELECT id, incident_id, tenant_id, event_type, actor_id, content, metadata, created_at
		FROM incident_timeline WHERE incident_id = $1 ORDER BY created_at ASC LIMIT $2 OFFSET $3`
	var events []models.TimelineEvent
	err := r.DB().SelectContext(ctx, &events, query, incidentID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to find timeline events: %w", err)
	}
	return events, nil
}

func (r *TimelineEventRepository) FindByIncidentAndType(ctx context.Context, incidentID, eventType string) ([]models.TimelineEvent, error) {
	query := `SELECT id, incident_id, tenant_id, event_type, actor_id, content, metadata, created_at
		FROM incident_timeline WHERE incident_id = $1 AND event_type = $2 ORDER BY created_at ASC`
	var events []models.TimelineEvent
	err := r.DB().SelectContext(ctx, &events, query, incidentID, eventType)
	if err != nil {
		return nil, fmt.Errorf("failed to find timeline events by type: %w", err)
	}
	return events, nil
}

func (r *TimelineEventRepository) FindByTenant(ctx context.Context, tenantID string, eventType *string, since *sql.NullTime, limit, offset int) ([]models.TimelineEvent, error) {
	query := `SELECT id, incident_id, tenant_id, event_type, actor_id, content, metadata, created_at
		FROM incident_timeline WHERE tenant_id = $1`
	args := []interface{}{tenantID}
	argIdx := 2

	if eventType != nil {
		query += fmt.Sprintf(" AND event_type = $%d", argIdx)
		args = append(args, *eventType)
		argIdx++
	}
	if since != nil && since.Valid {
		query += fmt.Sprintf(" AND created_at >= $%d", argIdx)
		args = append(args, since.Time)
		argIdx++
	}

	query += fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
	args = append(args, limit, offset)

	var events []models.TimelineEvent
	err := r.DB().SelectContext(ctx, &events, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to find timeline events by tenant: %w", err)
	}
	return events, nil
}

func (r *TimelineEventRepository) CountByIncident(ctx context.Context, incidentID string) (int, error) {
	var count int
	err := r.DB().GetContext(ctx, &count,
		"SELECT COUNT(*) FROM incident_timeline WHERE incident_id = $1", incidentID)
	if err != nil {
		return 0, fmt.Errorf("failed to count timeline events: %w", err)
	}
	return count, nil
}

// PostmortemRepository provides data access for incident postmortem records.
type PostmortemRepository struct {
	database.BaseRepository
}

func NewPostmortemRepository(db *database.DB) *PostmortemRepository {
	return &PostmortemRepository{
		BaseRepository: database.NewBaseRepository(db),
	}
}

func (r *PostmortemRepository) Create(ctx context.Context, record *models.PostmortemRecord) error {
	query := `INSERT INTO incident_postmortems (
		id, incident_id, tenant_id, title, summary, root_cause,
		contributing_factors, impact_description, timeline, timeline_summary,
		action_items, lessons_learned, status, created_by, created_at, updated_at
	) VALUES (
		$1, $2, $3, $4, $5, $6,
		$7, $8, $9, $10,
		$11, $12, $13, $14, $15, $16
	) RETURNING id, created_at, updated_at`
	err := r.DB().QueryRowContext(ctx, query,
		record.ID, record.IncidentID, record.TenantID, record.Title,
		record.Summary, record.RootCause, record.ContributingFactors,
		record.ImpactDescription, record.Timeline, record.TimelineSummary,
		record.ActionItems, record.LessonsLearned, record.Status,
		record.CreatedBy, record.CreatedAt, record.UpdatedAt,
	).Scan(&record.ID, &record.CreatedAt, &record.UpdatedAt)
	return err
}

func (r *PostmortemRepository) FindByIncident(ctx context.Context, incidentID string) (*models.PostmortemRecord, error) {
	var record models.PostmortemRecord
	query := `SELECT * FROM incident_postmortems WHERE incident_id = $1`
	err := r.DB().GetContext(ctx, &record, query, incidentID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to find postmortem: %w", err)
	}
	return &record, nil
}

func (r *PostmortemRepository) GetByID(ctx context.Context, id string) (*models.PostmortemRecord, error) {
	var record models.PostmortemRecord
	query := `SELECT * FROM incident_postmortems WHERE id = $1`
	err := r.DB().GetContext(ctx, &record, query, id)
	if err != nil {
		return nil, fmt.Errorf("postmortem not found: %w", err)
	}
	return &record, nil
}

func (r *PostmortemRepository) Update(ctx context.Context, record *models.PostmortemRecord) error {
	query := `UPDATE incident_postmortems SET
		title = $1, summary = $2, root_cause = $3,
		contributing_factors = $4, impact_description = $5,
		timeline = $6, timeline_summary = $7,
		action_items = $8, lessons_learned = $9, updated_at = $10
		WHERE id = $11`
	_, err := r.DB().ExecContext(ctx, query,
		record.Title, record.Summary, record.RootCause,
		record.ContributingFactors, record.ImpactDescription,
		record.Timeline, record.TimelineSummary,
		record.ActionItems, record.LessonsLearned, record.UpdatedAt,
		record.ID,
	)
	return err
}

func (r *PostmortemRepository) Publish(ctx context.Context, id, reviewedBy *string) error {
	_, err := r.DB().ExecContext(ctx,
		"UPDATE incident_postmortems SET status = 'published', published_at = now(), reviewed_by = $1, updated_at = now() WHERE id = $2 AND status = 'draft'",
		reviewedBy, id,
	)
	return err
}

func (r *PostmortemRepository) Archive(ctx context.Context, id string) error {
	_, err := r.DB().ExecContext(ctx,
		"UPDATE incident_postmortems SET status = 'archived', updated_at = now() WHERE id = $1 AND status = 'published'",
		id,
	)
	return err
}

func (r *PostmortemRepository) FindByTenant(ctx context.Context, tenantID string, status *string, limit, offset int) ([]models.PostmortemRecord, int, error) {
	query := `SELECT * FROM incident_postmortems WHERE tenant_id = $1`
	countQuery := `SELECT COUNT(*) FROM incident_postmortems WHERE tenant_id = $1`
	args := []interface{}{tenantID}
	argIdx := 2

	if status != nil {
		query += fmt.Sprintf(" AND status = $%d", argIdx)
		countQuery += fmt.Sprintf(" AND status = $%d", argIdx)
		args = append(args, *status)
		argIdx++
	}

	var total int
	if err := r.DB().GetContext(ctx, &total, countQuery, args[:argIdx-1]...); err != nil {
		return nil, 0, fmt.Errorf("failed to count postmortems: %w", err)
	}

	query += fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
	args = append(args, limit, offset)

	var records []models.PostmortemRecord
	if err := r.DB().SelectContext(ctx, &records, query, args...); err != nil {
		return nil, 0, fmt.Errorf("failed to list postmortems: %w", err)
	}

	return records, total, nil
}

// EscalationRepository provides data access for incident escalation records.
type EscalationRepository struct {
	database.BaseRepository
}

func NewEscalationRepository(db *database.DB) *EscalationRepository {
	return &EscalationRepository{
		BaseRepository: database.NewBaseRepository(db),
	}
}

func (r *EscalationRepository) Create(ctx context.Context, record *models.EscalationRecord) error {
	query := `INSERT INTO incident_escalations (id, incident_id, tenant_id, from_level, to_level, reason, escalated_by, escalated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, escalated_at`
	err := r.DB().QueryRowContext(ctx, query,
		record.ID, record.IncidentID, record.TenantID,
		record.FromLevel, record.ToLevel, record.Reason,
		record.EscalatedBy, record.EscalatedAt,
	).Scan(&record.ID, &record.EscalatedAt)
	return err
}

func (r *EscalationRepository) FindByIncident(ctx context.Context, incidentID, tenantID string) ([]models.EscalationRecord, error) {
	query := `SELECT * FROM incident_escalations WHERE incident_id = $1 AND tenant_id = $2 ORDER BY escalated_at ASC`
	var records []models.EscalationRecord
	err := r.DB().SelectContext(ctx, &records, query, incidentID, tenantID)
	if err != nil {
		return nil, fmt.Errorf("failed to find escalations: %w", err)
	}
	return records, nil
}
