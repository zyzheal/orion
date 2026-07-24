package service

import (
	"context"
	"fmt"
	"time"

	"orion-ticket-svc-go/internal/models"
	"orion-ticket-svc-go/internal/repository"
)

type SLAPolicyService struct {
	repo *repository.SLAPolicyRepository
}

func NewSLAPolicyService(repo *repository.SLAPolicyRepository) *SLAPolicyService {
	return &SLAPolicyService{repo: repo}
}

func (s *SLAPolicyService) Create(ctx context.Context, tenantID string, req *models.CreateSLAPolicyRequest) (*models.SLAPolicy, error) {
	if req.Name == "" {
		return nil, fmt.Errorf("name is required")
	}
	if req.Priority == "" {
		return nil, fmt.Errorf("priority is required")
	}
	if req.TargetResolutionTimeMs <= 0 {
		return nil, fmt.Errorf("target_resolution_time_ms is required")
	}

	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}

	policy := &models.SLAPolicy{
		TenantID:               tenantID,
		Name:                   req.Name,
		Description:            req.Description,
		Priority:               req.Priority,
		TargetResponseTimeMs:   req.TargetResponseTimeMs,
		TargetResolutionTimeMs: req.TargetResolutionTimeMs,
		Enabled:                enabled,
	}

	if err := s.repo.Create(ctx, policy); err != nil {
		return nil, err
	}
	return policy, nil
}

func (s *SLAPolicyService) Get(ctx context.Context, tenantID, id string) (*models.SLAPolicy, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *SLAPolicyService) List(ctx context.Context, tenantID string, enabled *bool) ([]models.SLAPolicy, error) {
	return s.repo.List(ctx, tenantID, enabled)
}

func (s *SLAPolicyService) Update(ctx context.Context, tenantID, id string, req *models.UpdateSLAPolicyRequest) (*models.SLAPolicy, error) {
	existing, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}

	if req.Name != "" {
		existing.Name = req.Name
	}
	if req.Description != "" {
		existing.Description = req.Description
	}
	if req.Priority != "" {
		existing.Priority = req.Priority
	}
	if req.TargetResponseTimeMs != nil {
		existing.TargetResponseTimeMs = *req.TargetResponseTimeMs
	}
	if req.TargetResolutionTimeMs != nil {
		existing.TargetResolutionTimeMs = *req.TargetResolutionTimeMs
	}
	if req.Enabled != nil {
		existing.Enabled = *req.Enabled
	}

	if err := s.repo.Update(ctx, existing); err != nil {
		return nil, err
	}
	return existing, nil
}

func (s *SLAPolicyService) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}

func (s *SLAPolicyService) GetCompliance(ctx context.Context, tenantID, policyID string, start, end time.Time) (*models.SLAComplianceDetail, error) {
	return s.repo.GetCompliance(ctx, tenantID, policyID, start, end)
}

func (s *SLAPolicyService) GetTicketStatus(ctx context.Context, tenantID, ticketID string) (*models.TicketSLAStatus, error) {
	return s.repo.GetTicketSLAStatus(ctx, tenantID, ticketID)
}
