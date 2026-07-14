package service

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"orion/platform-svc-go/internal/pipeline-batch/models"
	"orion/platform-svc-go/internal/pipeline-batch/repository"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) CreatePhaseGroup(ctx context.Context, tenantID string, req *models.CreatePhaseGroupRequest) (*models.PhaseGroup, error) {
	group := &models.PhaseGroup{
		TenantID:      tenantID,
		PipelineID:    req.PipelineID,
		Name:          req.Name,
		BatchStrategy: req.BatchStrategy,
		BatchConfig:   req.BatchConfig,
		GateType:      req.GateType,
		CreatedBy:     req.CreatedBy,
		Status:        "draft",
	}
	if err := s.repo.CreatePhaseGroup(ctx, group); err != nil {
		return nil, err
	}
	return s.repo.GetPhaseGroupByID(ctx, group.ID, tenantID)
}

func (s *Service) GetPhaseGroup(ctx context.Context, id string, tenantID string) (*models.PhaseGroup, error) {
	return s.repo.GetPhaseGroupByID(ctx, id, tenantID)
}

func (s *Service) ListPhaseGroups(ctx context.Context, tenantID string, pipelineID *string, status *string, limit *int, offset *int) ([]models.PhaseGroup, int, error) {
	groups, err := s.repo.ListPhaseGroups(ctx, tenantID, pipelineID, status, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	if groups == nil {
		groups = []models.PhaseGroup{}
	}
	return groups, len(groups), nil
}

func (s *Service) UpdatePhaseGroup(ctx context.Context, id string, tenantID string, req *models.UpdatePhaseGroupRequest) (*models.PhaseGroup, error) {
	updates := map[string]interface{}{}
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.BatchStrategy != nil {
		updates["batch_strategy"] = *req.BatchStrategy
	}
	if req.BatchConfig != nil {
		updates["batch_config"] = *req.BatchConfig
	}
	if req.GateType != nil {
		updates["gate_type"] = *req.GateType
	}
	if req.Status != nil {
		updates["status"] = *req.Status
	}
	if len(updates) == 0 {
		return nil, ErrNothingToUpdate
	}
	return s.repo.UpdatePhaseGroup(ctx, id, tenantID, updates)
}

func (s *Service) DeletePhaseGroup(ctx context.Context, id string, tenantID string) (bool, error) {
	return s.repo.DeletePhaseGroup(ctx, id, tenantID)
}

func (s *Service) StartExecution(ctx context.Context, id string, tenantID string) (*models.PhaseGroup, error) {
	group, err := s.GetPhaseGroup(ctx, id, tenantID)
	if err != nil {
		return nil, err
	}
	if group.Status != "draft" {
		return nil, ErrInvalidStatus
	}
	return s.repo.UpdatePhaseGroup(ctx, id, tenantID, map[string]interface{}{"status": "executing"})
}

func (s *Service) PauseExecution(ctx context.Context, id string, tenantID string) (*models.PhaseGroup, error) {
	group, err := s.GetPhaseGroup(ctx, id, tenantID)
	if err != nil {
		return nil, err
	}
	if group.Status != "executing" {
		return nil, ErrInvalidStatus
	}
	return s.repo.UpdatePhaseGroup(ctx, id, tenantID, map[string]interface{}{"status": "paused"})
}

func (s *Service) ResumeExecution(ctx context.Context, id string, tenantID string) (*models.PhaseGroup, error) {
	group, err := s.GetPhaseGroup(ctx, id, tenantID)
	if err != nil {
		return nil, err
	}
	if group.Status != "paused" {
		return nil, ErrInvalidStatus
	}
	return s.repo.UpdatePhaseGroup(ctx, id, tenantID, map[string]interface{}{"status": "executing"})
}

func (s *Service) AdvanceToNextBatch(ctx context.Context, id string, tenantID string) (*models.PhaseGroup, error) {
	_, err := s.GetPhaseGroup(ctx, id, tenantID)
	if err != nil {
		return nil, err
	}
	return s.repo.UpdatePhaseGroup(ctx, id, tenantID, map[string]interface{}{"status": "executing"})
}

func (s *Service) RollbackExecution(ctx context.Context, id string, tenantID string) (*models.PhaseGroup, error) {
	group, err := s.GetPhaseGroup(ctx, id, tenantID)
	if err != nil {
		return nil, err
	}
	if group.Status != "executing" && group.Status != "paused" {
		return nil, ErrInvalidStatus
	}
	return s.repo.UpdatePhaseGroup(ctx, id, tenantID, map[string]interface{}{"status": "rolled_back"})
}

// Batch runs

func (s *Service) ListBatchRuns(ctx context.Context, pgID string, tenantID string) ([]models.BatchRun, error) {
	runs, err := s.repo.ListBatchRuns(ctx, pgID, tenantID)
	if err != nil {
		return nil, err
	}
	if runs == nil {
		runs = []models.BatchRun{}
	}
	return runs, nil
}

func (s *Service) CompleteBatch(ctx context.Context, pgID string, batchID string, tenantID string, result map[string]interface{}) (*models.BatchRun, error) {
	_, err := s.repo.GetBatchRunByID(ctx, batchID, tenantID)
	if err != nil {
		return nil, err
	}
	resultJSON := ""
	if result != nil {
		b, _ := json.Marshal(result)
		role := string(b)
		resultJSON = role
	}
	return s.repo.UpdateBatchRun(ctx, batchID, tenantID, "completed", resultJSON)
}

func (s *Service) FailBatch(ctx context.Context, pgID string, batchID string, tenantID string, result map[string]interface{}) (*models.BatchRun, error) {
	_, err := s.repo.GetBatchRunByID(ctx, batchID, tenantID)
	if err != nil {
		return nil, err
	}
	resultJSON := ""
	if result != nil {
		b, _ := json.Marshal(result)
		resultJSON = string(b)
	}
	return s.repo.UpdateBatchRun(ctx, batchID, tenantID, "failed", resultJSON)
}

// Errors

var (
	ErrPhaseGroupNotFound = errors.New("phase group not found")
	ErrInvalidStatus      = errors.New("invalid status transition")
	ErrNothingToUpdate    = errors.New("no fields to update")
)

func IsNotFound(err error) bool {
	return errors.Is(err, repository.ErrNotFound)
}

func IsInvalidStatus(err error) bool {
	return errors.Is(err, ErrInvalidStatus)
}

// Helpers

func newUUID() string {
	return uuid.New().String()
}

func nowTimestamp() time.Time {
	return time.Now().UTC()
}


var _ *sqlx.DB
