package service
//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"orion/platform-svc-go/internal/do-not-disturb/models"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Create(ctx context.Context, dnd *models.DoNotDisturb) error
	GetByUser(ctx context.Context, tenantID, userID string) (*models.DoNotDisturb, error)
	IsDNDActive(ctx context.Context, tenantID, userID string) (bool, error)
	Update(ctx context.Context, tenantID, userID string, updates map[string]interface{}) (*models.DoNotDisturb, error)
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

func (s *Service) Create(ctx context.Context, tenantID, userID string, req *models.CreateDoNotDisturbRequest) (*models.DoNotDisturb, error) {
	dnd := &models.DoNotDisturb{
		TenantID:  tenantID,
		UserID:    userID,
		Enabled:   req.Enabled,
		StartHour: req.StartHour,
		EndHour:   req.EndHour,
		Timezone:  req.Timezone,
		Weekdays:  req.Weekdays,
	}
	if err := s.repo.Create(ctx, dnd); err != nil {
		return nil, err
	}
	return dnd, nil
}

func (s *Service) Get(ctx context.Context, tenantID, userID string) (*models.DoNotDisturb, error) {
	return s.repo.GetByUser(ctx, tenantID, userID)
}

func (s *Service) Update(ctx context.Context, tenantID, userID string, req *models.UpdateDoNotDisturbRequest) (*models.DoNotDisturb, error) {
	updates := make(map[string]interface{})
	if req.Enabled != nil {
		updates["enabled"] = *req.Enabled
	}
	if req.StartHour != nil {
		updates["start_hour"] = *req.StartHour
	}
	if req.EndHour != nil {
		updates["end_hour"] = *req.EndHour
	}
	if req.Timezone != nil {
		updates["timezone"] = *req.Timezone
	}
	if req.Weekdays != nil {
		updates["weekdays"] = req.Weekdays
	}
	return s.repo.Update(ctx, tenantID, userID, updates)
}

func (s *Service) IsActive(ctx context.Context, tenantID, userID string) (bool, error) {
	return s.repo.IsDNDActive(ctx, tenantID, userID)
}
