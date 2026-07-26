package service

import (
	"context"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/ai/degradation/models"
	"go.uber.org/zap"
)

type DegradationService struct {
	configs  map[string]*models.DegradationConfig
	events   map[string]*models.DegradationEvent
	logger   *zap.Logger
}

func NewDegradationService(logger *zap.Logger) *DegradationService {
	s := &DegradationService{
		configs: make(map[string]*models.DegradationConfig),
		events:  make(map[string]*models.DegradationEvent),
		logger:  logger,
	}

	// Initialize with default configs
	s.configs["ai-gateway"] = &models.DegradationConfig{
		ID:                "ai-gateway",
		ServiceName:       "ai-gateway",
		Level:             models.DegradationLevelNone,
		BackoffMultiplier: 1.0,
		RateLimit:         100,
		TimeoutMultiplier: 1.0,
		Enabled:           true,
		CreatedAt:         time.Now(),
		UpdatedAt:         time.Now(),
	}

	return s
}

// GetLevel returns the degradation level for a service.
func (s *DegradationService) GetLevel(serviceName string) models.DegradationLevel {
	if cfg, ok := s.configs[serviceName]; ok {
		return cfg.Level
	}
	return models.DegradationLevelNone
}

// SetLevel sets the degradation level for a service.
func (s *DegradationService) SetLevel(ctx context.Context, tenantID string, serviceName string, req *models.SetLevelRequest) (*models.DegradationConfig, error) {
	cfg, ok := s.configs[serviceName]
	if !ok {
		now := time.Now()
		cfg = &models.DegradationConfig{
			ID:                serviceName,
			TenantID:          tenantID,
			ServiceName:       serviceName,
	Level:             req.Level,
		Reason:            req.Reason,
		BackoffMultiplier: 1.0,
		RateLimit:         100,
		TimeoutMultiplier: 1.0,
		Enabled:           true,
		CreatedAt:         now,
		UpdatedAt:         now,
		}
		s.configs[serviceName] = cfg
	} else {
		cfg.Level = req.Level
		cfg.Reason = req.Reason
		cfg.UpdatedAt = time.Now()
	}

	// Set appropriate parameters based on level
	switch req.Level {
	case models.DegradationLevelMinor:
		cfg.BackoffMultiplier = 1.5
		cfg.TimeoutMultiplier = 2.0
	case models.DegradationLevelMajor:
		cfg.BackoffMultiplier = 2.0
		cfg.TimeoutMultiplier = 3.0
		cfg.RateLimit = 50
	case models.DegradationLevelCritical:
		cfg.BackoffMultiplier = 5.0
		cfg.TimeoutMultiplier = 5.0
		cfg.RateLimit = 10
	case models.DegradationLevelNone:
		cfg.BackoffMultiplier = 1.0
		cfg.TimeoutMultiplier = 1.0
		cfg.RateLimit = 100
	}

	// Log degradation event
	event := &models.DegradationEvent{
		ID:        fmt.Sprintf("evt_%d", time.Now().UnixNano()),
		TenantID:  tenantID,
		Service:   serviceName,
		Level:     req.Level,
		Message:   fmt.Sprintf("Degradation level set to %s: %s", req.Level, req.Reason),
		TriggeredAt: time.Now(),
	}
	s.events[event.ID] = event

	s.logger.Info("degradation level set",
		zap.String("service", serviceName),
		zap.String("level", string(req.Level)),
		zap.String("reason", req.Reason),
	)

	return cfg, nil
}

// GetConfig returns the degradation config for a service.
func (s *DegradationService) GetConfig(serviceName string) (*models.DegradationConfig, error) {
	cfg, ok := s.configs[serviceName]
	if !ok {
		return nil, fmt.Errorf("config not found for service: %s", serviceName)
	}
	return cfg, nil
}

// QueryConfigs returns all degradation configs.
func (s *DegradationService) QueryConfigs() models.DegradationResponse {
	var resp models.DegradationResponse
	for _, cfg := range s.configs {
		resp.Data = append(resp.Data, *cfg)
	}
	resp.Total = int64(len(resp.Data))
	return resp
}

// Resolve resolves a degradation for a service.
func (s *DegradationService) Resolve(ctx context.Context, tenantID string, serviceName string) (*models.DegradationConfig, error) {
	req := &models.SetLevelRequest{
		Level:  models.DegradationLevelNone,
		Reason: "Manually resolved",
	}
	cfg, err := s.SetLevel(ctx, tenantID, serviceName, req)
	if err != nil {
		return nil, err
	}

	// Mark the latest event as resolved
	for _, event := range s.events {
		if event.Service == serviceName && event.ResolvedAt == nil {
			now := time.Now()
			event.ResolvedAt = &now
			s.logger.Info("degradation resolved",
				zap.String("service", serviceName),
			)
		}
	}

	return cfg, nil
}

// GetBackoffMultiplier returns the backoff multiplier for a service.
func (s *DegradationService) GetBackoffMultiplier(serviceName string) float64 {
	cfg, ok := s.configs[serviceName]
	if ok {
		return cfg.BackoffMultiplier
	}
	return 1.0
}

// GetTimeoutMultiplier returns the timeout multiplier for a service.
func (s *DegradationService) GetTimeoutMultiplier(serviceName string) float64 {
	cfg, ok := s.configs[serviceName]
	if ok {
		return cfg.TimeoutMultiplier
	}
	return 1.0
}

// GetRateLimit returns the rate limit for a service.
func (s *DegradationService) GetRateLimit(serviceName string) int {
	cfg, ok := s.configs[serviceName]
	if ok {
		return cfg.RateLimit
	}
	return 100
}
