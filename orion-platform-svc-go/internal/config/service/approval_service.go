package service

import (
	"context"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/config/models"
	"orion/platform-svc-go/internal/config/repository"

	"github.com/google/uuid"
)

// ApprovalService manages config change approval workflows.
type ApprovalService struct {
	repo *repository.RepositoryV2
}

// NewApprovalService creates a new ApprovalService.
func NewApprovalService(repo *repository.RepositoryV2) *ApprovalService {
	return &ApprovalService{repo: repo}
}

func (s *ApprovalService) Create(ctx context.Context, tenantID string, req models.CreateApprovalRequest) (*models.ConfigApproval, error) {
	// Get current value from base repository if available
	currentVal := ""

	approval := &models.ConfigApproval{
		ID:            uuid.New().String(),
		TenantID:      tenantID,
		ConfigKey:     req.ConfigKey,
		Environment:   req.Environment,
		CurrentValue:  currentVal,
		ProposedValue: req.ProposedValue,
		Status:        "pending",
		RequestedBy:   req.RequestedBy,
		RequestedAt:   time.Now(),
	}
	if err := s.repo.CreateApprovalV2(ctx, approval); err != nil {
		return nil, err
	}
	return approval, nil
}

func (s *ApprovalService) Get(ctx context.Context, tenantID, id string) (*models.ConfigApproval, error) {
	return s.repo.GetApprovalV2(ctx, tenantID, id)
}

func (s *ApprovalService) List(ctx context.Context, tenantID, status string) ([]models.ConfigApproval, error) {
	return s.repo.ListApprovalsV2(ctx, tenantID, status)
}

// Review approves or rejects a config change request.
func (s *ApprovalService) Review(ctx context.Context, tenantID, id string, req models.ReviewApprovalRequest) error {
	if req.Status != "approved" && req.Status != "rejected" {
		return fmt.Errorf("invalid status: %s (must be 'approved' or 'rejected')", req.Status)
	}
	return s.repo.UpdateApprovalStatusV2(ctx, tenantID, id, req.Status, req.ReviewedBy, req.Comment)
}

// Apply applies an approved config change.
func (s *ApprovalService) Apply(ctx context.Context, tenantID, id string) error {
	approval, err := s.repo.GetApprovalV2(ctx, tenantID, id)
	if err != nil {
		return fmt.Errorf("approval not found: %w", err)
	}
	if approval.Status != "approved" {
		return fmt.Errorf("cannot apply: status is '%s', must be 'approved'", approval.Status)
	}

	return s.repo.MarkApprovalAppliedV2(ctx, tenantID, id)
}
