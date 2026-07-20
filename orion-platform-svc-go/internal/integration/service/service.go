package service

import (
	"context"
	"errors"
	"strings"

	"orion/platform-svc-go/internal/integration/models"
	"orion/platform-svc-go/internal/integration/repository"
	"orion/go-common/pkg/sentinel"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Create(ctx context.Context, item *models.Integration) error
	Delete(ctx context.Context, tenantID, id string) (bool, error)
	GetByID(ctx context.Context, tenantID, id string) (*models.Integration, error)
	List(ctx context.Context, tenantID string) ([]models.Integration, error)
	Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.Integration, error)
}

var (

	ErrBadRequest = errors.New("bad request")
)

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

func IsNotFound(err error) bool {
	return errors.Is(err, sentinel.NotFound) || errors.Is(err, sentinel.NotFound)
}

func IsBadRequest(err error) bool {
	return errors.Is(err, ErrBadRequest)
}

func (s *Service) Create(ctx context.Context, tenantID string, req *models.CreateIntegrationRequest) (*models.Integration, error) {
	if req == nil || strings.TrimSpace(req.Name) == "" {
		return nil, ErrBadRequest
	}
	item := &models.Integration{
		TenantID: tenantID,
		Name:     req.Name,
	}
	if err := s.repo.Create(ctx, item); err != nil {
		return nil, err
	}
	return item, nil
}

func (s *Service) Get(ctx context.Context, tenantID, id string) (*models.Integration, error) {
	item, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, sentinel.NotFound
	}
	return item, nil
}

func (s *Service) List(ctx context.Context, tenantID string) ([]models.Integration, error) {
	return s.repo.List(ctx, tenantID)
}

func (s *Service) Update(ctx context.Context, tenantID, id string, req *models.UpdateIntegrationRequest) (*models.Integration, error) {
	if req == nil {
		return nil, ErrBadRequest
	}
	updates := make(map[string]interface{})
	if req.Name != nil && *req.Name != "" {
		updates["name"] = *req.Name
	}
	updated, err := s.repo.Update(ctx, tenantID, id, updates)
	if err != nil {
		return nil, sentinel.NotFound
	}
	return updated, nil
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	deleted, err := s.repo.Delete(ctx, tenantID, id)
	if err != nil {
		return err
	}
	if !deleted {
		return sentinel.NotFound
	}
	return nil
}
