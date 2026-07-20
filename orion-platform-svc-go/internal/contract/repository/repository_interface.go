package repository

import (
	"context"
	"orion/platform-svc-go/internal/contract/models"
)


// RepositoryInterface defines the data access contract for the contract module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
	CreateContract(ctx context.Context, contract *models.Contract) error
	GetContractByID(ctx context.Context, tenantID, id string) (*models.Contract, error)
	ListContracts(ctx context.Context, tenantID string, filter *models.ContractFilter) ([]models.Contract, error)
	UpdateContract(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.Contract, error)
	DeleteContract(ctx context.Context, tenantID, id string) (bool, error)
	CreateEndpoint(ctx context.Context, endpoint *models.Endpoint) error
	ListEndpointsByContract(ctx context.Context, tenantID, contractID string) ([]models.Endpoint, error)
	DeleteEndpoint(ctx context.Context, tenantID, contractID, id string) (bool, error)
	GetStats(ctx context.Context, tenantID string) (*models.ContractStats, error)
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
