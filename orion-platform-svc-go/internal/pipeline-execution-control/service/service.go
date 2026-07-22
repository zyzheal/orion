package service
//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"time"

	"orion/platform-svc-go/internal/pipeline-execution-control/models"

	"github.com/google/uuid"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	CreateLog(ctx context.Context, log *models.ExecutionControlLog) error
	GetRunByID(ctx context.Context, id string, tenantID string) (*models.Run, error)
	ListCheckpoints(ctx context.Context, runID string, tenantID string) ([]models.Checkpoint, error)
	ListLogsByRunID(ctx context.Context, runID string, tenantID string) ([]models.ExecutionControlLog, error)
	UpdateRunStatus(ctx context.Context, id string, tenantID, oldStatus, newStatus string) error
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// --- Pause ---

func (s *Service) Pause(ctx context.Context, runID string, req *models.PauseRequest, tenantID string) (*models.Run, error) {
	run, err := s.repo.GetRunByID(ctx, runID, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrRunNotFound
		}
		return nil, err
	}
	if run.Status != "running" {
		return nil, ErrInvalidStatus
	}
	log := &models.ExecutionControlLog{
		TenantID: tenantID,
		RunID:    runID,
		Action:   "pause",
		Reason:   req.Reason,
		Operator: req.Operator,
	}
	if err := s.repo.CreateLog(ctx, log); err != nil {
		return nil, err
	}
	if err := s.repo.UpdateRunStatus(ctx, runID, tenantID, run.Status, "paused"); err != nil {
		return nil, err
	}
	return s.repo.GetRunByID(ctx, runID, tenantID)
}

// --- Resume ---

func (s *Service) Resume(ctx context.Context, runID string, req *models.ResumeRequest, tenantID string) (*models.Run, error) {
	run, err := s.repo.GetRunByID(ctx, runID, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrRunNotFound
		}
		return nil, err
	}
	if run.Status != "paused" {
		return nil, ErrInvalidStatus
	}
	log := &models.ExecutionControlLog{
		TenantID: tenantID,
		RunID:    runID,
		Action:   "resume",
		Reason:   req.Reason,
		Operator: req.Operator,
	}
	if err := s.repo.CreateLog(ctx, log); err != nil {
		return nil, err
	}
	if err := s.repo.UpdateRunStatus(ctx, runID, tenantID, "", "running"); err != nil {
		return nil, err
	}
	return s.repo.GetRunByID(ctx, runID, tenantID)
}

// --- Abort ---

func (s *Service) Abort(ctx context.Context, runID string, req *models.AbortRequest, tenantID string) (*models.Run, error) {
	run, err := s.repo.GetRunByID(ctx, runID, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrRunNotFound
		}
		return nil, err
	}
	if run.Status != "running" && run.Status != "paused" {
		return nil, ErrInvalidStatus
	}
	log := &models.ExecutionControlLog{
		TenantID: tenantID,
		RunID:    runID,
		Action:   "abort",
		Reason:   req.Reason,
		Operator: req.Operator,
	}
	if req.TimeoutSeconds != nil {
		meta := `{"timeoutSeconds":` + itoa(*req.TimeoutSeconds) + `}`
		log.Metadata = &meta
	}
	if err := s.repo.CreateLog(ctx, log); err != nil {
		return nil, err
	}
	if err := s.repo.UpdateRunStatus(ctx, runID, tenantID, "", "aborted"); err != nil {
		return nil, err
	}
	return s.repo.GetRunByID(ctx, runID, tenantID)
}

// --- Retry ---

func (s *Service) Retry(ctx context.Context, runID string, req *models.RetryRequest, tenantID string) (*models.Run, error) {
	run, err := s.repo.GetRunByID(ctx, runID, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrRunNotFound
		}
		return nil, err
	}
	if run.Status != "failed" && run.Status != "aborted" {
		return nil, ErrInvalidStatus
	}
	var metadata *string
	if req.FromCheckpoint != nil && *req.FromCheckpoint != "" {
		b, _ := json.Marshal(map[string]string{"fromCheckpoint": *req.FromCheckpoint})
		meta := string(b)
		metadata = &meta
	}
	log := &models.ExecutionControlLog{
		TenantID: tenantID,
		RunID:    runID,
		Action:   "retry",
		Operator: req.Operator,
		Metadata: metadata,
	}
	if err := s.repo.CreateLog(ctx, log); err != nil {
		return nil, err
	}
	if err := s.repo.UpdateRunStatus(ctx, runID, tenantID, "", "running"); err != nil {
		return nil, err
	}
	return s.repo.GetRunByID(ctx, runID, tenantID)
}

// --- Restart ---

func (s *Service) Restart(ctx context.Context, runID string, req *models.RestartRequest, tenantID string) (*models.Run, error) {
	_, err := s.repo.GetRunByID(ctx, runID, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrRunNotFound
		}
		return nil, err
	}
	log := &models.ExecutionControlLog{
		TenantID: tenantID,
		RunID:    runID,
		Action:   "restart",
		Reason:   req.Reason,
		Operator: req.Operator,
	}
	if err := s.repo.CreateLog(ctx, log); err != nil {
		return nil, err
	}
	if err := s.repo.UpdateRunStatus(ctx, runID, tenantID, "", "running"); err != nil {
		return nil, err
	}
	return s.repo.GetRunByID(ctx, runID, tenantID)
}

// --- Checkpoints ---

func (s *Service) GetCheckpoints(ctx context.Context, runID string, tenantID string) ([]models.Checkpoint, int, error) {
	cps, err := s.repo.ListCheckpoints(ctx, runID, tenantID)
	if err != nil {
		return nil, 0, err
	}
	if cps == nil {
		cps = []models.Checkpoint{}
	}
	return cps, len(cps), nil
}

// --- Control Logs ---

func (s *Service) GetPauseResumeLogs(ctx context.Context, runID string, tenantID string) ([]models.ExecutionControlLog, int, error) {
	logs, err := s.repo.ListLogsByRunID(ctx, runID, tenantID)
	if err != nil {
		return nil, 0, err
	}
	if logs == nil {
		logs = []models.ExecutionControlLog{}
	}
	return logs, len(logs), nil
}

// --- Errors ---

var (
	ErrRunNotFound   = errors.New("pipeline run not found")
	ErrInvalidStatus = errors.New("invalid run status for requested action")
)

func IsNotFound(err error) bool {
	return errors.Is(err, ErrRunNotFound)
}

// --- Helpers ---

func nowTimestamp() time.Time {
	return time.Now().UTC()
}

func newUUID() string {
	return uuid.New().String()
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	s := ""
	for n > 0 {
		s = string(rune('0'+n%10)) + s
		n /= 10
	}
	return s
}
