package service

//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/ai-gateway/models"
	"orion/platform-svc-go/internal/ai/llm-provider"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Create(ctx context.Context, tenantID string, resp *models.GatewayResponse) (*models.GatewayResponse, error)
	GetByID(ctx context.Context, tenantID, id string) (*models.GatewayResponse, error)
	List(ctx context.Context, tenantID string, q models.ListQuery) ([]models.GatewayResponse, int, error)
}

var (
	ErrBadRequest = errors.New("invalid request")
)

type Service struct {
	repo     RepositoryInterface
	provider *llmprovider.ProviderRegistry
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// WithLLMProvider sets the LLM provider registry used by the ai-gateway service.
func (s *Service) WithLLMProvider(provider *llmprovider.ProviderRegistry) {
	s.provider = provider
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

// Chat delegates a chat completion request to the resolved LLM provider.
func (s *Service) Chat(ctx context.Context, req *models.ChatRequest) (*models.ChatResponse, error) {
	if s.provider == nil {
		return nil, fmt.Errorf("LLM provider registry not configured")
	}
	if req == nil || req.Model == "" {
		return nil, ErrBadRequest
	}
	provider, err := s.provider.Resolve(req.Model)
	if err != nil {
		return nil, err
	}
	llmReq := &llmprovider.ChatRequest{
		Model:       req.Model,
		Messages:    convertMessages(req.Messages),
		Temperature: req.Temperature,
		MaxTokens:   req.MaxTokens,
		TopP:        req.TopP,
	}
	llmResp, err := provider.Chat(ctx, llmReq)
	if err != nil {
		return nil, err
	}
	return &models.ChatResponse{
		Content:      llmResp.Content,
		Model:        llmResp.Model,
		Provider:     string(llmResp.Provider),
		InputTokens:  llmResp.InputTokens,
		OutputTokens: llmResp.OutputTokens,
		TotalTokens:  llmResp.TotalTokens,
		LatencyMs:    llmResp.LatencyMs,
		FinishReason: llmResp.FinishReason,
	}, nil
}

// convertMessages converts ai-gateway model messages to LLM provider messages.
func convertMessages(msgs []models.Message) []llmprovider.Message {
	if msgs == nil {
		return []llmprovider.Message{}
	}
	out := make([]llmprovider.Message, len(msgs))
	for i, m := range msgs {
		out[i] = llmprovider.Message{Role: m.Role, Content: m.Content}
	}
	return out
}

// ListModels returns the list of registered LLM providers and their enabled state.
func (s *Service) ListModels() []models.ProviderModel {
	if s.provider == nil {
		return []models.ProviderModel{}
	}
	names := s.provider.Providers()
	out := make([]models.ProviderModel, 0, len(names))
	for _, name := range names {
		enabled := s.provider.IsEnabled(name)
		out = append(out, models.ProviderModel{
			Provider: string(name),
			Enabled:  enabled,
		})
	}
	return out
}
