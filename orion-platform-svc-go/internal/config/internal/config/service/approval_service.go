package service

import (
	"context"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/config/internal/config/models"
	"orion/platform-svc-go/internal/config/internal/config/repository"

	"github.com/google/uuid"
)

// ApprovalService manages config change approval workflows.
type ApprovalService struct {
	repo       *repository.Repository
	configSvc  *Service
}

func NewApprovalService(repo *repository.Repository, configSvc *Service) *ApprovalService {
	return &ApprovalService{repo: repo, configSvc: configSvc}
}

func (s *ApprovalService) Create(ctx context.Context, tenantID string, req models.CreateApprovalRequest) (*models.ConfigApproval, error) {
	// Get current value
	currentVal := ""
	existing, _ := s.repo.GetByKey(ctx, tenantID, req.ConfigKey, req.Environment)
	if existing != nil {
		currentVal = existing.Value
	}

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
	if err := s.repo.CreateApproval(ctx, approval); err != nil {
		return nil, err
	}
	return approval, nil
}

func (s *ApprovalService) Get(ctx context.Context, tenantID, id string) (*models.ConfigApproval, error) {
	return s.repo.GetApproval(ctx, tenantID, id)
}

func (s *ApprovalService) List(ctx context.Context, tenantID, status string) ([]models.ConfigApproval, error) {
	return s.repo.ListApprovals(ctx, tenantID, status)
}

// Review approves or rejects a config change request.
func (s *ApprovalService) Review(ctx context.Context, tenantID, id string, req models.ReviewApprovalRequest) error {
	if req.Status != "approved" && req.Status != "rejected" {
		return fmt.Errorf("invalid status: %s (must be 'approved' or 'rejected')", req.Status)
	}
	return s.repo.UpdateApprovalStatus(ctx, tenantID, id, req.Status, req.ReviewedBy, req.Comment)
}

// Apply applies an approved config change.
func (s *ApprovalService) Apply(ctx context.Context, tenantID, id string) error {
	approval, err := s.repo.GetApproval(ctx, tenantID, id)
	if err != nil {
		return fmt.Errorf("approval not found: %w", err)
	}
	if approval.Status != "approved" {
		return fmt.Errorf("cannot apply: status is '%s', must be 'approved'", approval.Status)
	}

	// Apply the config change
	_, err = s.configSvc.SetConfig(ctx, tenantID, &models.SetConfigRequest{
		Key:         approval.ConfigKey,
		Value:       approval.ProposedValue,
		Environment: approval.Environment,
		ChangedBy:   approval.ReviewedBy,
		Reason:      fmt.Sprintf("Applied from approval %s", id),
	})
	if err != nil {
		return fmt.Errorf("apply config: %w", err)
	}

	return s.repo.MarkApprovalApplied(ctx, tenantID, id)
}
