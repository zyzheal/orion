package repository

import (
	"context"
	"orion/platform-svc-go/internal/api-governance/models"
)


// RepositoryInterface defines the data access contract for the api-governance module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
	CreateContract(ctx context.Context, req *models.CreateContractRequest, tenantID string) (*models.Contract, error)
	GetContract(ctx context.Context, id string, tenantID string) (*models.Contract, error)
	ListContracts(ctx context.Context, tenantID string, apiName *string, status *string) ([]models.Contract, error)
	CreateVerification(ctx context.Context, req *models.VerifyRequest, contractID string, passed bool, violations []string, tenantID string) error
	GetVerificationHistory(ctx context.Context, contractID string, tenantID string) ([]models.VerificationHistory, error)
	ListViolations(ctx context.Context, tenantID string, contractID *string, severity *string) ([]models.Violation, error)
	CreateVersion(ctx context.Context, req *models.CreateVersionRequest, tenantID string) (*models.Version, error)
	GetVersion(ctx context.Context, id string, tenantID string) (*models.Version, error)
	ListVersions(ctx context.Context, tenantID string, apiName *string, status *string) ([]models.Version, error)
	UpdateVersion(ctx context.Context, id string, tenantID string, updates map[string]interface{}) (*models.Version, error)
	ListDeprecatedVersions(ctx context.Context, tenantID string) ([]models.Version, error)
	CreateRule(ctx context.Context, req *models.CreateRuleRequest, tenantID string) (*models.Rule, error)
	GetGovernanceStats(ctx context.Context, tenantID string) (models.GovernanceStats, error)
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
