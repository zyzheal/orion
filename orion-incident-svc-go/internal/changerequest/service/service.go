package service

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"

	"orion/incident-svc-go/internal/changerequest/models"
	"orion/incident-svc-go/internal/changerequest/repository"
)

var (
	ErrChangeRequestNotFound = errors.New("change request not found")
	ErrApprovalNotFound      = errors.New("approval not found")
	ErrStateConflict         = errors.New("state conflict")
	ErrStepNotFound          = errors.New("execution step not found")
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) CreateRequest(ctx context.Context, tenantID string, req *models.CreateChangeRequestRequest) (*models.ChangeRequest, error) {
	validTypes := map[string]bool{"standard": true, "normal": true, "emergency": true}
	if !validTypes[req.ChangeType] {
		return nil, fmt.Errorf("change_type must be one of: standard, normal, emergency")
	}
	riskLevel := "low"
	if req.RiskLevel != nil {
		riskLevel = *req.RiskLevel
	}
	d := &models.ChangeRequest{
		ID:             uuid.New().String(),
		TenantID:       tenantID,
		Title:          req.Title,
		Description:    req.Description,
		ChangeType:     req.ChangeType,
		RiskLevel:      riskLevel,
		ImpactScope:    req.ImpactScope,
		RollbackPlan:   req.RollbackPlan,
		Status:         "draft",
		ScheduledStart: req.ScheduledStart,
		ScheduledEnd:   req.ScheduledEnd,
		CreatedBy:      req.CreatedBy,
	}
	return d, s.repo.Create(ctx, d)
}

func (s *Service) ListRequests(ctx context.Context, tenantID string, offset, limit int, filters map[string]string) ([]models.ChangeRequest, error) {
	return s.repo.List(ctx, tenantID, offset, limit, filters)
}

func (s *Service) GetRequest(ctx context.Context, tenantID, id string) (*models.ChangeRequest, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) UpdateRequest(ctx context.Context, tenantID, id string, req *models.UpdateChangeRequestRequest) (*models.ChangeRequest, error) {
	existing, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrChangeRequestNotFound
	}
	if existing.Status != "draft" {
		return nil, ErrStateConflict
	}
	return s.repo.Update(ctx, tenantID, id, req)
}

func (s *Service) DeleteRequest(ctx context.Context, tenantID, id string) error {
	existing, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return ErrChangeRequestNotFound
	}
	if existing.Status != "draft" {
		return ErrStateConflict
	}
	return s.repo.Delete(ctx, tenantID, id)
}

func (s *Service) SubmitForApproval(ctx context.Context, tenantID, id string) (*models.ChangeRequest, error) {
	existing, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrChangeRequestNotFound
	}
	if existing.Status != "draft" {
		return nil, ErrStateConflict
	}
	status := "pending_approval"
	return s.repo.Update(ctx, tenantID, id, &models.UpdateChangeRequestRequest{Status: &status})
}

func (s *Service) GetApprovalChain(ctx context.Context, tenantID, id string) ([]models.Approval, error) {
	_, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrChangeRequestNotFound
	}
	return s.repo.ListApprovals(ctx, id)
}

func (s *Service) ApproveRequest(ctx context.Context, tenantID, id, approvalID, approverID string, comment *string) (*models.Approval, error) {
	_, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrChangeRequestNotFound
	}
	approval, err := s.repo.GetApproval(ctx, approvalID)
	if err != nil {
		return nil, ErrApprovalNotFound
	}
	if approval.Status != "pending" {
		return nil, ErrStateConflict
	}
	if err := s.repo.UpdateApproval(ctx, approvalID, "approved", comment); err != nil {
		return nil, err
	}
	return s.repo.GetApproval(ctx, approvalID)
}

func (s *Service) RejectRequest(ctx context.Context, tenantID, id, approvalID, approverID string, comment *string) (*models.Approval, error) {
	_, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrChangeRequestNotFound
	}
	approval, err := s.repo.GetApproval(ctx, approvalID)
	if err != nil {
		return nil, ErrApprovalNotFound
	}
	if approval.Status != "pending" {
		return nil, ErrStateConflict
	}
	if err := s.repo.UpdateApproval(ctx, approvalID, "rejected", comment); err != nil {
		return nil, err
	}
	return s.repo.GetApproval(ctx, approvalID)
}

func (s *Service) StartExecution(ctx context.Context, tenantID, id string, stepReqs []models.CreateExecutionStepRequest) ([]models.ExecutionStep, error) {
	existing, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrChangeRequestNotFound
	}
	if existing.Status != "approved" {
		return nil, ErrStateConflict
	}

	status := "executing"
	if _, err := s.repo.Update(ctx, tenantID, id, &models.UpdateChangeRequestRequest{Status: &status}); err != nil {
		return nil, err
	}

	steps := make([]models.ExecutionStep, len(stepReqs))
	for i, sr := range stepReqs {
		steps[i] = models.ExecutionStep{
			ID:              uuid.New().String(),
			ChangeRequestID: id,
			StepName:        sr.StepName,
			StepOrder:       sr.StepOrder,
			Status:          "pending",
		}
	}

	if err := s.repo.CreateExecutionSteps(ctx, steps); err != nil {
		return nil, err
	}
	return steps, nil
}

func (s *Service) GetExecutionProgress(ctx context.Context, tenantID, id string) (*models.ExecutionProgress, error) {
	existing, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrChangeRequestNotFound
	}
	steps, err := s.repo.ListExecutionSteps(ctx, id)
	if err != nil {
		return nil, err
	}
	return &models.ExecutionProgress{
		ID:     existing.ID,
		Status: existing.Status,
		Steps:  steps,
	}, nil
}

func (s *Service) UpdateExecutionStep(ctx context.Context, stepID string, req *models.UpdateExecutionStepRequest) (*models.ExecutionStep, error) {
	_, err := s.repo.GetExecutionStep(ctx, stepID)
	if err != nil {
		return nil, ErrStepNotFound
	}
	return s.repo.UpdateExecutionStep(ctx, stepID, req)
}