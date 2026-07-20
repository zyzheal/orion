package service

import (
	"context"
	"errors"
	"strings"

	"orion/platform-svc-go/internal/api-consumption/models"
	"orion/platform-svc-go/internal/api-consumption/repository"
	"orion/go-common/pkg/sentinel"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	CreateConsumption(ctx context.Context, cons *models.Consumption) error
	CreateLimit(ctx context.Context, limit *models.Limit) error
	DeleteLimit(ctx context.Context, tenantID, id string) (bool, error)
	GetLimitByID(ctx context.Context, tenantID, id string) (*models.Limit, error)
	GetStats(ctx context.Context, tenantID string) (*models.ConsumptionStats, error)
	ListConsumptions(ctx context.Context, tenantID string, filter *models.ConsumptionFilter) ([]models.Consumption, error)
	ListLimits(ctx context.Context, tenantID string) ([]models.Limit, error)
	UpdateLimit(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.Limit, error)
}

var (

	ErrBadRequest = errors.New("bad request")
)

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

func IsNotFound(err error) bool {
	return errors.Is(err, sentinel.NotFound) || errors.Is(err, sentinel.NotFound)
}

func IsBadRequest(err error) bool {
	return errors.Is(err, ErrBadRequest)
}

// --- Consumption ---

func (s *Service) ListConsumptions(ctx context.Context, tenantID string, filter *models.ConsumptionFilter) ([]models.Consumption, error) {
	return s.repo.ListConsumptions(ctx, tenantID, filter)
}

func (s *Service) CreateConsumption(ctx context.Context, tenantID string, req *models.CreateConsumptionRequest) (*models.Consumption, error) {
	if req == nil || strings.TrimSpace(req.APIKeyID) == "" || strings.TrimSpace(req.EndpointPath) == "" || strings.TrimSpace(req.Method) == "" || strings.TrimSpace(req.Date) == "" {
		return nil, ErrBadRequest
	}
	method := strings.ToUpper(req.Method)
	if method != "GET" && method != "POST" && method != "PUT" && method != "DELETE" && method != "PATCH" {
		return nil, ErrBadRequest
	}
	cons := &models.Consumption{
		TenantID:         tenantID,
		APIKeyID:         req.APIKeyID,
		EndpointPath:     req.EndpointPath,
		Method:           method,
		RequestCount:     req.RequestCount,
		ErrorCount:       req.ErrorCount,
		BytesTransferred: req.BytesTransferred,
		Date:             req.Date,
	}
	if err := s.repo.CreateConsumption(ctx, cons); err != nil {
		return nil, err
	}
	return cons, nil
}

// --- Limits ---

func (s *Service) ListLimits(ctx context.Context, tenantID string) ([]models.Limit, error) {
	return s.repo.ListLimits(ctx, tenantID)
}

func (s *Service) GetLimit(ctx context.Context, tenantID, id string) (*models.Limit, error) {
	limit, err := s.repo.GetLimitByID(ctx, tenantID, id)
	if err != nil {
		return nil, sentinel.NotFound
	}
	return limit, nil
}

func (s *Service) CreateLimit(ctx context.Context, tenantID string, req *models.CreateLimitRequest) (*models.Limit, error) {
	if req == nil || strings.TrimSpace(req.APIKeyID) == "" || strings.TrimSpace(req.Period) == "" || req.LimitCount <= 0 {
		return nil, ErrBadRequest
	}
	period := req.Period
	if period != "daily" && period != "monthly" && period != "yearly" {
		return nil, ErrBadRequest
	}
	limit := &models.Limit{
		TenantID:     tenantID,
		APIKeyID:     req.APIKeyID,
		EndpointPath: req.EndpointPath,
		Method:       req.Method,
		LimitCount:   req.LimitCount,
		Period:       period,
		LimitAmount:  req.LimitAmount,
		LimitBytes:   req.LimitBytes,
	}
	if err := s.repo.CreateLimit(ctx, limit); err != nil {
		return nil, err
	}
	return limit, nil
}

func (s *Service) UpdateLimit(ctx context.Context, tenantID, id string, req *models.UpdateLimitRequest) (*models.Limit, error) {
	if req == nil {
		return nil, ErrBadRequest
	}
	updates := make(map[string]interface{})
	if req.EndpointPath != nil {
		updates["endpoint_path"] = *req.EndpointPath
	}
	if req.Method != nil {
		updates["method"] = *req.Method
	}
	if req.LimitCount != nil && *req.LimitCount > 0 {
		updates["limit_count"] = *req.LimitCount
	}
	if req.Period != nil {
		period := *req.Period
		if period != "daily" && period != "monthly" && period != "yearly" {
			return nil, ErrBadRequest
		}
		updates["period"] = period
	}
	if req.LimitAmount != nil {
		updates["limit_amount"] = *req.LimitAmount
	}
	if req.LimitBytes != nil {
		updates["limit_bytes"] = *req.LimitBytes
	}
	updated, err := s.repo.UpdateLimit(ctx, tenantID, id, updates)
	if err != nil {
		return nil, sentinel.NotFound
	}
	return updated, nil
}

func (s *Service) DeleteLimit(ctx context.Context, tenantID, id string) error {
	deleted, err := s.repo.DeleteLimit(ctx, tenantID, id)
	if err != nil {
		return err
	}
	if !deleted {
		return sentinel.NotFound
	}
	return nil
}

// --- Stats ---

func (s *Service) GetStats(ctx context.Context, tenantID string) (*models.ConsumptionStats, error) {
	return s.repo.GetStats(ctx, tenantID)
}
