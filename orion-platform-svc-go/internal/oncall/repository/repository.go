package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"orion/platform-svc-go/internal/oncall/models"
	"go.uber.org/zap"
)

type OnCallRepository struct {
	db     *sqlx.DB
	logger *zap.Logger
}

func NewOnCallRepository(db *sqlx.DB, logger *zap.Logger) *OnCallRepository {
	return &OnCallRepository{db: db, logger: logger}
}

// CreateSchedule creates a new on-call schedule.
func (r *OnCallRepository) CreateSchedule(ctx context.Context, tenantID uuid.UUID, req *models.CreateScheduleRequest) (*models.Schedule, error) {
	now := time.Now()
	isPrimary := false
	if req.IsPrimary != nil {
		isPrimary = *req.IsPrimary
	}
	id := uuid.New()

	query := `INSERT INTO oncall_schedules (id, tenant_id, name, description, is_primary, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7)`
	if _, err := r.db.ExecContext(ctx, query, id, tenantID, req.Name, req.Description, isPrimary, now, now); err != nil {
		return nil, fmt.Errorf("create schedule: %w", err)
	}

	schedule := &models.Schedule{
		ID:          id,
		TenantID:    tenantID,
		Name:        req.Name,
		Description: req.Description,
		IsPrimary:   isPrimary,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	return schedule, nil
}

// QuerySchedules returns paginated schedules.
func (r *OnCallRepository) QuerySchedules(ctx context.Context, tenantID uuid.UUID, limit, offset int) (models.ScheduleResponse, error) {
	var resp models.ScheduleResponse
	if limit <= 0 || limit > 100 {
		limit = 50
	}

	countQuery := `SELECT COUNT(*) FROM oncall_schedules WHERE tenant_id = $1`
	query := `SELECT id, tenant_id, name, description, is_primary, created_at, updated_at FROM oncall_schedules WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`

	var total int64
	if err := r.db.GetContext(ctx, &total, countQuery, tenantID); err != nil {
		return resp, fmt.Errorf("count schedules: %w", err)
	}
	resp.Total = total

	rows, err := r.db.QueryxContext(ctx, query, tenantID, limit, offset)
	if err != nil {
		return resp, fmt.Errorf("query schedules: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var s models.Schedule
		if err := rows.Scan(&s.ID, &s.TenantID, &s.Name, &s.Description, &s.IsPrimary, &s.CreatedAt, &s.UpdatedAt); err != nil {
			return resp, fmt.Errorf("scan schedule: %w", err)
		}
		resp.Data = append(resp.Data, s)
	}
	return resp, nil
}

// GetSchedule returns a schedule by ID.
func (r *OnCallRepository) GetSchedule(ctx context.Context, tenantID, id uuid.UUID) (*models.Schedule, error) {
	var s models.Schedule
	query := `SELECT id, tenant_id, name, description, is_primary, created_at, updated_at FROM oncall_schedules WHERE id = $1 AND tenant_id = $2`
	if err := r.db.GetContext(ctx, &s, query, id, tenantID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("schedule not found: %s", id)
		}
		return nil, fmt.Errorf("get schedule: %w", err)
	}
	return &s, nil
}

// AddRotation adds a rotation to a schedule.
func (r *OnCallRepository) AddRotation(ctx context.Context, scheduleID uuid.UUID, req *models.AddRotationRequest) (*models.Rotation, error) {
	now := time.Now()
	id := uuid.New()

	query := `INSERT INTO oncall_rotations (id, schedule_id, user_id, user_name, is_active, start_date, end_date, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`
	if _, err := r.db.ExecContext(ctx, query, id, scheduleID, req.UserID, req.UserName, true, req.StartDate, req.EndDate, now); err != nil {
		return nil, fmt.Errorf("add rotation: %w", err)
	}

	rotation := &models.Rotation{
		ID:         id,
		ScheduleID: scheduleID,
		UserID:     req.UserID,
		UserName:   req.UserName,
		IsActive:   true,
		StartDate:  req.StartDate,
		EndDate:    req.EndDate,
		CreatedAt:  now,
	}
	return rotation, nil
}

// GetCurrentOnCall returns the current on-call person for a schedule.
func (r *OnCallRepository) GetCurrentOnCall(ctx context.Context, scheduleID uuid.UUID) (*models.CurrentOnCallResponse, error) {
	var resp models.CurrentOnCallResponse
	query := `
		SELECT r.id, s.name, r.user_id, r.user_name, r.start_date, r.end_date, 1
		FROM oncall_rotations r
		JOIN oncall_schedules s ON r.schedule_id = s.id
		WHERE r.schedule_id = $1 AND r.is_active = true AND NOW() BETWEEN r.start_date AND r.end_date
		ORDER BY r.start_date DESC
		LIMIT 1`

	if err := r.db.GetContext(ctx, &resp, query, scheduleID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("no active on-call rotation found for schedule %s", scheduleID)
		}
		return nil, fmt.Errorf("get current on-call: %w", err)
	}
	return &resp, nil
}

// QueryRotations returns rotations for a schedule.
func (r *OnCallRepository) QueryRotations(ctx context.Context, scheduleID uuid.UUID, limit, offset int) ([]models.Rotation, int64, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}

	var total int64
	countQuery := `SELECT COUNT(*) FROM oncall_rotations WHERE schedule_id = $1`
	if err := r.db.GetContext(ctx, &total, countQuery, scheduleID); err != nil {
		return nil, 0, fmt.Errorf("count rotations: %w", err)
	}

	query := `SELECT id, schedule_id, user_id, user_name, is_active, start_date, end_date, created_at FROM oncall_rotations WHERE schedule_id = $1 ORDER BY start_date DESC LIMIT $2 OFFSET $3`
	rows, err := r.db.QueryxContext(ctx, query, scheduleID, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("query rotations: %w", err)
	}
	defer rows.Close()

	var rotations []models.Rotation
	for rows.Next() {
		var r models.Rotation
		if err := rows.Scan(&r.ID, &r.ScheduleID, &r.UserID, &r.UserName, &r.IsActive, &r.StartDate, &r.EndDate, &r.CreatedAt); err != nil {
			return nil, 0, fmt.Errorf("scan rotation: %w", err)
		}
		rotations = append(rotations, r)
	}
	return rotations, total, nil
}

// DeleteSchedule removes a schedule.
func (r *OnCallRepository) DeleteSchedule(ctx context.Context, tenantID, id uuid.UUID) error {
	result, err := r.db.ExecContext(ctx, `DELETE FROM oncall_schedules WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		return fmt.Errorf("delete schedule: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("schedule not found: %s", id)
	}
	return nil
}
