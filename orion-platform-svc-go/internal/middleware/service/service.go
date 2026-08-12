package service

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"orion/platform-svc-go/internal/middleware"
	"orion/platform-svc-go/internal/middleware/handler/models"
	"orion/platform-svc-go/internal/middleware/repository"
)

var ErrConfigNotFound = errors.New("middleware: config not found")

type Service struct {
	repo           *repository.Repository
	mu             sync.RWMutex
	rateLimitStore *middleware.RateLimitStore
	defaultTimeout time.Duration
	tracingEnabled bool
	tenantConfig   map[string]*models.RateLimitConfig
}

func NewService(repo *repository.Repository) *Service {
	return &Service{
		repo:           repo,
		rateLimitStore: middleware.NewRateLimitStore(),
		defaultTimeout: 30 * time.Second,
		tracingEnabled: true,
		tenantConfig:   make(map[string]*models.RateLimitConfig),
	}
}

func (s *Service) RegisterRateLimit(ctx context.Context, tenantID string, req *models.RateLimitConfig) error {
	s.mu.Lock()
	s.tenantConfig[tenantID] = req
	s.mu.Unlock()

	endpointLimits := make(map[string]*middleware.EndpointLimit)
	for _, e := range req.Endpoints {
		endpointLimits[e.Path] = &middleware.EndpointLimit{
			RequestsPerMin: req.Rate,
			Burst:          req.Burst,
		}
	}
	cfg := &middleware.RateLimitConfig{
		RequestsPerMin: req.Rate,
		Burst:          req.Burst,
		EndpointLimits: endpointLimits,
	}
	s.rateLimitStore.RegisterConfig(tenantID, cfg)

	if s.repo != nil {
		if err := s.repo.SaveConfig(ctx, tenantID, &repository.TenantConfig{
			TenantID:       tenantID,
			Name:           "rate-limit",
			DefaultTimeout: int64(s.defaultTimeout / time.Millisecond),
			TracingEnabled: s.tracingEnabled,
		}); err != nil {
			return fmt.Errorf("persist rate limit config: %w", err)
		}
	}
	return nil
}

func (s *Service) GetRateLimit(ctx context.Context, tenantID string) (*models.RateLimitConfig, error) {
	s.mu.RLock()
	cfg, ok := s.tenantConfig[tenantID]
	s.mu.RUnlock()
	if !ok {
		return nil, ErrConfigNotFound
	}
	return cfg, nil
}

func (s *Service) UpdateMiddleware(ctx context.Context, tenantID string, req *models.MiddlewareUpdateRequest) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if req.Timeout != "" {
		if d, err := time.ParseDuration(req.Timeout); err == nil {
			s.defaultTimeout = d
		}
	}
	if req.RateLimitConfig != nil {
		s.tenantConfig[tenantID] = req.RateLimitConfig
	}
	return nil
}

func (s *Service) GetStats(ctx context.Context, tenantID string) *models.MiddlewareStats {
	s.mu.RLock()
	defer s.mu.RUnlock()
	cfg, ok := s.tenantConfig[tenantID]
	epCount := 0
	if ok {
		epCount = len(cfg.Endpoints)
	}
	return &models.MiddlewareStats{
		RateLimitEndpoints: epCount,
		TimeoutDefault:     s.defaultTimeout.String(),
		TracingEnabled:     s.tracingEnabled,
	}
}

func (s *Service) SetTimeout(ctx context.Context, tenantID string, timeout time.Duration) {
	s.mu.Lock()
	s.defaultTimeout = timeout
	s.mu.Unlock()
}

func (s *Service) GenerateTraceID(ctx context.Context, tenantID string) string {
	return middleware.GetTraceIDFromCtx(ctx)
}
