package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/monitoring/models"
)

// --- Service Control ------------------------------------------------

func (s *Service) StartService(ctx context.Context, tenantID string) (*models.ServiceHealth, error) {
	if tenantID == "" {
		return nil, errors.New("tenant_id is required")
	}
	if err := s.repo.SetServiceStatus(ctx, tenantID, "running"); err != nil {
		return nil, fmt.Errorf("start service: %w", err)
	}
	return &models.ServiceHealth{
		Status:  "running",
		Uptime:  time.Now().UTC(),
		Message: "monitoring service started",
	}, nil
}

func (s *Service) StopService(ctx context.Context, tenantID string) (*models.ServiceHealth, error) {
	if tenantID == "" {
		return nil, errors.New("tenant_id is required")
	}
	if err := s.repo.SetServiceStatus(ctx, tenantID, "stopped"); err != nil {
		return nil, fmt.Errorf("stop service: %w", err)
	}
	return &models.ServiceHealth{
		Status:  "stopped",
		Uptime:  time.Now().UTC(),
		Message: "monitoring service stopped",
	}, nil
}

func (s *Service) HealthCheck(ctx context.Context, tenantID string) (*models.ServiceHealth, error) {
	// 1. Verify database connectivity with a short timeout.
	pingCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	pingErr := s.repo.PingContext(pingCtx)

	// 2. Read service status from the persistence layer.
	status := "unknown"
	if tenantID != "" {
		if st, err := s.repo.GetServiceStatus(ctx, tenantID); err == nil {
			status = st
		}
	}

	healthy := pingErr == nil && status == "running"
	if pingErr != nil {
		return &models.ServiceHealth{
			Status:  "unhealthy",
			Uptime:  time.Now().UTC(),
			Message: fmt.Sprintf("monitoring service unhealthy: db ping failed: %s", pingErr.Error()),
		}, nil
	}
	if status == "stopped" {
		return &models.ServiceHealth{
			Status:  "stopped",
			Uptime:  time.Now().UTC(),
			Message: "monitoring service is stopped",
		}, nil
	}
	if !healthy {
		return &models.ServiceHealth{
			Status:  "degraded",
			Uptime:  time.Now().UTC(),
			Message: fmt.Sprintf("monitoring service degraded, status=%s", status),
		}, nil
	}
	return &models.ServiceHealth{
		Status:  "healthy",
		Uptime:  time.Now().UTC(),
		Message: "monitoring service is healthy",
	}, nil
}
