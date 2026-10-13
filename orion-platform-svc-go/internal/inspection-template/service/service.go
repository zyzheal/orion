package service

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"
	"orion/platform-svc-go/internal/inspection-template/models"
	"orion/platform-svc-go/internal/inspection-template/repository"
)

type Service struct {
	repo   *repository.Repository
	logger *zap.Logger
}

func NewService(repo *repository.Repository, logger *zap.Logger) *Service {
	return &Service{repo: repo, logger: logger}
}

func (s *Service) Create(ctx context.Context, tenantID string, req *models.CreateTemplateRequest) (*models.InspectionTemplate, error) {
	if tenantID == "" {
		tenantID = "default"
	}
	if req.TenantID != nil {
		tenantID = *req.TenantID
	}
	if req.Category == "" {
		req.Category = "system"
	}
	if req.TargetType == "" {
		req.TargetType = "host"
	}
	if req.CreatedBy == "" {
		req.CreatedBy = "system"
	}
	if req.Rules == nil {
		req.Rules = []models.Rule{}
	}

	now := time.Now().UTC()
	template := &models.InspectionTemplate{
		ID:         uuid.New().String(),
		TenantID:   tenantID,
		Name:       req.Name,
		Description: req.Description,
		Category:   req.Category,
		TargetType: req.TargetType,
		Rules:      req.Rules,
		Enabled:    req.Enabled,
		Version:    1,
		CreatedBy:  req.CreatedBy,
		CreatedAt:  now,
		UpdatedAt:  now,
	}

	if err := s.repo.Create(ctx, template); err != nil {
		return nil, fmt.Errorf("create template: %w", err)
	}
	s.logger.Info("inspection template created", zap.String("id", template.ID), zap.String("name", template.Name))
	return template, nil
}

func (s *Service) Get(ctx context.Context, tenantID, id string) (*models.InspectionTemplate, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) List(ctx context.Context, tenantID string) ([]models.InspectionTemplate, error) {
	return s.repo.List(ctx, tenantID)
}

func (s *Service) Update(ctx context.Context, tenantID, id string, req *models.UpdateTemplateRequest) (*models.InspectionTemplate, error) {
	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.Category != nil {
		updates["category"] = *req.Category
	}
	if req.TargetType != nil {
		updates["target_type"] = *req.TargetType
	}
	if req.Rules != nil {
		updates["rules"] = req.Rules
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
