package service

import (
	"context"
	"encoding/json"
	"time"

	"orion/platform-svc-go/internal/gateway-dynamic/models"
	"orion/platform-svc-go/internal/gateway-dynamic/repository"
	"orion/platform-svc-go/internal/gateway-dynamic/redis"
)

// GrayReleaseService handles gray release business logic.
type GrayReleaseService struct {
	repo  *repository.GrayReleaseRepository
	redis *redis.Client
}

func NewGrayReleaseService(repo *repository.GrayReleaseRepository, rdb *redis.Client) *GrayReleaseService {
	return &GrayReleaseService{repo: repo, redis: rdb}
}

// Create creates a new gray release configuration for a route.
func (s *GrayReleaseService) Create(ctx context.Context, tenantID, routeID string, req models.GrayReleaseRequest) (*models.GrayReleaseStatusResponse, error) {
	if req.Percentage < 0 || req.Percentage > 100 {
		return nil, models.ErrInvalidPercentage
	}

	targetRef := models.RouteTargetRef{
		ServiceName: req.TargetRef.ServiceName,
		InstanceIDs: req.TargetRef.InstanceIDs,
		Port:        req.TargetRef.Port,
		Weight:      req.Percentage,
		Enabled:     true,
	}

	config := models.GrayReleaseConfig{
		Enabled:     true,
		Strategy:    req.Strategy,
		HeaderValue: req.HeaderValue,
		Percentage:  req.Percentage,
		TargetRef:   &targetRef,
	}

	result, err := s.repo.Create(ctx, tenantID, routeID, config)
	if err != nil {
		return nil, err
	}

	s.publishEvent(ctx, tenantID, routeID, "gray_enable", config.Strategy, req.Percentage)
	return result, nil
}

// Get retrieves the current gray release configuration for a route.
func (s *GrayReleaseService) Get(ctx context.Context, tenantID, routeID string) (*models.GrayReleaseStatusResponse, error) {
	return s.repo.Get(ctx, tenantID, routeID)
}

// Update modifies an existing gray release configuration.
func (s *GrayReleaseService) Update(ctx context.Context, tenantID, routeID string, req models.GrayReleaseUpdateRequest) (*models.GrayReleaseStatusResponse, error) {
	updates := make(map[string]interface{})

	// Build config JSON if any config field changed
	if req.TargetRef != nil || req.Strategy != nil || req.HeaderValue != nil || req.Percentage != nil {
		existing, err := s.repo.Get(ctx, tenantID, routeID)
		if err != nil && err != repository.ErrGrayReleaseNotFound {
			return nil, err
		}

		cfg := models.GrayReleaseConfig{
			Enabled:     true,
			Strategy:    "header",
			HeaderValue: "",
			Percentage:  0,
		}
		if existing != nil {
			cfg.Strategy = existing.Strategy
			cfg.HeaderValue = existing.HeaderValue
			cfg.Percentage = existing.Percentage
			cfg.TargetRef = &existing.TargetRef
			cfg.RollbackRef = &existing.RollbackRef
		}

		if req.Strategy != nil {
			cfg.Strategy = *req.Strategy
		}
		if req.HeaderValue != nil {
			cfg.HeaderValue = *req.HeaderValue
		}
		if req.Percentage != nil {
			cfg.Percentage = *req.Percentage
		}
		if req.TargetRef != nil {
			cfg.TargetRef = req.TargetRef
		}
		if req.RollbackRef != nil {
			cfg.RollbackRef = req.RollbackRef
		}

		cfgJSON, err := json.Marshal(cfg)
		if err != nil {
			return nil, err
		}
		updates["config"] = string(cfgJSON)
	}

	if req.Enabled != nil {
		updates["enabled"] = *req.Enabled
		if *req.Enabled {
			updates["active_since"] = time.Now().UTC()
		}
	}

	return s.repo.Update(ctx, tenantID, routeID, updates)
}

// Enable activates gray release for a route.
func (s *GrayReleaseService) Enable(ctx context.Context, tenantID, routeID string) (*models.GrayReleaseStatusResponse, error) {
	if err := s.repo.Enable(ctx, tenantID, routeID); err != nil {
		return nil, err
	}
	s.publishEvent(ctx, tenantID, routeID, "gray_enable", "percentage", 0)
	return s.repo.Get(ctx, tenantID, routeID)
}

// Disable deactivates gray release for a route.
func (s *GrayReleaseService) Disable(ctx context.Context, tenantID, routeID string) (*models.GrayReleaseStatusResponse, error) {
	if err := s.repo.Disable(ctx, tenantID, routeID); err != nil {
		return nil, err
	}
	s.publishEvent(ctx, tenantID, routeID, "gray_disable", "", 0)
	return s.repo.Get(ctx, tenantID, routeID)
}

// Rollback performs a rollback on a gray release route.
func (s *GrayReleaseService) Rollback(ctx context.Context, tenantID, routeID string) (*models.GrayReleaseStatusResponse, error) {
	if err := s.repo.Rollback(ctx, tenantID, routeID); err != nil {
		return nil, err
	}
	s.publishEvent(ctx, tenantID, routeID, "rollback", "", 0)
	return s.repo.Get(ctx, tenantID, routeID)
}

// Stats returns aggregate gray release stats for a tenant.
func (s *GrayReleaseService) Stats(ctx context.Context, tenantID string) (*models.GrayReleaseStatsResponse, error) {
	return s.repo.ListStats(ctx, tenantID)
}

// publishEvent sends a Redis Pub/Sub event for gray release changes.
func (s *GrayReleaseService) publishEvent(ctx context.Context, tenantID, routeID, event string, strategy string, percentage int) {
	if s.redis == nil {
		return
	}

	eventData := models.RedisPubSubEvent{
		Event:      event,
		RouteID:    routeID,
		TenantID:   tenantID,
		Strategy:   strategy,
		Percentage: percentage,
		Timestamp:  time.Now().UTC(),
	}

	msg, err := json.Marshal(eventData)
	if err != nil {
		return
	}

	s.redis.Publish(ctx, "gateway_gray:"+tenantID, string(msg))
}
