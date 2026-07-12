package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/incident/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

var (
	ErrNotFound = errors.New("not found")
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// --- Incident CRUD ---

func (r *Repository) Create(ctx context.Context, tenantID string, m *models.Incident) error {
	m.ID = uuid.New().String()
	m.TenantID = tenantID
	m.CreatedAt = time.Now().UTC()
	m.UpdatedAt = time.Now().UTC()
	if m.Status == "" {
		m.Status = "open"
	}
	if m.EscalationLevel == 0 {
		m.EscalationLevel = 0
	}
	query := `INSERT INTO incidents (
		id, tenant_id, title, description, type, severity, priority, status,
		impact, urgency, commander_id, assigned_team, affected_services,
		escalation_level, environment, service, detected_by, error_message,
		tags, resolved_by, closed_at, closed_by, related_problem_id,
		linked_problem_id, linked_change_id, sla_breach, sla_breach_at,
		postmortem_required, created_at, updated_at
	) VALUES (
		:id, :tenant_id, :title, :description, :type, :severity, :priority, :status,
		:impact, :urgency, :commander_id, :assigned_team, :affected_services,
		:escalation_level, :environment, :service, :detected_by, :error_message,
		:tags, :resolved_by, :closed_at, :closed_by, :related_problem_id,
		:linked_problem_id, :linked_change_id, :sla_breach, :sla_breach_at,
		:postmortem_required, :created_at, :updated_at
	)`
	_, err := r.db.NamedExecContext(ctx, query, m)
	return err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.Incident, error) {
	var m models.Incident
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM incidents WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *Repository) List(ctx context.Context, tenantID string, q models.IncidentListQuery) (*models.IncidentListResult, error) {
	if q.Limit <= 0 {
		q.Limit = 20
	}
	if q.Offset < 0 {
		q.Offset = 0
	}

	var where []string
	var args []interface{}
	paramIdx := 1

	where = append(where, fmt.Sprintf("tenant_id=$%d", paramIdx))
	args = append(args, tenantID)
	paramIdx++

	if q.Status != "" {
		where = append(where, fmt.Sprintf("status=$%d", paramIdx))
		args = append(args, q.Status)
		paramIdx++
	}
	if q.Severity != "" {
		where = append(where, fmt.Sprintf("severity=$%d", paramIdx))
		args = append(args, q.Severity)
		paramIdx++
	}
	if q.Priority != "" {
		where = append(where, fmt.Sprintf("priority=$%d", paramIdx))
		args = append(args, q.Priority)
		paramIdx++
	}

	whereClause := strings.Join(where, " AND ")

	// Count total
	var total int
	err := r.db.GetContext(ctx, &total,
		fmt.Sprintf(`SELECT COUNT(*) FROM incidents WHERE %s`, whereClause), args...)
	if err != nil {
		return nil, err
	}

	// Fetch rows
	var items []models.Incident
	argsLimit := append(args, q.Limit, q.Offset)
	err = r.db.SelectContext(ctx, &items,
		fmt.Sprintf(`SELECT * FROM incidents WHERE %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`, whereClause, paramIdx, paramIdx+1), argsLimit...)
	if err != nil {
		return nil, err
	}

	return &models.IncidentListResult{Incidents: items, Total: total}, nil
}

func (r *Repository) Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	updates["updated_at"] = time.Now().UTC()

	// Build dynamic update
	if len(updates) == 0 {
		return nil
	}

	var fields []string
	var args []interface{}
	paramIdx := 1

	for k, v := range updates {
		fields = append(fields, fmt.Sprintf("%s=$%d", k, paramIdx))
		args = append(args, v)
		paramIdx++
	}

	args = append(args, id, tenantID)
	fieldClause := strings.Join(fields, ", ")
	_, err := r.db.ExecContext(ctx,
		fmt.Sprintf(`UPDATE incidents SET %s WHERE id=$%d AND tenant_id=$%d`, fieldClause, paramIdx, paramIdx+1), args...)
	return err
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM incidents WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return err
	}
	_, _ = result.RowsAffected()
	return nil
}

func (r *Repository) Exists(ctx context.Context, tenantID, id string) (bool, error) {
	var exists bool
	err := r.db.GetContext(ctx, &exists,
		`SELECT EXISTS(SELECT 1 FROM incidents WHERE id=$1 AND tenant_id=$2)`, id, tenantID)
	return exists, err
}

// --- Status update ---

func (r *Repository) UpdateStatus(ctx context.Context, tenantID, id, newStatus, actorID, reason string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE incidents SET status=$1, updated_at=$2 WHERE id=$3 AND tenant_id=$4`, newStatus, time.Now().UTC(), id, tenantID)
	return err
}

// --- Assignment ---

func (r *Repository) AssignCommander(ctx context.Context, tenantID, id, commanderID string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE incidents SET commander_id=$1, updated_at=$2 WHERE id=$3 AND tenant_id=$4`, commanderID, time.Now().UTC(), id, tenantID)
	return err
}

// --- Escalation ---

