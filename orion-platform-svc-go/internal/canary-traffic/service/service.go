package service

import (
	"context"
	"errors"

	"orion/platform-svc-go/internal/canary-traffic/models"
	"orion/platform-svc-go/internal/canary-traffic/repository"
)

var (
	ErrNotFound      = errors.New("canary traffic not found")
	ErrInvalidWeights = errors.New("control_weight + canary_weight must not exceed 100")
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Create(ctx context.Context, req *models.CreateRequest, tenantID string) (*models.CanaryTraffic, error) {
	weights := req.ControlWeight + req.CanaryWeight
	if weights > 100 {
		return nil, ErrInvalidWeights
	}
	cb := &models.CanaryTraffic{
		TenantID:        tenantID,
		Name:            req.Name,
		ServiceName:     req.ServiceName,
		Strategy:        req.Strategy,
		ControlPlaneURL: req.ControlPlaneURL,
		CanaryURL:       req.CanaryURL,
		ControlWeight:   req.ControlWeight,
		CanaryWeight:    req.CanaryWeight,
		TargetWeight:    req.TargetWeight,
		HealthEndpoint:  req.HealthEndpoint,
		MetricsEndpoint: req.MetricsEndpoint,
	}
	if cb.Strategy == "" {
		cb.Strategy = "linear"
	}
	if cb.ControlWeight == 0 && cb.CanaryWeight == 0 {
		cb.ControlWeight = 100
	}
	if cb.TargetWeight <= 0 {
		cb.TargetWeight = 100
	}
	if err := s.repo.Create(ctx, tenantID, cb); err != nil {
		return nil, err
	}
	return cb, nil
}

func (s *Service) Get(ctx context.Context, id, tenantID string) (*models.CanaryTraffic, error) {
	cb, err := s.repo.GetByID(ctx, id, tenantID)
	if err != nil {
		return nil, ErrNotFound
	}
	return cb, nil
}

func (s *Service) List(ctx context.Context, tenantID string) ([]models.CanaryTraffic, error) {
	entities, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	if entities == nil {
		entities = []models.CanaryTraffic{}
	}
	return entities, nil
}

func (s *Service) Update(ctx context.Context, id, tenantID string, req *models.UpdateRequest) (*models.CanaryTraffic, error) {
	_, err := s.repo.GetByID(ctx, id, tenantID)
	if err != nil {
		return nil, ErrNotFound
	}
	attrs := make(map[string]interface{})
	if req.Name != nil {
		attrs["name"] = *req.Name
	}
	if req.ServiceName != nil {
		attrs["service_name"] = *req.ServiceName
	}
	if req.Strategy != nil {
		attrs["strategy"] = *req.Strategy
	}
	if req.ControlWeight != nil {
		attrs["control_weight"] = *req.ControlWeight
	}
	if req.CanaryWeight != nil {
		attrs["canary_weight"] = *req.CanaryWeight
	}
	if req.TargetWeight != nil {
		attrs["target_weight"] = *req.TargetWeight
	}
	if req.Status != nil {
		attrs["status"] = string(*req.Status)
	}
	if req.Enabled != nil {
		attrs["enabled"] = *req.Enabled
	}
	return s.repo.Update(ctx, id, tenantID, attrs)
}

func (s *Service) Delete(ctx context.Context, id, tenantID string) (bool, error) {
	return s.repo.Delete(ctx, id, tenantID)
}

func (s *Service) AdjustWeight(ctx context.Context, id, tenantID string, canaryWeight int) (*models.CanaryTraffic, error) {
	cb, err := s.repo.GetByID(ctx, id, tenantID)
	if err != nil {
		return nil, ErrNotFound
	}
	if canaryWeight < 0 || canaryWeight > 100 {
		return nil, errors.New("canary_weight must be between 0 and 100")
	}
	_ = cb // validate existence before update
	controlWeight := 100 - canaryWeight
	if controlWeight < 0 {
		return nil, ErrInvalidWeights
	}
	return s.repo.Update(ctx, id, tenantID, map[string]interface{}{
		"control_weight": controlWeight,
		"canary_weight":  canaryWeight,
	})
}

func (s *Service) GetTrafficSplit(ctx context.Context, id, tenantID string) (*models.TrafficSplit, error) {
	cb, err := s.repo.GetByID(ctx, id, tenantID)
	if err != nil {
		return nil, ErrNotFound
	}
	return &models.TrafficSplit{
		ControlWeight: cb.ControlWeight,
		CanaryWeight:  cb.CanaryWeight,
	}, nil
}
