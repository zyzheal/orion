package service

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"orion/platform-svc-go/internal/pipeline-execution-control/models"
	"orion/platform-svc-go/internal/pipeline-execution-control/repository"

	"github.com/google/uuid"
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
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
	if err := s.repo.UpdateRunStatus(ctx, runID, tenantID, "paused"); err != nil {
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
	if err := s.repo.UpdateRunStatus(ctx, runID, tenantID, "running"); err != nil {
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
	if err := s.repo.UpdateRunStatus(ctx, runID, tenantID, "aborted"); err != nil {
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
		meta := `{"fromCheckpoint":"` + *req.FromCheckpoint + `"}`
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
	if err := s.repo.UpdateRunStatus(ctx, runID, tenantID, "running"); err != nil {
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
	if err := s.repo.UpdateRunStatus(ctx, runID, tenantID, "running"); err != nil {
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
	ErrRunNotFound    = errors.New("pipeline run not found")
	ErrInvalidStatus  = errors.New("invalid run status for requested action")
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