func (r *Repository) Escalate(ctx context.Context, tenantID, incidentID string, fromLevel, toLevel int, reason, escalatedBy string) error {
	// Insert escalation record
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO incident_escalations (id, incident_id, tenant_id, from_level, to_level, reason, escalated_by, created_at)
		VALUES (:id, :incident_id, :tenant_id, :from_level, :to_level, :reason, :escalated_by, :created_at)`,
		map[string]interface{}{
			"id":            uuid.New().String(),
			"incident_id":   incidentID,
			"tenant_id":     tenantID,
			"from_level":    fromLevel,
			"to_level":      toLevel,
			"reason":        reason,
			"escalated_by":  escalatedBy,
			"created_at":    time.Now().UTC(),
		})
	if err != nil {
		return err
	}

	// Update incident escalation level
	_, err = r.db.ExecContext(ctx,
		`UPDATE incidents SET escalation_level=$1, updated_at=$2 WHERE id=$3 AND tenant_id=$4`, toLevel, time.Now().UTC(), incidentID, tenantID)
	return err
}

func (r *Repository) GetEscalations(ctx context.Context, tenantID, incidentID string) ([]models.EscalationRecord, error) {
	var items []models.EscalationRecord
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM incident_escalations WHERE incident_id=$1 AND tenant_id=$2 ORDER BY created_at DESC`, incidentID, tenantID)
	return items, err
}

// --- Timeline ---

func (r *Repository) AddTimelineEvent(ctx context.Context, tenantID, incidentID string, req models.AddTimelineEventRequest, metadataJSON string) error {
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO incident_timeline (id, incident_id, tenant_id, event_type, actor_id, content, metadata, created_at)
		VALUES (:id, :incident_id, :tenant_id, :event_type, :actor_id, :content, :metadata, :created_at)`,
		map[string]interface{}{
			"id":          uuid.New().String(),
			"incident_id": incidentID,
			"tenant_id":   tenantID,
			"event_type":  req.EventType,
			"actor_id":    req.ActorID,
			"content":     req.Content,
			"metadata":    metadataJSON,
			"created_at":  time.Now().UTC(),
		})
	return err
}

func (r *Repository) GetTimeline(ctx context.Context, tenantID, incidentID string, q models.TimelineQuery) ([]models.TimelineEvent, error) {
	var items []models.TimelineEvent
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM incident_timeline WHERE incident_id=$1 AND tenant_id=$2 ORDER BY created_at DESC LIMIT $3 OFFSET $4`,
		incidentID, tenantID, 20, 0)
	return items, err
}

// --- Postmortem ---

