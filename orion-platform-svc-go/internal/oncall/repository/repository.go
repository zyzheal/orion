package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/oncall/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// Repository handles database access for on-call data.
type Repository struct {
	db *sqlx.DB
}

// NewRepository creates a new oncall repository.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// --- Schedule CRUD ---

func (r *Repository) CreateSchedule(ctx context.Context, s *models.Schedule) error {
	s.ID = uuid.New().String()
	now := time.Now().UTC()
	s.CreatedAt = now
	s.UpdatedAt = now
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO oncall_schedules (id, tenant_id, name, timezone, rotation_type, start_date, end_date, status, created_at, updated_at)
		 VALUES (:id, :tenantId, :name, :timezone, :rotationType, :startDate, :endDate, :status, :createdAt, :updatedAt)`,
		s)
	return err
}

func (r *Repository) GetSchedule(ctx context.Context, tenantID, id string) (*models.Schedule, error) {
	var s models.Schedule
	err := r.db.GetContext(ctx, &s,
		`SELECT * FROM oncall_schedules WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *Repository) ListSchedules(ctx context.Context, tenantID string, status *string) ([]models.Schedule, int, error) {
	where := "WHERE tenant_id = $1"
	args := []interface{}{tenantID}
	argIdx := 2

	if status != nil && *status != "" {
		where += fmt.Sprintf(" AND status = $%d", argIdx)
		args = append(args, *status)
		argIdx++
	}

	countQuery := fmt.Sprintf(`SELECT COUNT(*) FROM oncall_schedules %s`, where)
	var total int
	err := r.db.GetContext(ctx, &total, countQuery, args...)
	if err != nil {
		return nil, 0, err
	}

	var items []models.Schedule
	selectQuery := fmt.Sprintf(`SELECT * FROM oncall_schedules %s ORDER BY created_at DESC`, where)
	err = r.db.SelectContext(ctx, &items, selectQuery, args...)
	if err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (r *Repository) UpdateSchedule(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.Schedule, error) {
	updates["updated_at"] = time.Now().UTC()
	setClauses := []string{}
	args := []interface{}{}
	i := 1
	for key, val := range updates {
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", key, i))
		args = append(args, val)
		i++
	}
	args = append(args, id, tenantID)
	query := fmt.Sprintf(`UPDATE oncall_schedules SET %s WHERE id=$%d AND tenant_id=$%d`, strings.Join(setClauses, ", "), i, i+1)
	_, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	return r.GetSchedule(ctx, tenantID, id)
}

func (r *Repository) DeleteSchedule(ctx context.Context, tenantID, id string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM oncall_schedules WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return false, err
	}
	n, _ := result.RowsAffected()
	return n > 0, nil
}

// --- Assignment CRUD ---

func (r *Repository) CreateAssignment(ctx context.Context, tenantID string, a *models.Assignment) error {
	a.ID = uuid.New().String()
	a.CreatedAt = time.Now().UTC()
	// Validate schedule belongs to tenant
	var exists bool
	err := r.db.GetContext(ctx, &exists,
		`SELECT EXISTS(SELECT 1 FROM oncall_schedules WHERE id=$1 AND tenant_id=$2)`, a.ScheduleID, tenantID)
	if err != nil {
		return err
	}
	if !exists {
		return ErrScheduleNotFound
	}
	_, err = r.db.NamedExecContext(ctx,
		`INSERT INTO oncall_assignments (id, schedule_id, assignee_id, assignee_name, role, start_time, end_time, created_at)
		 VALUES (:id, :scheduleId, :assigneeId, :assigneeName, :role, :startTime, :endTime, :createdAt)`,
		a)
	return err
}

