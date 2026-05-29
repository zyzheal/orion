package service

import (
	"context"
	"errors"
	"orion/approval-svc-go/internal/models"
	"orion/approval-svc-go/internal/repository"
)

var (
	ErrApprovalNotFound = errors.New("approval not found")
	ErrStepNotFound     = errors.New("approval step not found")
	ErrInvalidStatus    = errors.New("invalid status transition")
	ErrAlreadyActed     = errors.New("step already acted upon")
)

type ApprovalService struct {
	repo *repository.ApprovalRepository
}

func NewApprovalService(repo *repository.ApprovalRepository) *ApprovalService {
	return &ApprovalService{repo: repo}
}

func (s *ApprovalService) Create(ctx context.Context, a *models.Approval) error {
	if a.Status == "" {
		a.Status = models.ApprovalPending
	}
	if a.TotalSteps <= 0 {
		a.TotalSteps = 1
	}
	if a.RequiredApprovals <= 0 {
		a.RequiredApprovals = 1
	}
	return s.repo.Create(ctx, a)
}

func (s *ApprovalService) GetByID(ctx context.Context, tenantID, id string) (*models.Approval, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *ApprovalService) List(ctx context.Context, tenantID string, offset, limit int) ([]models.Approval, error) {
	return s.repo.ListByTenant(ctx, tenantID, offset, limit)
}

func (s *ApprovalService) Approve(ctx context.Context, tenantID, id, stepID string, comment *string) error {
	approval, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return ErrApprovalNotFound
	}
	if approval.Status != models.ApprovalPending {
		return ErrInvalidStatus
	}

	if err := s.repo.UpdateStepStatus(ctx, stepID, models.StepApproved, comment); err != nil {
		return err
	}

	if approval.CurrentStep+1 >= approval.TotalSteps {
		return s.repo.UpdateStatus(ctx, id, models.ApprovalApproved)
	}
	return s.repo.AdvanceStep(ctx, id)
}

func (s *ApprovalService) Reject(ctx context.Context, tenantID, id, stepID string, comment *string) error {
	approval, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return ErrApprovalNotFound
	}
	if approval.Status != models.ApprovalPending {
		return ErrInvalidStatus
	}

	if err := s.repo.UpdateStepStatus(ctx, stepID, models.StepRejected, comment); err != nil {
		return err
	}

	return s.repo.UpdateStatus(ctx, id, models.ApprovalRejected)
}

func (s *ApprovalService) Cancel(ctx context.Context, tenantID, id string) error {
	approval, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return ErrApprovalNotFound
	}
	if approval.Status != models.ApprovalPending {
		return ErrInvalidStatus
	}

	return s.repo.UpdateStatus(ctx, id, models.ApprovalCanceled)
}

func (s *ApprovalService) GetSteps(ctx context.Context, approvalID string) ([]models.ApprovalStep, error) {
	return s.repo.GetStepsByApprovalID(ctx, approvalID)
}

func (s *ApprovalService) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}

func (s *ApprovalService) Count(ctx context.Context, tenantID string) (int, error) {
	return s.repo.Count(ctx, tenantID)
}
