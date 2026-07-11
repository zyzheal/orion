package repository

import (
	"context"
	"fmt"
	"strings"

	"github.com/jmoiron/sqlx"

	"orion/incident-svc-go/internal/change/models"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// ==================== Change Requests ====================

func (r *Repository) CreateChangeRequest(ctx context.Context, d *models.ChangeRequest) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO change_requests (id, tenant_id, title, description, type, priority, risk_level, status, assigned_to, requester_id, created_by)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
		d.ID, d.TenantID, d.Title, d.Description, d.Type, d.Priority, d.RiskLevel, d.Status, d.AssignedTo, d.RequesterID, d.CreatedBy)
	return err
}

func (r *Repository) ListChangeRequests(ctx context.Context, tenantID string, offset, limit int, filters map[string]string) ([]models.ChangeRequest, error) {
	conditions := []string{"tenant_id=$1"}
	args := []interface{}{tenantID}
	idx := 2

	for _, field := range []string{"status", "type", "priority", "risk_level", "assigned_to", "requester_id"} {
		if v, ok := filters[field]; ok && v != "" {
			conditions = append(conditions, fmt.Sprintf("%s=$%d", field, idx))
			args = append(args, v)
			idx++
		}
	}

	where := strings.Join(conditions, " AND ")
	args = append(args, offset, limit)
	query := fmt.Sprintf(`SELECT * FROM change_requests WHERE %s ORDER BY created_at DESC OFFSET $%d LIMIT $%d`, where, idx, idx+1)

	var items []models.ChangeRequest
	err := r.db.SelectContext(ctx, &items, query, args...)
	return items, err
}

func (r *Repository) GetChangeRequest(ctx context.Context, tenantID, id string) (*models.ChangeRequest, error) {
	var d models.ChangeRequest
	err := r.db.GetContext(ctx, &d, `SELECT * FROM change_requests WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

func (r *Repository) UpdateChangeRequest(ctx context.Context, tenantID, id string, req *models.UpdateChangeRequestRequest) (*models.ChangeRequest, error) {
	setClauses := []string{}
	args := []interface{}{}
	idx := 1

	if req.Title != nil { setClauses = append(setClauses, fmt.Sprintf("title=$%d", idx)); args = append(args, *req.Title); idx++ }
	if req.Description != nil { setClauses = append(setClauses, fmt.Sprintf("description=$%d", idx)); args = append(args, *req.Description); idx++ }
	if req.Type != nil { setClauses = append(setClauses, fmt.Sprintf("type=$%d", idx)); args = append(args, *req.Type); idx++ }
	if req.Priority != nil { setClauses = append(setClauses, fmt.Sprintf("priority=$%d", idx)); args = append(args, *req.Priority); idx++ }
	if req.RiskLevel != nil { setClauses = append(setClauses, fmt.Sprintf("risk_level=$%d", idx)); args = append(args, *req.RiskLevel); idx++ }
	if req.Status != nil { setClauses = append(setClauses, fmt.Sprintf("status=$%d", idx)); args = append(args, *req.Status); idx++ }
	if req.AssignedTo != nil { setClauses = append(setClauses, fmt.Sprintf("assigned_to=$%d", idx)); args = append(args, *req.AssignedTo); idx++ }

	if len(setClauses) == 0 {
		return r.GetChangeRequest(ctx, tenantID, id)
	}

	setClauses = append(setClauses, "updated_at=NOW()")
	args = append(args, id, tenantID)

	query := fmt.Sprintf("UPDATE change_requests SET %s WHERE id=$%d AND tenant_id=$%d RETURNING *",
		strings.Join(setClauses, ", "), idx, idx+1)

	var d models.ChangeRequest
	err := r.db.GetContext(ctx, &d, query, args...)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

func (r *Repository) DeleteChangeRequest(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM change_requests WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

func (r *Repository) CountChangeRequests(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count, `SELECT COUNT(*) FROM change_requests WHERE tenant_id=$1`, tenantID)
	return count, err
}

// ==================== RFCs ====================

func (r *Repository) CreateRFC(ctx context.Context, d *models.RFC) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO change_rfcs (id, tenant_id, change_request_id, rfc_number, title, description, status, created_by)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
		d.ID, d.TenantID, d.ChangeRequestID, d.RFCNumber, d.Title, d.Description, d.Status, d.CreatedBy)
	return err
}

func (r *Repository) ListRFCs(ctx context.Context, tenantID string, offset, limit int) ([]models.RFC, error) {
	var items []models.RFC
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM change_rfcs WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3`,
		tenantID, offset, limit)
	return items, err
}

