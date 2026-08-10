package service

import (
	"context"

	"orion/platform-svc-go/internal/cmdb-attr-handler/models"
	"orion/platform-svc-go/internal/cmdb-attr-handler/repository"
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service { return &Service{repo: repo} }

func (s *Service) Create(ctx context.Context, a *models.CMDBAttributeValue) error { return s.repo.Create(ctx, a) }
func (s *Service) Get(ctx context.Context, tenantID, ciID, attrID string) (*models.CMDBAttributeValue, error) { return s.repo.Get(ctx, tenantID, ciID, attrID) }
func (s *Service) Update(ctx context.Context, tenantID, ciID, attrID, value, attrType string) error { return s.repo.Update(ctx, tenantID, ciID, attrID, value, attrType) }
func (s *Service) Delete(ctx context.Context, tenantID, ciID, attrID string) error { return s.repo.Delete(ctx, tenantID, ciID, attrID) }
func (s *Service) ListByCI(ctx context.Context, tenantID, ciID string, offset, limit int) ([]models.CMDBAttributeValue, error) { return s.repo.ListByCI(ctx, tenantID, ciID, offset, limit) }
func (s *Service) Upsert(ctx context.Context, tenantID, ciID, attrID, value, attrType string) error { return s.repo.Upsert(ctx, tenantID, ciID, attrID, value, attrType) }
func (s *Service) DeleteByCI(ctx context.Context, tenantID, ciID string) error { return s.repo.DeleteByCI(ctx, tenantID, ciID) }
func (s *Service) Exists(ctx context.Context, tenantID, ciID, attrID string) (bool, error) { return s.repo.Exists(ctx, tenantID, ciID, attrID) }
