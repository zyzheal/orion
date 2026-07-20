package service
//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"errors"
	"strings"

	"orion/platform-svc-go/internal/contract/models"
	"orion/platform-svc-go/internal/contract/repository"
	"orion/go-common/pkg/sentinel"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	CreateContract(ctx context.Context, contract *models.Contract) error
	CreateEndpoint(ctx context.Context, endpoint *models.Endpoint) error
	DeleteContract(ctx context.Context, tenantID, id string) (bool, error)
	DeleteEndpoint(ctx context.Context, tenantID, contractID, id string) (bool, error)
	GetContractByID(ctx context.Context, tenantID, id string) (*models.Contract, error)
	GetStats(ctx context.Context, tenantID string) (*models.ContractStats, error)
	ListContracts(ctx context.Context, tenantID string, filter *models.ContractFilter) ([]models.Contract, error)
	ListEndpointsByContract(ctx context.Context, tenantID, contractID string) ([]models.Endpoint, error)
	UpdateContract(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.Contract, error)
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

// --- Contract ---

func (s *Service) ListContracts(ctx context.Context, tenantID string, filter *models.ContractFilter) ([]models.Contract, error) {
	return s.repo.ListContracts(ctx, tenantID, filter)
}

func (s *Service) GetContract(ctx context.Context, tenantID, id string) (*models.Contract, error) {
	c, err := s.repo.GetContractByID(ctx, tenantID, id)
	if err != nil {
		return nil, sentinel.NotFound
	}
	return c, nil
}

func (s *Service) CreateContract(ctx context.Context, tenantID string, req *models.CreateContractRequest) (*models.Contract, error) {
	if req == nil || strings.TrimSpace(req.Name) == "" || strings.TrimSpace(req.Version) == "" {
		return nil, ErrBadRequest
	}
	contract := &models.Contract{
		TenantID:    tenantID,
		Name:        req.Name,
		Description: req.Description,
		Version:     req.Version,
		Status:      "draft",
	}
	if err := s.repo.CreateContract(ctx, contract); err != nil {
		return nil, err
	}
	return contract, nil
}

func (s *Service) UpdateContract(ctx context.Context, tenantID, id string, req *models.UpdateContractRequest) (*models.Contract, error) {
	if req == nil {
		return nil, ErrBadRequest
	}
	updates := make(map[string]interface{})
	if req.Name != nil && *req.Name != "" {
		updates["name"] = *req.Name
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.Version != nil && *req.Version != "" {
		updates["version"] = *req.Version
	}
	if req.Status != nil {
		status := *req.Status
		if status != "draft" && status != "published" && status != "deprecated" && status != "archived" {
			return nil, ErrBadRequest
		}
		updates["status"] = status
	}
	updated, err := s.repo.UpdateContract(ctx, tenantID, id, updates)
	if err != nil {
		return nil, sentinel.NotFound
	}
	return updated, nil
}

func (s *Service) DeleteContract(ctx context.Context, tenantID, id string) error {
	deleted, err := s.repo.DeleteContract(ctx, tenantID, id)
	if err != nil {
		return err
	}
	if !deleted {
		return sentinel.NotFound
	}
	return nil
}

// --- Endpoint ---

func (s *Service) CreateEndpoint(ctx context.Context, tenantID string, contractID string, req *models.CreateEndpointRequest) (*models.Endpoint, error) {
	if req == nil || strings.TrimSpace(req.Path) == "" || strings.TrimSpace(req.Method) == "" {
		return nil, ErrBadRequest
	}
	_, err := s.GetContract(ctx, tenantID, contractID)
	if err != nil {
		return nil, sentinel.NotFound
	}
	method := strings.ToUpper(req.Method)
	authRequired := false
	if req.AuthRequired != nil {
		authRequired = *req.AuthRequired
	}
	endpoint := &models.Endpoint{
		ContractID:     contractID,
		Path:           req.Path,
		Method:         method,
		Summary:        req.Summary,
		RequestSchema:  req.RequestSchema,
		ResponseSchema: req.ResponseSchema,
		AuthRequired:   authRequired,
	}
	if err := s.repo.CreateEndpoint(ctx, endpoint); err != nil {
		return nil, err
	}
	return endpoint, nil
}

func (s *Service) ListEndpoints(ctx context.Context, tenantID, contractID string) ([]models.Endpoint, error) {
	return s.repo.ListEndpointsByContract(ctx, tenantID, contractID)
}

func (s *Service) DeleteEndpoint(ctx context.Context, tenantID, contractID, id string) error {
	deleted, err := s.repo.DeleteEndpoint(ctx, tenantID, contractID, id)
	if err != nil {
		return err
	}
	if !deleted {
		return sentinel.NotFound
	}
	return nil
}

// --- Stats ---

func (s *Service) GetStats(ctx context.Context, tenantID string) (*models.ContractStats, error) {
	return s.repo.GetStats(ctx, tenantID)
}
