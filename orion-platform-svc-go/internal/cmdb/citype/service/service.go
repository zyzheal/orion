package service

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"
	"orion/platform-svc-go/internal/cmdb/citype/models"
	"orion/platform-svc-go/internal/cmdb/citype/repository"
)

type Service struct {
	repo   *repository.Repository
	logger *zap.Logger
}

func NewService(repo *repository.Repository, logger *zap.Logger) *Service {
	return &Service{repo: repo, logger: logger}
}

func (s *Service) CreateCIType(ctx context.Context, tenantID string, req *models.CreateCITypeRequest) (*models.CIType, error) {
	if tenantID == "" {
		tenantID = "default"
	}
	if req.TenantID != nil {
		tenantID = *req.TenantID
	}
	if req.Category == "" {
		req.Category = "default"
	}
	now := time.Now().UTC()
	ct := &models.CIType{
		ID:          uuid.New().String(),
		TenantID:    tenantID,
		Name:        req.Name,
		Description: req.Description,
		Category:    req.Category,
		Icon:        req.Icon,
		Version:     1,
		Enabled:     true,
		Attributes:  req.Attributes,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	if err := s.repo.Create(ctx, &repository.CITypeRow{
		ID: ct.ID, TenantID: ct.TenantID, Name: ct.Name,
		Description: ct.Description, Category: ct.Category,
		Icon: ct.Icon, Version: ct.Version, Enabled: ct.Enabled,
		Attributes: ct.Attributes,
	}); err != nil {
		return nil, fmt.Errorf("create ci type: %w", err)
	}
	s.logger.Info("ci type created", zap.String("id", ct.ID), zap.String("name", ct.Name))
	return ct, nil
}

func (s *Service) GetCIType(ctx context.Context, tenantID, id string) (*models.CIType, error) {
	row, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	return toModel(row), nil
}

func (s *Service) GetCITypeByName(ctx context.Context, tenantID, name string) (*models.CIType, error) {
	row, err := s.repo.GetByName(ctx, tenantID, name)
	if err != nil {
		return nil, err
	}
	return toModel(row), nil
}

func (s *Service) ListCITypes(ctx context.Context, tenantID string) ([]models.CIType, error) {
	rows, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	out := make([]models.CIType, len(rows))
	for i, r := range rows {
		out[i] = *toModel(&r)
	}
	return out, nil
}

func (s *Service) UpdateCIType(ctx context.Context, tenantID, id string, req *models.UpdateCITypeRequest) (*models.CIType, error) {
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
	if req.Icon != nil {
		updates["icon"] = *req.Icon
	}
	if req.Attributes != nil {
		updates["attributes"] = req.Attributes
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
	return s.GetCIType(ctx, tenantID, id)
}

func (s *Service) DeleteCIType(ctx context.Context, tenantID, id string) (bool, error) {
	ok, err := s.repo.Delete(ctx, tenantID, id)
	if err != nil {
		return false, err
	}
	if ok {
		s.logger.Info("ci type deleted", zap.String("id", id))
	}
	return ok, nil
}

func toModel(r *repository.CITypeRow) *models.CIType {
	return &models.CIType{
		ID: r.ID, TenantID: r.TenantID, Name: r.Name,
		Description: r.Description, Category: r.Category,
		Icon: r.Icon, Version: r.Version, Enabled: r.Enabled,
		Attributes: r.Attributes,
		CreatedAt: r.CreatedAt, UpdatedAt: r.UpdatedAt,
	}
}
