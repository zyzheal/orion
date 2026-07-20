package service

import (
	"context"
	"errors"
	"time"

	"orion/platform-svc-go/internal/ai-gateway/models"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Create(ctx context.Context, tenantID string, resp *models.GatewayResponse) (*models.GatewayResponse, error)
	GetByID(ctx context.Context, tenantID, id string) (*models.GatewayResponse, error)
	List(ctx context.Context, tenantID string, q models.ListQuery) ([]models.GatewayResponse, int, error)
}

var (
	ErrNotFound   = errors.New("gateway request not found")
	ErrBadRequest = errors.New("invalid request")
)

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// RecordRequest logs a gateway request/response pair with validation.
func (s *Service) RecordRequest(ctx context.Context, tenantID string, req *models.GatewayRequest) (*models.GatewayResponse, error) {
	if req.Model == "" {
		return nil, ErrBadRequest
	}
	if req.Input == "" {
		return nil, ErrBadRequest
	}
	resp := &models.GatewayResponse{
		Model:     req.Model,
		Provider:  req.Provider,
		Input:     req.Input,
		CreatedAt: time.Now().UTC(),
	}
	return s.repo.Create(ctx, tenantID, resp)
}

// GetRequest retrieves a gateway request by ID.
func (s *Service) GetRequest(ctx context.Context, tenantID, id string) (*models.GatewayResponse, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

// ListRequests returns gateway requests with optional provider filtering.
func (s *Service) ListRequests(ctx context.Context, tenantID string, q models.ListQuery) ([]models.GatewayResponse, int, error) {
	return s.repo.List(ctx, tenantID, q)
}

// ListByProvider returns requests filtered by provider.
func (s *Service) ListByProvider(ctx context.Context, tenantID, provider string, limit int) ([]models.GatewayResponse, int, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	return s.repo.List(ctx, tenantID, models.ListQuery{Provider: provider, Limit: limit})
}

// ListRecent returns the N most recent requests.
func (s *Service) ListRecent(ctx context.Context, tenantID string, n int) ([]models.GatewayResponse, int, error) {
	if n <= 0 || n > 100 {
		n = 20
	}
	return s.repo.List(ctx, tenantID, models.ListQuery{Limit: n})
}

// GetByModel returns all requests for a given model (alias for ListRequests with model filter).
func (s *Service) GetByModel(ctx context.Context, tenantID, model string) ([]models.GatewayResponse, int, error) {
	return s.repo.List(ctx, tenantID, models.ListQuery{Provider: model})
}
