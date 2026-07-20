package service

import (
	"context"
	"time"

	"orion/platform-svc-go/internal/tracing/models"
	"orion/platform-svc-go/internal/tracing/repository"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	CreateOtelConfig(ctx context.Context, config *models.OtelCollectorConfig) error
	CreateSamplingConfig(ctx context.Context, config *models.TraceSamplingConfig) error
	DeleteOtelConfig(ctx context.Context, tenantID, id string) error
	GetAllSamplingConfigs(ctx context.Context, tenantID string) ([]models.TraceSamplingConfig, error)
	GetOtelConfig(ctx context.Context, tenantID, id string) (*models.OtelCollectorConfig, error)
	GetOtelConfigs(ctx context.Context, tenantID string, configType string) ([]models.OtelCollectorConfig, error)
	GetTrace(ctx context.Context, tenantID, traceID string) ([]models.TraceSpan, error)
	SearchTraces(ctx context.Context, tenantID string, req *models.TraceSearchRequest) ([]models.TraceSpan, error)
	UpdateOtelConfig(ctx context.Context, tenantID, id string, updates map[string]interface{}) error
	UpsertSamplingConfig(ctx context.Context, tenantID, serviceName string, sampleRate float64, maxSpansPerSec int, enabled bool) (*models.TraceSamplingConfig, error)
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

func (s *Service) GetTraceList(ctx context.Context, tenantID string, serviceName string, limit int) ([]models.TraceSpan, error) {
	return s.repo.SearchTraces(ctx, tenantID, &models.TraceSearchRequest{
		ServiceName: serviceName,
		Limit:       limit,
		Offset:      0,
	})
}

func (s *Service) GetTrace(ctx context.Context, tenantID, traceID string) ([]models.TraceSpan, error) {
	return s.repo.GetTrace(ctx, tenantID, traceID)
}

func (s *Service) SearchTraces(ctx context.Context, tenantID string, req *models.TraceSearchRequest) ([]models.TraceSpan, error) {
	return s.repo.SearchTraces(ctx, tenantID, req)
}

func (s *Service) UpsertSamplingConfig(ctx context.Context, tenantID string, req *models.UpsertSamplingRequest) (*models.TraceSamplingConfig, error) {
	existing, err := s.repo.UpsertSamplingConfig(ctx, tenantID, req.ServiceName, req.SampleRate, req.MaxSpansPerSec, req.Enabled)
	if err == repository.ErrNotFound {
		now := time.Now().UTC()
		config := &models.TraceSamplingConfig{
			TenantID:       tenantID,
			ServiceName:    req.ServiceName,
			SampleRate:     req.SampleRate,
			MaxSpansPerSec: req.MaxSpansPerSec,
			Enabled:        req.Enabled,
			CreatedAt:      now,
			UpdatedAt:      now,
		}
		if err := s.repo.CreateSamplingConfig(ctx, config); err != nil {
			return nil, err
		}
		return config, nil
	}
	if err != nil {
		return nil, err
	}
	return existing, nil
}

func (s *Service) GetSamplingConfigs(ctx context.Context, tenantID string) ([]models.TraceSamplingConfig, error) {
	return s.repo.GetAllSamplingConfigs(ctx, tenantID)
}

func (s *Service) GetOtelConfigs(ctx context.Context, tenantID, configType string) ([]models.OtelCollectorConfig, error) {
	return s.repo.GetOtelConfigs(ctx, tenantID, configType)
}

func (s *Service) GetOtelConfig(ctx context.Context, tenantID, id string) (*models.OtelCollectorConfig, error) {
	return s.repo.GetOtelConfig(ctx, tenantID, id)
}

func (s *Service) CreateOtelConfig(ctx context.Context, tenantID string, req *models.CreateOtelRequest) (*models.OtelCollectorConfig, error) {
	now := time.Now().UTC()
	config := &models.OtelCollectorConfig{
		TenantID:    tenantID,
		Name:        req.Name,
		Description: req.Description,
		ConfigType:  req.ConfigType,
		ConfigYaml:  req.ConfigYaml,
		Enabled:     req.Enabled,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	if err := s.repo.CreateOtelConfig(ctx, config); err != nil {
		return nil, err
	}
	return config, nil
}

func (s *Service) UpdateOtelConfig(ctx context.Context, tenantID, id string, req *models.UpdateOtelRequest) (*models.OtelCollectorConfig, error) {
	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.ConfigType != nil {
		updates["config_type"] = *req.ConfigType
	}
	if req.ConfigYaml != nil {
		updates["config_yaml"] = *req.ConfigYaml
	}
	if req.Enabled != nil {
		updates["enabled"] = *req.Enabled
	}
	if err := s.repo.UpdateOtelConfig(ctx, tenantID, id, updates); err != nil {
		return nil, err
	}
	return s.repo.GetOtelConfig(ctx, tenantID, id)
}

func (s *Service) DeleteOtelConfig(ctx context.Context, tenantID, id string) error {
	return s.repo.DeleteOtelConfig(ctx, tenantID, id)
}