func (r *Repository) GetAssignment(ctx context.Context, tenantID, id string) (*models.Assignment, error) {
	var a models.Assignment
	err := r.db.GetContext(ctx, &a,
		`SELECT a.* FROM oncall_assignments a
		 INNER JOIN oncall_schedules s ON s.id = a.schedule_id
		 WHERE a.id=$1 AND s.tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &a, nil
}

func (r *Repository) ListAssignments(ctx context.Context, tenantID string, scheduleID *string) ([]models.Assignment, int, error) {
	where := "INNER JOIN oncall_schedules s ON s.id = a.schedule_id WHERE s.tenant_id = $1"
	args := []interface{}{tenantID}
	argIdx := 2

	if scheduleID != nil && *scheduleID != "" {
		where += fmt.Sprintf(" AND a.schedule_id = $%d", argIdx)
		args = append(args, *scheduleID)
		argIdx++
	}

	countQuery := fmt.Sprintf(`SELECT COUNT(*) FROM oncall_assignments a %s`, where)
	var total int
	err := r.db.GetContext(ctx, &total, countQuery, args...)
	if err != nil {
		return nil, 0, err
	}

	var items []models.Assignment
	selectQuery := fmt.Sprintf(`SELECT a.* FROM oncall_assignments a %s ORDER BY a.start_time DESC`, where)
	err = r.db.SelectContext(ctx, &items, selectQuery, args...)
	if err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (r *Repository) UpdateAssignment(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.Assignment, error) {
	// Ensure assignment belongs to tenant's schedule
	_ , err := r.GetAssignment(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	setClauses := []string{}
	assignArgs := []interface{}{}
	i := 1
	for key, val := range updates {
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", key, i))
		assignArgs = append(assignArgs, val)
		i++
	}
	assignArgs = append(assignArgs, id, tenantID)
	query := fmt.Sprintf(`UPDATE oncall_assignments a SET %s
		 FROM oncall_schedules s WHERE s.id = a.schedule_id AND a.id=$%d AND s.tenant_id=$%d`,
		strings.Join(setClauses, ", "), i, i+1)
	_, err = r.db.ExecContext(ctx, query, assignArgs...)
	if err != nil {
		return nil, err
	}
	return r.GetAssignment(ctx, tenantID, id)
}

func (r *Repository) DeleteAssignment(ctx context.Context, tenantID, id string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM oncall_assignments a
		 USING oncall_schedules s WHERE s.id = a.schedule_id AND a.id=$1 AND s.tenant_id=$2`, id, tenantID)
	if err != nil {
		return false, err
	}
	n, _ := result.RowsAffected()
	return n > 0, nil
}

// --- Override CRUD ---

func (r *Repository) CreateOverride(ctx context.Context, tenantID string, o *models.Override) error {
	o.ID = uuid.New().String()
	o.CreatedAt = time.Now().UTC()
	// Validate schedule belongs to tenant
	var exists bool
	err := r.db.GetContext(ctx, &exists,
		`SELECT EXISTS(SELECT 1 FROM oncall_schedules WHERE id=$1 AND tenant_id=$2)`, o.ScheduleID, tenantID)
	if err != nil {
		return err
	}
	if !exists {
		return ErrScheduleNotFound
	}
	_, err = r.db.NamedExecContext(ctx,
		`INSERT INTO oncall_overrides (id, schedule_id, assignee_id, assignee_name, reason, start_time, end_time, created_at)
		 VALUES (:id, :scheduleId, :assigneeId, :assigneeName, :reason, :startTime, :endTime, :createdAt)`,
		o)
	return err
}

