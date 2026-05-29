package service

import (
	"context"
	errors "errors"
	"orion/skill-svc-go/internal/models"
	"orion/skill-svc-go/internal/repository"
	"github.com/google/uuid"
)

var ErrSkillNotFound = errors.New("skill not found")

type Service struct { repo *repository.Repository }
func NewService(repo *repository.Repository) *Service { return &Service{repo: repo} }

func (s *Service) Create(ctx context.Context, tenantID string, req *models.CreateSkillRequest) (*models.Skill, error) {
	d := &models.Skill{ID: uuid.New().String(), TenantID: tenantID, Name: req.Name}
	return d, s.repo.Create(ctx, d)
}

func (s *Service) List(ctx context.Context, tenantID string, offset, limit int) ([]models.Skill, error) {
	return s.repo.List(ctx, tenantID, offset, limit)
}

func (s *Service) GetByID(ctx context.Context, tenantID, id string) (*models.Skill, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}