func (r *Repository) CreatePostmortem(ctx context.Context, tenantID, incidentID string, pm *models.PostmortemRecord) error {
	pm.ID = uuid.New().String()
	pm.TenantID = tenantID
	pm.IncidentID = incidentID
	pm.Status = "draft"
	pm.CreatedAt = time.Now().UTC()
	pm.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO incident_postmortems (id, incident_id, tenant_id, title, summary, root_cause, contributing_factors, impact_description, timeline_summary, action_items, lessons_learned, status, created_by, reviewed_by, published_at, created_at, updated_at)
		VALUES (:id, :incident_id, :tenant_id, :title, :summary, :root_cause, :contributing_factors, :impact_description, :timeline_summary, :action_items, :lessons_learned, :status, :created_by, :reviewed_by, :published_at, :created_at, :updated_at)`, pm)
	return err
}

func (r *Repository) GetPostmortem(ctx context.Context, tenantID, incidentID string) (*models.PostmortemRecord, error) {
	var pm models.PostmortemRecord
	err := r.db.GetContext(ctx, &pm,
		`SELECT * FROM incident_postmortems WHERE incident_id=$1 AND tenant_id=$2`, incidentID, tenantID)
	if err != nil {
		return nil, err
	}
	return &pm, nil
}

func (r *Repository) PostmortemExists(ctx context.Context, tenantID, incidentID string) (bool, error) {
	var exists bool
	err := r.db.GetContext(ctx, &exists,
		`SELECT EXISTS(SELECT 1 FROM incident_postmortems WHERE incident_id=$1 AND tenant_id=$2)`, incidentID, tenantID)
	return exists, err
}

func (r *Repository) UpdatePostmortem(ctx context.Context, tenantID, incidentID string, updates map[string]interface{}) (*models.PostmortemRecord, error) {
	updates["updated_at"] = time.Now().UTC()

	var fields []string
	var args []interface{}
	paramIdx := 1

	for k, v := range updates {
		fields = append(fields, fmt.Sprintf("%s=$%d", k, paramIdx))
		args = append(args, v)
		paramIdx++
	}

	if len(fields) == 0 {
		return nil, nil
	}

	args = append(args, incidentID, tenantID)
	fieldClause := strings.Join(fields, ", ")
	_, err := r.db.ExecContext(ctx,
		fmt.Sprintf(`UPDATE incident_postmortems SET %s WHERE incident_id=$%d AND tenant_id=$%d`, fieldClause, paramIdx, paramIdx+1), args...)
	if err != nil {
		return nil, err
	}

	return r.GetPostmortem(ctx, tenantID, incidentID)
}

func (r *Repository) PublishPostmortem(ctx context.Context, tenantID, incidentID string, reviewedBy *string) (*models.PostmortemRecord, error) {
	now := time.Now().UTC()
	if reviewedBy != nil && *reviewedBy != "" {
		_, err := r.db.ExecContext(ctx,
			`UPDATE incident_postmortems SET status='published', reviewed_by=$1, published_at=$2, updated_at=$3 WHERE incident_id=$4 AND tenant_id=$5 AND status='draft'`,
			*reviewedBy, now, now, incidentID, tenantID)
		if err != nil {
			return nil, err
		}
	} else {
		_, err := r.db.ExecContext(ctx,
			`UPDATE incident_postmortems SET status='published', published_at=$1, updated_at=$2 WHERE incident_id=$3 AND tenant_id=$4 AND status='draft'`,
			now, now, incidentID, tenantID)
		if err != nil {
			return nil, err
		}
	}
	return r.GetPostmortem(ctx, tenantID, incidentID)
}

func (r *Repository) ArchivePostmortem(ctx context.Context, tenantID, incidentID string) (*models.PostmortemRecord, error) {
	now := time.Now().UTC()
	_, err := r.db.ExecContext(ctx,
		`UPDATE incident_postmortems SET status='archived', updated_at=$1 WHERE incident_id=$2 AND tenant_id=$3 AND status='published'`,
		now, incidentID, tenantID)
	if err != nil {
		return nil, err
	}
	return r.GetPostmortem(ctx, tenantID, incidentID)
}

// --- SLA ---

func (r *Repository) CheckSlaBreach(ctx context.Context, tenantID, incidentID string) (*models.SlaCheckResult, error) {
	var sla models.SlaCheckResult
	err := r.db.GetContext(ctx, &sla,
		`SELECT id FROM incidents WHERE id=$1 AND tenant_id=$2`, incidentID, tenantID)
	if err != nil {
		return nil, err
	}

	// Compute approximate SLA based on severity
	// Return a dummy result; real implementation would compute from SLA policy table
	return &models.SlaCheckResult{
		IncidentID: incidentID,
		Status:     "open",
		Breached:   false,
	}, nil
}

func (r *Repository) MarkSlaBreach(ctx context.Context, tenantID, incidentID string) error {
	now := time.Now().UTC()
	_, err := r.db.ExecContext(ctx,
		`UPDATE incidents SET sla_breach=true, sla_breach_at=$1, updated_at=$2 WHERE id=$3 AND tenant_id=$4`,
		now, now, incidentID, tenantID)
	return err
}

// --- Statistics ---

func (r *Repository) GetStats(ctx context.Context, tenantID string) (*models.IncidentStats, error) {
	stats := &models.IncidentStats{
		ByStatus:   make(map[string]int),
		BySeverity: make(map[string]int),
		ByPriority: make(map[string]int),
	}

	var total int
	err := r.db.GetContext(ctx, &total,
		`SELECT COUNT(*) FROM incidents WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return nil, err
	}
	stats.Total = total

	var byStatus []struct {
		Status string `db:"status"`
		Count  int    `db:"count"`
	}
	r.db.SelectContext(ctx, &byStatus,
		`SELECT status, COUNT(*) as count FROM incidents WHERE tenant_id=$1 GROUP BY status`, tenantID)
	for _, row := range byStatus {
		stats.ByStatus[row.Status] = row.Count
	}

	var bySev []struct {
		Severity string `db:"severity"`
		Count    int    `db:"count"`
	}
	r.db.SelectContext(ctx, &bySev,
		`SELECT severity, COUNT(*) as count FROM incidents WHERE tenant_id=$1 GROUP BY severity`, tenantID)
	for _, row := range bySev {
		stats.BySeverity[row.Severity] = row.Count
	}

	var byPri []struct {
		Priority string `db:"priority"`
		Count    int    `db:"count"`
	}
	r.db.SelectContext(ctx, &byPri,
		`SELECT priority, COUNT(*) as count FROM incidents WHERE tenant_id=$1 GROUP BY priority`, tenantID)
	for _, row := range byPri {
		stats.ByPriority[row.Priority] = row.Count
	}

	var slaBreachCount int
	r.db.GetContext(ctx, &slaBreachCount,
		`SELECT COUNT(*) FROM incidents WHERE tenant_id=$1 AND sla_breach=true`, tenantID)
	stats.SlaBreachCount = slaBreachCount

	var escCount int
	r.db.GetContext(ctx, &escCount,
		`SELECT COUNT(*) FROM incident_escalations WHERE tenant_id=$1`, tenantID)
	stats.EscalationCount = escCount

	return stats, nil
}

// --- Knowledge recommendations ---

func (r *Repository) GetKnowledgeRecommendations(ctx context.Context, tenantID, incidentID string, limit int) ([]models.KnowledgeRecommendation, error) {
	// Placeholder: return empty recommendations (knowledge service integration)
	return []models.KnowledgeRecommendation{}, nil
}
