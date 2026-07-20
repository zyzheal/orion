package service
//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"errors"
	"sync"
	"time"

	"orion/platform-svc-go/internal/task-timeout/models"

	"go.uber.org/zap"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	GetTimedOutTasks(ctx context.Context) ([]models.TimeoutTask, error)
}

// ErrTimeoutCheckerNotAvailable indicates the service could not perform a check.
var ErrTimeoutCheckerNotAvailable = errors.New("task timeout checker not available")

// Config holds the runtime tuning for the TaskTimeoutChecker.
type Config struct {
	CheckIntervalMs      int64
	FirstRemindHours     int
	EscalateHours        int
	AutoCompleteHours    int
	DefaultTimeoutAction models.TimeoutAction
}

// Service is the business-logic layer for task-timeout checking.
type Service struct {
	repo         RepositoryInterface
	config       Config
	running      bool
	mu           sync.Mutex
	lastCheckAt  *time.Time
	totalChecked int64
	logger       *zap.Logger
}

// NewService creates a new Service backed by the given repository and config.
func NewService(repo RepositoryInterface, config Config, logger *zap.Logger) *Service {
	return &Service{
		repo:    repo,
		config:  config,
		running: false,
		logger:  logger,
	}
}

// getActionForOverdueHours maps the number of overdue hours to a timeout action
// using the configured thresholds.  The comparison uses time arithmetic rather
// than direct time.Time ordering.
func (s *Service) getActionForOverdueHours(overdueHours float64) models.TimeoutAction {
	if s.config.AutoCompleteHours > 0 &&
		overdueHours >= float64(s.config.AutoCompleteHours) {
		return models.TimeoutActionAutoComplete
	}
	if s.config.EscalateHours > 0 &&
		overdueHours >= float64(s.config.EscalateHours) {
		return models.TimeoutActionEscalate
	}
	return models.TimeoutActionRemind
}

// GetTimedOutTasks queries the database for all currently timed-out tasks and
// attaches the appropriate timeout action based on how long they are overdue.
func (s *Service) GetTimedOutTasks(ctx context.Context) ([]models.TimeoutTask, error) {
	if s.repo == nil {
		return nil, ErrTimeoutCheckerNotAvailable
	}

	rows, err := s.repo.GetTimedOutTasks(ctx)
	if err != nil {
		return nil, err
	}

	for i := range rows {
		rows[i].TimeoutAction = s.getActionForOverdueHours(rows[i].OverdueHours)
	}

	return rows, nil
}

// CheckNow forces an immediate timeout scan and returns the currently timed-out
// tasks along with the configured action for each.
func (s *Service) CheckNow(ctx context.Context) ([]models.TimeoutTask, error) {
	if s.repo == nil {
		return nil, ErrTimeoutCheckerNotAvailable
	}

	tasks, err := s.GetTimedOutTasks(ctx)
	if err != nil {
		return nil, err
	}

	s.mu.Lock()
	s.lastCheckAt = ptrTime(time.Now())
	s.totalChecked += int64(len(tasks))
	s.mu.Unlock()

	return tasks, nil
}

// GetStatus returns a snapshot of the checker's current state.
func (s *Service) GetStatus() *models.TimeoutCheckerStatus {
	s.mu.Lock()
	defer s.mu.Unlock()

	status := &models.TimeoutCheckerStatus{
		IsRunning:            s.running,
		CheckIntervalMs:      s.config.CheckIntervalMs,
		FirstRemindHours:     s.config.FirstRemindHours,
		EscalateHours:        s.config.EscalateHours,
		AutoCompleteHours:    s.config.AutoCompleteHours,
		DefaultTimeoutAction: s.config.DefaultTimeoutAction,
		LastCheckAt:          s.lastCheckAt,
		TotalChecked:         s.totalChecked,
	}
	return status
}

// Start begins the periodic background timeout check loop.
//
// The loop runs at Config.CheckIntervalMs and calls CheckNow each tick.
// If no DB repository is available the loop will log the unavailability but
// keep the ticker running so the service appears healthy.
func (s *Service) Start(ctx context.Context) {
	s.mu.Lock()
	s.running = true
	s.mu.Unlock()

	interval := time.Duration(s.config.CheckIntervalMs) * time.Millisecond
	if interval <= 0 {
		interval = 60 * time.Second
	}

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			s.mu.Lock()
			s.running = false
			s.mu.Unlock()
			return
		case <-ticker.C:
			s.checkOnce(ctx)
		}
	}
}

// checkOnce runs a single scan.  Errors are logged and do not stop the loop.
func (s *Service) checkOnce(ctx context.Context) {
	if s.repo == nil {
		s.logger.Debug("task timeout checker: repo not available, skipping tick")
		return
	}

	tasks, err := s.GetTimedOutTasks(ctx)
	if err != nil {
		s.logger.Error("task timeout checker: scan failed", zap.Error(err))
		return
	}

	for _, task := range tasks {
		s.logger.Info("task timeout: task overdue",
			zap.String("task_id", task.TaskID),
			zap.Float64("overdue_hours", task.OverdueHours),
			zap.String("action", string(task.TimeoutAction)))
	}
}

// GetTimeouts returns the current timeout configuration.
func (s *Service) GetTimeouts(ctx context.Context, tenantID string) (*models.TimeoutCheckerStatus, error) {
	return s.GetStatus(), nil
}

// SetTimeouts updates the timeout configuration.
func (s *Service) SetTimeouts(ctx context.Context, tenantID string, defaultTimeout int, maxTimeout int) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.config.FirstRemindHours = defaultTimeout
	s.config.AutoCompleteHours = maxTimeout
	return nil
}

// ptrTime is a helper to convert a time.Time to *time.Time.
func ptrTime(t time.Time) *time.Time {
	return &t
}
