package service
//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"orion/platform-svc-go/internal/scheduled-notification/models"

	"github.com/google/uuid"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Count(ctx context.Context, tenantID string) (int, error)
	Create(ctx context.Context, s *models.ScheduledNotification) error
	CreateLog(ctx context.Context, log *models.ExecutionLog) error
	Delete(ctx context.Context, id string, tenantID string) (bool, error)
	GetByID(ctx context.Context, id string, tenantID string) (*models.ScheduledNotification, error)
	List(ctx context.Context, tenantID string, filter *models.ListFilter, limit, offset int) ([]models.ScheduledNotification, error)
	ListLogsBySchedule(ctx context.Context, scheduleID string) ([]models.ExecutionLog, error)
	UpdateFields(ctx context.Context, id string, tenantID string, updates map[string]interface{}) (*models.ScheduledNotification, error)
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// --- Schedule CRUD ---

func (s *Service) Create(ctx context.Context, tenantID, userID string, req *models.CreateScheduleRequest) (*models.ScheduledNotification, error) {
	schedule := &models.ScheduledNotification{
		TenantID:       tenantID,
		UserID:         userID,
		Name:           req.Name,
		Title:          req.Title,
		Body:           req.Body,
		Channel:        req.Channel,
		Status:         "active",
		CronExpression: req.CronExpression,
		Recipients:     req.Recipients,
		Metadata:       req.Metadata,
		StartDate:      req.StartDate,
		EndDate:        req.EndDate,
		MaxRetries:     req.MaxRetries,
		Enabled:        req.Enabled,
	}
	if schedule.Recipients == "" {
		schedule.Recipients = "[]"
	}
	if schedule.Metadata == "" {
		schedule.Metadata = "{}"
	}
	if err := s.repo.Create(ctx, schedule); err != nil {
		return nil, err
	}
	return s.repo.GetByID(ctx, schedule.ID, tenantID)
}

func (s *Service) List(ctx context.Context, tenantID string, filter *models.ListFilter, page, pageSize int) ([]models.ScheduledNotification, int, error) {
	offset := (page - 1) * pageSize
	schedules, err := s.repo.List(ctx, tenantID, filter, pageSize, offset)
	if err != nil {
		return nil, 0, err
	}
	if schedules == nil {
		schedules = []models.ScheduledNotification{}
	}
	total, err := s.repo.Count(ctx, tenantID)
	if err != nil {
		return nil, 0, err
	}
	return schedules, total, nil
}

func (s *Service) Get(ctx context.Context, tenantID, id string) (*models.ScheduledNotification, error) {
	schedule, err := s.repo.GetByID(ctx, id, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrScheduleNotFound
		}
		return nil, err
	}
	return schedule, nil
}

func (s *Service) Update(ctx context.Context, tenantID, id string, req *models.UpdateScheduleRequest) (*models.ScheduledNotification, error) {
	updates := map[string]interface{}{}
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Title != nil {
		updates["title"] = *req.Title
	}
	if req.Body != nil {
		updates["body"] = *req.Body
	}
	if req.Channel != nil {
		updates["channel"] = *req.Channel
	}
	if req.CronExpression != nil {
		updates["cron_expression"] = *req.CronExpression
	}
	if req.Recipients != nil {
		updates["recipients"] = *req.Recipients
	}
	if req.Metadata != nil {
		updates["metadata"] = *req.Metadata
	}
	if req.StartDate != nil {
		updates["start_date"] = *req.StartDate
	}
	if req.EndDate != nil {
		updates["end_date"] = *req.EndDate
	}
	if req.MaxRetries != nil {
		updates["max_retries"] = *req.MaxRetries
	}
	if req.Enabled != nil {
		updates["enabled"] = *req.Enabled
	}
	if len(updates) == 0 {
		return nil, errors.New("no fields to update")
	}
	schedule, err := s.repo.UpdateFields(ctx, id, tenantID, updates)
	if err != nil {
		return nil, err
	}
	return schedule, nil
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) (bool, error) {
	return s.repo.Delete(ctx, id, tenantID)
}

func (s *Service) Count(ctx context.Context, tenantID string) (int, error) {
	return s.repo.Count(ctx, tenantID)
}

// --- Execution ---

func (s *Service) Execute(ctx context.Context, tenantID, id string) error {
	// Get the schedule to verify existence
	schedule, err := s.repo.GetByID(ctx, id, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return ErrScheduleNotFound
		}
		return err
	}

	if !schedule.Enabled {
		return ErrScheduleDisabled
	}

	// Set status to executing
	_, err = s.repo.UpdateFields(ctx, id, tenantID, map[string]interface{}{
		"status": "executing",
	})
	if err != nil {
		return err
	}

	now := time.Now().UTC()

	// Create execution log entry
	logEntry := &models.ExecutionLog{
		ScheduleID:  id,
		Status:      "executing",
		StartedAt:   now,
		CompletedAt: now,
	}
	if err := s.repo.CreateLog(ctx, logEntry); err != nil {
		return err
	}

	// Update status to sent and set last_run_at
	_, err = s.repo.UpdateFields(ctx, id, tenantID, map[string]interface{}{
		"status":      "sent",
		"last_run_at": now,
	})
	if err != nil {
		return err
	}

	return nil
}

func (s *Service) Pause(ctx context.Context, tenantID, id string) (*models.ScheduledNotification, error) {
	schedule, err := s.repo.UpdateFields(ctx, id, tenantID, map[string]interface{}{
		"enabled": false,
		"status":  "paused",
	})
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrScheduleNotFound
		}
		return nil, err
	}
	return schedule, nil
}

func (s *Service) Resume(ctx context.Context, tenantID, id string) (*models.ScheduledNotification, error) {
	schedule, err := s.repo.UpdateFields(ctx, id, tenantID, map[string]interface{}{
		"enabled": true,
		"status":  "active",
	})
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrScheduleNotFound
		}
		return nil, err
	}
	return schedule, nil
}

func (s *Service) GetLogs(ctx context.Context, tenantID, id string) ([]models.ExecutionLog, error) {
	// Verify schedule exists
	_, err := s.repo.GetByID(ctx, id, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrScheduleNotFound
		}
		return nil, err
	}

	logs, err := s.repo.ListLogsBySchedule(ctx, id)
	if err != nil {
		return nil, err
	}
	if logs == nil {
		logs = []models.ExecutionLog{}
	}
	return logs, nil
}

// --- Errors ---

var (
	ErrScheduleNotFound = errors.New("scheduled notification not found")
	ErrScheduleDisabled = errors.New("scheduled notification is disabled")
)

func IsNotFound(err error) bool {
	return errors.Is(err, ErrScheduleNotFound)
}

// --- Helpers ---

func nowTimestamp() time.Time {
	return time.Now().UTC()
}

func newUUID() string {
	return uuid.New().String()
}
