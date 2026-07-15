package service

import (
	"context"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/ai-gateway/models"
	"orion/platform-svc-go/internal/ai-gateway/repository"
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

// SimulateGatewayCall processes a request through the AI gateway (stub implementation).
func (s *Service) SimulateGatewayCall(ctx context.Context, tenantID string, req models.GatewayRequest) (*models.GatewayResponse, error) {
	start := time.Now()
	output := fmt.Sprintf("Simulated response for model=%s provider=%s (input length=%d)", req.Model, req.Provider, len(req.Input))
	latencyMs := time.Since(start).Milliseconds()
	resp := &models.GatewayResponse{
		Model:     req.Model,
		Provider:  req.Provider,
		Input:     req.Input,
		Output:    output,
		Tokens:    len(req.Input) / 4,
		LatencyMs: latencyMs,
		CreatedAt: time.Now().UTC(),
	}
	return s.repo.Create(ctx, tenantID, resp)
}

func (s *Service) GetRequest(ctx context.Context, tenantID, id string) (*models.GatewayResponse, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) ListRequests(ctx context.Context, tenantID string, q models.ListQuery) ([]models.GatewayResponse, int, error) {
	return s.repo.List(ctx, tenantID, q)
}