func (r *Repository) GetRFC(ctx context.Context, tenantID, id string) (*models.RFC, error) {
	var d models.RFC
	err := r.db.GetContext(ctx, &d, `SELECT * FROM change_rfcs WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

func (r *Repository) UpdateRFC(ctx context.Context, tenantID, id string, req *models.UpdateRFCRequest) (*models.RFC, error) {
	setClauses := []string{}
	args := []interface{}{}
	idx := 1

	if req.Title != nil { setClauses = append(setClauses, fmt.Sprintf("title=$%d", idx)); args = append(args, *req.Title); idx++ }
	if req.Description != nil { setClauses = append(setClauses, fmt.Sprintf("description=$%d", idx)); args = append(args, *req.Description); idx++ }
	if req.Status != nil { setClauses = append(setClauses, fmt.Sprintf("status=$%d", idx)); args = append(args, *req.Status); idx++ }

	if len(setClauses) == 0 {
		return r.GetRFC(ctx, tenantID, id)
	}

	setClauses = append(setClauses, "updated_at=NOW()")
	args = append(args, id, tenantID)

	query := fmt.Sprintf("UPDATE change_rfcs SET %s WHERE id=$%d AND tenant_id=$%d RETURNING *",
		strings.Join(setClauses, ", "), idx, idx+1)

	var d models.RFC
	err := r.db.GetContext(ctx, &d, query, args...)
	return &d, err
}

// ==================== CAB Meetings ====================

func (r *Repository) CreateCABMeeting(ctx context.Context, d *models.CABMeeting) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO change_cab_meetings (id, tenant_id, title, description, status, scheduled_at, created_by)
		 VALUES ($1,$2,$3,$4,$5,$6,$7)`,
		d.ID, d.TenantID, d.Title, d.Description, d.Status, d.ScheduledAt, d.CreatedBy)
	return err
}

func (r *Repository) ListCABMeetings(ctx context.Context, tenantID string, offset, limit int, status string) ([]models.CABMeeting, error) {
	var items []models.CABMeeting
	if status != "" {
		err := r.db.SelectContext(ctx, &items,
			`SELECT * FROM change_cab_meetings WHERE tenant_id=$1 AND status=$2 ORDER BY scheduled_at DESC OFFSET $3 LIMIT $4`,
			tenantID, status, offset, limit)
		return items, err
	}
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM change_cab_meetings WHERE tenant_id=$1 ORDER BY scheduled_at DESC OFFSET $2 LIMIT $3`,
		tenantID, offset, limit)
	return items, err
}

func (r *Repository) GetCABMeeting(ctx context.Context, tenantID, id string) (*models.CABMeeting, error) {
	var d models.CABMeeting
	err := r.db.GetContext(ctx, &d, `SELECT * FROM change_cab_meetings WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

func (r *Repository) UpdateCABMeeting(ctx context.Context, tenantID, id string, req *models.UpdateCABMeetingRequest) (*models.CABMeeting, error) {
	setClauses := []string{}
	args := []interface{}{}
	idx := 1

	if req.Title != nil { setClauses = append(setClauses, fmt.Sprintf("title=$%d", idx)); args = append(args, *req.Title); idx++ }
	if req.Description != nil { setClauses = append(setClauses, fmt.Sprintf("description=$%d", idx)); args = append(args, *req.Description); idx++ }
	if req.Status != nil { setClauses = append(setClauses, fmt.Sprintf("status=$%d", idx)); args = append(args, *req.Status); idx++ }
	if req.ScheduledAt != nil { setClauses = append(setClauses, fmt.Sprintf("scheduled_at=$%d", idx)); args = append(args, *req.ScheduledAt); idx++ }

	if len(setClauses) == 0 {
		return r.GetCABMeeting(ctx, tenantID, id)
	}

	setClauses = append(setClauses, "updated_at=NOW()")
	args = append(args, id, tenantID)

	query := fmt.Sprintf("UPDATE change_cab_meetings SET %s WHERE id=$%d AND tenant_id=$%d RETURNING *",
		strings.Join(setClauses, ", "), idx, idx+1)

	var d models.CABMeeting
	err := r.db.GetContext(ctx, &d, query, args...)
	return &d, err
}

func (r *Repository) DeleteCABMeeting(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM change_cab_meetings WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// ==================== CAB Decisions ====================

func (r *Repository) AddCABDecision(ctx context.Context, d *models.CABDecision) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO change_cab_decisions (id, cab_meeting_id, change_request_id, decision, notes)
		 VALUES ($1,$2,$3,$4,$5)`,
		d.ID, d.CABMeetingID, d.ChangeRequestID, d.Decision, d.Notes)
	return err
}

// ==================== Timeline Events ====================

func (r *Repository) CreateTimelineEvent(ctx context.Context, e *models.ChangeTimelineEvent) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO change_timeline_events (id, tenant_id, change_request_id, event_type, description, actor_id)
		 VALUES ($1,$2,$3,$4,$5,$6)`,
		e.ID, e.TenantID, e.ChangeRequestID, e.EventType, e.Description, e.ActorID)
	return err
}

func (r *Repository) ListTimelineEvents(ctx context.Context, tenantID, changeRequestID string, offset, limit int) ([]models.ChangeTimelineEvent, error) {
	var items []models.ChangeTimelineEvent
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM change_timeline_events WHERE tenant_id=$1 AND change_request_id=$2 ORDER BY created_at DESC OFFSET $3 LIMIT $4`,
		tenantID, changeRequestID, offset, limit)
	return items, err
}