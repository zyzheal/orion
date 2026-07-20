package repository

import (
	"context"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/scheduled-notification/models"

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

// --- Scheduled Notifications ---

func (r *Repository) Create(ctx context.Context, s *models.ScheduledNotification) error {
	s.ID = uuid.New().String()
	s.CreatedAt = time.Now().UTC()
	s.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO scheduled_notifications
		 (id, tenant_id, user_id, name, title, body, channel, status, cron_expression,
		  recipients, metadata, start_date, end_date, last_run_at, next_run_at,
		  max_retries, retry_count, enabled, created_at, updated_at)
		 VALUES (:id, :tenantId, :userId, :name, :title, :body, :channel, :status, :cronExpression,
		         :recipients, :metadata, :startDate, :endDate, :lastRunAt, :nextRunAt,
		         :maxRetries, :retryCount, :enabled, :createdAt, :updatedAt)`,
		s)
	return err
}

func (r *Repository) GetByID(ctx context.Context, id string, tenantID string) (*models.ScheduledNotification, error) {
	var s models.ScheduledNotification
	err := r.db.GetContext(ctx, &s,
		`SELECT * FROM scheduled_notifications WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *Repository) List(ctx context.Context, tenantID string, filter *models.ListFilter, limit, offset int) ([]models.ScheduledNotification, error) {
	where := "WHERE tenant_id = $1"
	args := []interface{}{tenantID}
	argIdx := 2

	if filter != nil {
		if filter.Channel != nil && *filter.Channel != "" {
			where += fmt.Sprintf(" AND channel = $%d", argIdx)
			args = append(args, *filter.Channel)
			argIdx++
		}
		if filter.Status != nil && *filter.Status != "" {
			where += fmt.Sprintf(" AND status = $%d", argIdx)
			args = append(args, *filter.Status)
			argIdx++
		}
		if filter.Enabled != nil {
			where += fmt.Sprintf(" AND enabled = $%d", argIdx)
			args = append(args, *filter.Enabled)
			argIdx++
		}
	}

	var schedules []models.ScheduledNotification
	err := r.db.SelectContext(ctx, &schedules,
		fmt.Sprintf(`SELECT * FROM scheduled_notifications %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`,
			where, argIdx, argIdx+1),
		append(args, limit, offset)...)
	return schedules, err
}

func (r *Repository) Count(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM scheduled_notifications WHERE tenant_id=$1`, tenantID)
	return count, err
}

func (r *Repository) Update(ctx context.Context, schedule *models.ScheduledNotification) (*models.ScheduledNotification, error) {
	schedule.UpdatedAt = time.Now().UTC()
	result, err := r.db.NamedExecContext(ctx,
		`UPDATE scheduled_notifications SET
			name = :name, title = :title, body = :body, channel = :channel,
			status = :status, cron_expression = :cronExpression,
			recipients = :recipients, metadata = :metadata,
			start_date = :startDate, end_date = :endDate,
			last_run_at = :lastRunAt, next_run_at = :nextRunAt,
			max_retries = :maxRetries, retry_count = :retryCount,
			enabled = :enabled, updated_at = :updatedAt
		 WHERE id = :id AND tenant_id = :tenantId`,
		schedule)
	if err != nil {
		return nil, err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return nil, sentinel.NotFound
	}
	return r.GetByID(ctx, schedule.ID, schedule.TenantID)
}

func (r *Repository) UpdateFields(ctx context.Context, id string, tenantID string, updates map[string]interface{}) (*models.ScheduledNotification, error) {
	if len(updates) == 0 {
		return nil, sentinel.NotFound
	}
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
	query := fmt.Sprintf(`UPDATE scheduled_notifications SET %s WHERE id=$%d AND tenant_id=$%d`,
		strings.Join(setClauses, ", "), i, i+1)
	result, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return nil, sentinel.NotFound
	}
	return r.GetByID(ctx, id, tenantID)
}

func (r *Repository) Delete(ctx context.Context, id string, tenantID string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM scheduled_notifications WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return false, err
	}
	n, _ := result.RowsAffected()
	return n > 0, nil
}

// --- Execution Logs ---

func (r *Repository) CreateLog(ctx context.Context, log *models.ExecutionLog) error {
	log.ID = uuid.New().String()
	log.CreatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO scheduled_notification_logs
		 (id, schedule_id, status, error_message, started_at, completed_at, created_at)
		 VALUES (:id, :scheduleId, :status, :errorMessage, :startedAt, :completedAt, :createdAt)`,
		log)
	return err
}

func (r *Repository) ListLogsBySchedule(ctx context.Context, scheduleID string) ([]models.ExecutionLog, error) {
	var logs []models.ExecutionLog
	err := r.db.SelectContext(ctx, &logs,
		`SELECT * FROM scheduled_notification_logs WHERE schedule_id=$1 ORDER BY created_at DESC`, scheduleID)
	return logs, err
}
