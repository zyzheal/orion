package service

import (
	"context"
	"errors"
	"strings"

	"orion/platform-svc-go/internal/contract/models"
	"orion/platform-svc-go/internal/contract/repository"
)

var (
	ErrNotFound = errors.New("not found")
	ErrBadRequest = errors.New("bad request")
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

func IsNotFound(err error) bool {
	return errors.Is(err, ErrNotFound) || errors.Is(err, repository.ErrNotFound)
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
		return nil, ErrNotFound
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
		return nil, ErrNotFound
	}
	return updated, nil
}

func (s *Service) DeleteContract(ctx context.Context, tenantID, id string) error {
	deleted, err := s.repo.DeleteContract(ctx, tenantID, id)
	if err != nil {
		return err
	}
	if !deleted {
		return ErrNotFound
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
		return nil, ErrNotFound
	}
	method := strings.ToUpper(req.Method)
	authRequired := false
	if req.AuthRequired != nil {
		authRequired = *req.AuthRequired
	}
	endpoint := &models.Endpoint{
		ContractID:   contractID,
		Path:         req.Path,
		Method:       method,
		Summary:      req.Summary,
		RequestSchema: req.RequestSchema,
		ResponseSchema: req.ResponseSchema,
		AuthRequired:  authRequired,
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
		return ErrNotFound
	}
	return nil
}

// --- Stats ---

func (s *Service) GetStats(ctx context.Context, tenantID string) (*models.ContractStats, error) {
	return s.repo.GetStats(ctx, tenantID)
}
