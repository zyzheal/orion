package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/change/models"

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

// --- Change Request CRUD ---

func (r *Repository) CreateChangeRequest(ctx context.Context, m *models.ChangeRequest) error {
	m.ID = uuid.New().String()
	if m.CreatedAt.IsZero() {
		m.CreatedAt = time.Now().UTC()
	}
	if m.UpdatedAt.IsZero() {
		m.UpdatedAt = m.CreatedAt
	}
	if m.Status == "" {
		m.Status = "draft"
	}
	query := `INSERT INTO change_requests (id, tenant_id, title, description, status, change_type, priority, risk_level, assigned_to, requester_id, created_by, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`
	_, err := r.db.NamedExecContext(ctx, query, m)
	return err
}

func (r *Repository) GetChangeRequest(ctx context.Context, tenantID, id string) (*models.ChangeRequest, error) {
	var m models.ChangeRequest
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM change_requests WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *Repository) ListChangeRequests(ctx context.Context, tenantID string, q models.ChangeRequestListQuery) (*models.ListResult[models.ChangeRequest], error) {
	if q.Limit <= 0 {
		q.Limit = 20
	}
	if q.Offset < 0 {
		q.Offset = 0
	}

	conditions := []string{"tenant_id=$1"}
	args := []interface{}{tenantID}
	argCount := 2

	for _, pair := range []struct {
		col string
		val *string
	}{
		{"status", q.Status},
		{"change_type", q.Type},
		{"priority", q.Priority},
		{"risk_level", q.RiskLevel},
		{"assigned_to", q.AssignedTo},
		{"requester_id", q.RequesterID},
	} {
		if pair.val != nil && *pair.val != "" {
			conditions = append(conditions, fmt.Sprintf("%s=$%d", pair.col, argCount))
			args = append(args, *pair.val)
			argCount++
		}
	}

	// count query
	countArgs := append([]interface{}{tenantID}, args[1:]...)
	var total int
	countQuery := fmt.Sprintf(`SELECT COUNT(*) FROM change_requests WHERE %s`, conditionsStr(conditions))
	err := r.db.GetContext(ctx, &total, countQuery, countArgs...)
	if err != nil {
		return nil, err
	}

	// select query
	selectQuery := fmt.Sprintf(`SELECT * FROM change_requests WHERE %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`,
		conditionsStr(conditions), argCount, argCount+1)
	args = append(args, q.Limit, q.Offset)

	var items []models.ChangeRequest
	err = r.db.SelectContext(ctx, &items, selectQuery, args...)
	if err != nil {
		return nil, err
	}

	return &models.ListResult[models.ChangeRequest]{Data: items, Total: total}, nil
}