func (r *Repository) GetOverride(ctx context.Context, tenantID, id string) (*models.Override, error) {
	var o models.Override
	err := r.db.GetContext(ctx, &o,
		`SELECT o.* FROM oncall_overrides o
		 INNER JOIN oncall_schedules s ON s.id = o.schedule_id
		 WHERE o.id=$1 AND s.tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &o, nil
}

func (r *Repository) ListOverrides(ctx context.Context, tenantID string, scheduleID *string) ([]models.Override, int, error) {
	where := "INNER JOIN oncall_schedules s ON s.id = o.schedule_id WHERE s.tenant_id = $1"
	args := []interface{}{tenantID}
	argIdx := 2

	if scheduleID != nil && *scheduleID != "" {
		where += fmt.Sprintf(" AND o.schedule_id = $%d", argIdx)
		args = append(args, *scheduleID)
		argIdx++
	}

	countQuery := fmt.Sprintf(`SELECT COUNT(*) FROM oncall_overrides o %s`, where)
	var total int
	dbErr := r.db.GetContext(ctx, &total, countQuery, args...)
	if dbErr != nil {
		return nil, 0, dbErr
	}

	var items []models.Override
	selectQuery := fmt.Sprintf(`SELECT o.* FROM oncall_overrides o %s ORDER BY o.start_time DESC`, where)
	err := r.db.SelectContext(ctx, &items, selectQuery, args...)
	if err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (r *Repository) UpdateOverride(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.Override, error) {
	// Ensure override belongs to tenant's schedule
	_ , err := r.GetOverride(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	setClauses := []string{}
	assignArgs := []interface{}{}
	i := 1
	for key, val := range updates {
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", key, i))
		assignArgs = append(assignArgs, val)
		i++
	}
	assignArgs = append(assignArgs, id, tenantID)
	query := fmt.Sprintf(`UPDATE oncall_overrides o SET %s
		 FROM oncall_schedules s WHERE s.id = o.schedule_id AND o.id=$%d AND s.tenant_id=$%d`,
		strings.Join(setClauses, ", "), i, i+1)
	_, err = r.db.ExecContext(ctx, query, assignArgs...)
	if err != nil {
		return nil, err
	}
	return r.GetOverride(ctx, tenantID, id)
}

func (r *Repository) DeleteOverride(ctx context.Context, tenantID, id string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM oncall_overrides o
		 USING oncall_schedules s WHERE s.id = o.schedule_id AND o.id=$1 AND s.tenant_id=$2`, id, tenantID)
	if err != nil {
		return false, err
	}
	n, _ := result.RowsAffected()
	return n > 0, nil
}

// --- On-Call Now ---

// GetScheduleAssignments retrieves active assignments for a schedule at a given time.
func (r *Repository) GetScheduleAssignments(ctx context.Context, tenantID, scheduleID string, now time.Time) ([]models.Assignment, error) {
	var items []models.Assignment
	err := r.db.SelectContext(ctx, &items,
		`SELECT a.* FROM oncall_assignments a
		 INNER JOIN oncall_schedules s ON s.id = a.schedule_id
		 WHERE a.schedule_id = $1
		   AND s.tenant_id = $2
		   AND a.start_time <= $3
		   AND a.end_time >= $3
		   AND s.status = 'active'
		 ORDER BY a.start_time`, scheduleID, tenantID, now)
	if err != nil {
		return nil, err
	}
	return items, nil
}

// GetActiveOverrides retrieves active overrides for a schedule at a given time.
func (r *Repository) GetActiveOverrides(ctx context.Context, tenantID, scheduleID string, now time.Time) ([]models.Override, error) {
	var items []models.Override
	err := r.db.SelectContext(ctx, &items,
		`SELECT o.* FROM oncall_overrides o
		 INNER JOIN oncall_schedules s ON s.id = o.schedule_id
		 WHERE o.schedule_id = $1
		   AND s.tenant_id = $2
		   AND o.start_time <= $3
		   AND o.end_time >= $3
		 ORDER BY o.start_time`, scheduleID, tenantID, now)
	if err != nil {
		return nil, err
	}
	return items, nil
}

// --- Errors ---

var (
	ErrScheduleNotFound   = errors.New("schedule not found")
	ErrAssignmentNotFound = errors.New("assignment not found")
	ErrOverrideNotFound   = errors.New("override not found")
)

func IsNotFound(err error) bool {
	return errors.Is(err, ErrScheduleNotFound) || errors.Is(err, ErrAssignmentNotFound) || errors.Is(err, ErrOverrideNotFound)
}

func ErrScheduleNotFoundID(id string) error {
	return fmt.Errorf("schedule %q not found: %w", id, ErrScheduleNotFound)
}
