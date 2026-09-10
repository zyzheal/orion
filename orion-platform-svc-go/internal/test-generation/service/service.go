package service

//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"fmt"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/test-generation/models"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Create(ctx context.Context, tenantID string, req models.CreateRequest) (*models.Record, error)
	Delete(ctx context.Context, tenantID, id string) error
	GetByID(ctx context.Context, tenantID, id string) (*models.Record, error)
	List(ctx context.Context, tenantID string) ([]models.Record, error)
	Update(ctx context.Context, tenantID, id string, req models.CreateRequest) (*models.Record, error)
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

func (s *Service) List(ctx context.Context, tenantID string) ([]models.Record, error) {
	return s.repo.List(ctx, tenantID)
}

func (s *Service) Get(ctx context.Context, tenantID, id string) (*models.Record, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) Create(ctx context.Context, tenantID string, req models.CreateRequest) (*models.Record, error) {
	return s.repo.Create(ctx, tenantID, req)
}

func (s *Service) Update(ctx context.Context, tenantID, id string, req models.CreateRequest) (*models.Record, error) {
	return s.repo.Update(ctx, tenantID, id, req)
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}

func (s *Service) GenerateTests(ctx context.Context, tenantID, id string) (gin.H, error) {
	rec, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	// Update status to indicate test generation is in progress
	req := models.CreateRequest{
		Name:   rec.Name,
		Status: "generating",
		Config: rec.Metadata,
	}
	updated, err := s.repo.Update(ctx, tenantID, id, req)
	if err != nil {
		return nil, err
	}
	return gin.H{
		"id":         updated.ID,
		"name":       updated.Name,
		"status":     updated.Status,
		"updatedAt":  updated.UpdatedAt,
	}, nil
}

func (s *Service) GetResults(ctx context.Context, tenantID, id string) ([]string, error) {
	rec, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	// Extract results from metadata
	results := []string{}
	if rec.Metadata != nil {
		if v, ok := rec.Metadata["results"]; ok {
			if slice, ok := v.([]interface{}); ok {
				for _, item := range slice {
					results = append(results, fmt.Sprintf("%v", item))
		}
			} else if s, ok := v.(string); ok {
				results = append(results, s)
			}
		}
	}
	return results, nil
}

func (s *Service) ListTemplates(ctx context.Context, tenantID string) (map[string]interface{}, error) {
	records, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	names := make([]string, len(records))
	for i, r := range records {
		names[i] = r.Name
	}
	return map[string]interface{}{
		"data":  names,
		"total": len(names),
	}, nil
}

func (s *Service) Regenerate(ctx context.Context, tenantID, id string) (gin.H, error) {
	rec, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	req := models.CreateRequest{
		Name:   rec.Name,
		Status: "regenerating",
		Config: rec.Metadata,
	}
	updated, err := s.repo.Update(ctx, tenantID, id, req)
	if err != nil {
		return nil, err
	}
	return gin.H{
		"id":        updated.ID,
		"name":      updated.Name,
		"status":    updated.Status,
		"updatedAt": updated.UpdatedAt,
		"message":   "regenerated",
	}, nil
}