func (r *Repository) UpdateChangeRequest(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.ChangeRequest, error) {
	updates["updated_at"] = time.Now().UTC()
	_, err := r.db.ExecContext(ctx,
		`UPDATE change_requests SET updated_at = NOW() WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return r.GetChangeRequest(ctx, tenantID, id)
}

func (r *Repository) DeleteChangeRequest(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM change_requests WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// UpdateStatus updates the status of a change request.
func (r *Repository) UpdateStatus(ctx context.Context, tenantID, id, status, reason string) (*models.ChangeRequest, error) {
	_, err := r.db.ExecContext(ctx,
		`UPDATE change_requests SET status=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3`, status, id, tenantID)
	if err != nil {
		return nil, err
	}
	return r.GetChangeRequest(ctx, tenantID, id)
}

// --- Timeline ---

func (r *Repository) CreateTimelineEvent(ctx context.Context, event *models.TimelineEvent) error {
	event.ID = uuid.New().String()
	var metadata json.RawMessage
	if event.Metadata != nil {
		b, _ := json.Marshal(event.Metadata)
		metadata = b
	}
	event.CreatedAt = time.Now().UTC()
	query := `INSERT INTO change_timeline_events (id, change_request_id, tenant_id, event_type, description, metadata, created_by, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`
	_, err := r.db.ExecContext(ctx, query,
		event.ID, event.ChangeRequestID, event.TenantID, event.EventType, event.Description, metadata, event.CreatedBy, event.CreatedAt)
	return err
}

func (r *Repository) ListTimelineEvents(ctx context.Context, tenantID, changeRequestID string, limit, offset int) ([]models.TimelineEvent, error) {
	if limit <= 0 {
		limit = 50
	}
	var items []models.TimelineEvent
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM change_timeline_events WHERE change_request_id=$1 AND tenant_id=$2 ORDER BY created_at DESC LIMIT $3 OFFSET $4`,
		changeRequestID, tenantID, limit, offset)
	if err != nil {
		return nil, err
	}
	return items, nil
}

// --- Statistics ---

func (r *Repository) GetStats(ctx context.Context, tenantID string) (*models.ChangeStats, error) {
	var total, open, approved, rejected, inProgress, completed int

	err := r.db.GetContext(ctx, &total,
		`SELECT COUNT(*) FROM change_requests WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return nil, err
	}
	err = r.db.GetContext(ctx, &open,
		`SELECT COUNT(*) FROM change_requests WHERE tenant_id=$1 AND status NOT IN ('completed','cancelled','rejected')`, tenantID)
	if err != nil {
		return nil, err
	}
	err = r.db.GetContext(ctx, &approved,
		`SELECT COUNT(*) FROM change_requests WHERE tenant_id=$1 AND status=$2`, tenantID, "approved")
	if err != nil {
		return nil, err
	}
	err = r.db.GetContext(ctx, &rejected,
		`SELECT COUNT(*) FROM change_requests WHERE tenant_id=$1 AND status=$2`, tenantID, "rejected")
	if err != nil {
		return nil, err
	}
	err = r.db.GetContext(ctx, &inProgress,
		`SELECT COUNT(*) FROM change_requests WHERE tenant_id=$1 AND status=$2`, tenantID, "in_progress")
	if err != nil {
		return nil, err
	}
	err = r.db.GetContext(ctx, &completed,
		`SELECT COUNT(*) FROM change_requests WHERE tenant_id=$1 AND status=$2`, tenantID, "completed")
	if err != nil {
		return nil, err
	}

	stats := &models.ChangeStats{
		Total:      total,
		Open:       open,
		Approved:   approved,
		Rejected:   rejected,
		InProgress: inProgress,
		Completed:  completed,
	}
	return stats, nil
}

// --- RFC ---

func (r *Repository) CreateRFC(ctx context.Context, tenantID string, rfc *models.RFC) error {
	rfc.ID = uuid.New().String()
	now := time.Now().UTC()
	rfc.CreatedAt = now
	rfc.UpdatedAt = now
	if rfc.Status == "" {
		rfc.Status = "draft"
	}
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO change_rfcs (id, tenant_id, change_request_id, rfc_number, title, description, status, created_by, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
		rfc.ID, tenantID, rfc.ChangeRequestID, rfc.RFCNumber, rfc.Title, rfc.Description, rfc.Status, rfc.CreatedBy, rfc.CreatedAt, rfc.UpdatedAt)
	return err
}

func (r *Repository) GetRFC(ctx context.Context, tenantID, id string) (*models.RFC, error) {
	var m models.RFC
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM change_rfcs WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *Repository) ListRFCs(ctx context.Context, tenantID string, limit, offset int) (*models.ListResult[models.RFC], error) {
	if limit <= 0 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}
	var total int
	err := r.db.GetContext(ctx, &total,
		`SELECT COUNT(*) FROM change_rfcs WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return nil, err
	}
	var items []models.RFC
	err = r.db.SelectContext(ctx, &items,
		`SELECT * FROM change_rfcs WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, tenantID, limit, offset)
	if err != nil {
		return nil, err
	}
	return &models.ListResult[models.RFC]{Data: items, Total: total}, nil
}

func (r *Repository) UpdateRFC(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.RFC, error) {
	_, err := r.db.ExecContext(ctx,
		`UPDATE change_rfcs SET updated_at=NOW() WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return r.GetRFC(ctx, tenantID, id)
}

// --- CAB Meeting ---

func (r *Repository) CreateCABMeeting(ctx context.Context, tenantID string, meeting *models.CABMeeting) error {
	meeting.ID = uuid.New().String()
	now := time.Now().UTC()
	meeting.CreatedAt = now
	meeting.UpdatedAt = now
	if meeting.Status == "" {
		meeting.Status = "scheduled"
	}
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO cab_meetings (id, tenant_id, title, description, status, scheduled_at, created_by, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		meeting.ID, tenantID, meeting.Title, meeting.Description, meeting.Status, meeting.ScheduledAt, meeting.CreatedBy, meeting.CreatedAt, meeting.UpdatedAt)
	return err
}

func (r *Repository) GetCABMeeting(ctx context.Context, tenantID, id string) (*models.CABMeeting, error) {
	var m models.CABMeeting
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM cab_meetings WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *Repository) ListCABMeetings(ctx context.Context, tenantID string, q models.CABMeetingListQuery) (*models.ListResult[models.CABMeeting], error) {
	if q.Limit <= 0 {
		q.Limit = 20
	}
	if q.Offset < 0 {
		q.Offset = 0
	}

	var conditions []string
	var args []interface{}

	conditions = append(conditions, "tenant_id=$1")
	args = append(args, tenantID)
	argCount := 2

	if q.Status != nil && *q.Status != "" {
		conditions = append(conditions, fmt.Sprintf("status=$%d", argCount))
		args = append(args, *q.Status)
		argCount++
	}

	whereClause := conditionsStr(conditions)

	var total int
	err := r.db.GetContext(ctx, &total,
		fmt.Sprintf(`SELECT COUNT(*) FROM cab_meetings WHERE %s`, whereClause), args...)
	if err != nil {
		return nil, err
	}

	var items []models.CABMeeting
	err = r.db.SelectContext(ctx, &items,
		fmt.Sprintf(`SELECT * FROM cab_meetings WHERE %s ORDER BY scheduled_at DESC LIMIT $%d OFFSET $%d`,
			whereClause, argCount, argCount+1),
		append(args, q.Limit, q.Offset)...,
	)
	if err != nil {
		return nil, err
	}
	return &models.ListResult[models.CABMeeting]{Data: items, Total: total}, nil
}

func (r *Repository) UpdateCABMeeting(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.CABMeeting, error) {
	_, err := r.db.ExecContext(ctx,
		`UPDATE cab_meetings SET updated_at=NOW() WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return r.GetCABMeeting(ctx, tenantID, id)
}

// --- CAB Decisions ---

func (r *Repository) AddCABDecision(ctx context.Context, tenantID, cabID, changeRequestID, decision, notes string) (*models.CABDecision, error) {
	id := uuid.New().String()
	now := time.Now().UTC()
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO cab_decisions (id, tenant_id, cab_meeting_id, change_request_id, decision, notes, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		id, tenantID, cabID, changeRequestID, decision, notes, now)
	if err != nil {
		return nil, err
	}
	return &models.CABDecision{
		ID:              id,
		TenantID:        tenantID,
		CABMeetingID:    cabID,
		ChangeRequestID: changeRequestID,
		Decision:        decision,
		Notes:           notes,
		CreatedAt:       now,
	}, nil
}

// --- Errors ---

var (
	ErrRFCNotFound   = errors.New("rfc not found")
	ErrCABNotFound   = errors.New("cab meeting not found")
	ErrInvalidStatus = errors.New("invalid status")
)

func IsNotFound(err error) bool {
	return errors.Is(err, sentinel.NotFound) || errors.Is(err, sql.ErrNoRows)
}

// --- Helpers ---

func conditionsStr(conditions []string) string {
	result := conditions[0]
	for _, c := range conditions[1:] {
		result += " AND " + c
	}
	return result
}
