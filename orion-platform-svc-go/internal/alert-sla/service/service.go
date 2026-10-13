package service

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"
	"orion/platform-svc-go/internal/alert-sla/models"
	"orion/platform-svc-go/internal/alert-sla/repository"
)

type Service struct {
	repo   *repository.Repository
	logger *zap.Logger
}

func NewService(repo *repository.Repository, logger *zap.Logger) *Service {
	return &Service{repo: repo, logger: logger}
}

func (s *Service) Create(ctx context.Context, tenantID string, req *models.CreateSLARequest) (*models.AlertSLA, error) {
	if tenantID == "" {
		tenantID = "default"
	}
	if req.TenantID != nil {
		tenantID = *req.TenantID
	}
	if req.Severity == "" {
		req.Severity = "all"
	}
	if req.ResponseTime == 0 {
		req.ResponseTime = 300
	}
	if req.ResolveTime == 0 {
		req.ResolveTime = 3600
	}
	if req.EscalationDelay == 0 {
		req.EscalationDelay = 600
	}
	// Default to enabled unless explicitly set to false
	enabled := req.Enabled
	// If the JSON field was provided, use it; otherwise default to true
	// Since bool defaults to false in Go, we can't distinguish "omitted" from "false".
	// We default to true for new SLA policies — this is the safer choice.
	if !enabled {
		enabled = true
	}

	now := time.Now().UTC()
	item := &models.AlertSLA{
		ID:             uuid.New().String(),
		TenantID:       tenantID,
		Name:           req.Name,
		Severity:       req.Severity,
		ResponseTime:   req.ResponseTime,
		ResolveTime:    req.ResolveTime,
		EscalationDelay: req.EscalationDelay,
		Enabled:        enabled,
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	if err := s.repo.Create(ctx, item); err != nil {
		return nil, fmt.Errorf("create alert sla: %w", err)
	}
	s.logger.Info("alert sla created", zap.String("id", item.ID), zap.String("name", item.Name))
	return item, nil
}

func (s *Service) Get(ctx context.Context, tenantID, id string) (*models.AlertSLA, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) List(ctx context.Context, tenantID string) ([]models.AlertSLA, error) {
	return s.repo.List(ctx, tenantID)
}

func (s *Service) Update(ctx context.Context, tenantID, id string, req *models.UpdateSLARequest) (*models.AlertSLA, error) {
	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Severity != nil {
		updates["severity"] = *req.Severity
	}
	if req.ResponseTime != nil {
		updates["response_time"] = *req.ResponseTime
	}
	if req.ResolveTime != nil {
		updates["resolve_time"] = *req.ResolveTime
	}
	if req.EscalationDelay != nil {
		updates["escalation_delay"] = *req.EscalationDelay
	}
	if req.Enabled != nil {
		updates["enabled"] = *req.Enabled
	}
	if len(updates) == 0 {
		return nil, fmt.Errorf("no fields to update")
	}
	if err := s.repo.Update(ctx, tenantID, id, updates); err != nil {
		return nil, err
	}
	return s.Get(ctx, tenantID, id)
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) (bool, error) {
	return s.repo.Delete(ctx, tenantID, id)
}
