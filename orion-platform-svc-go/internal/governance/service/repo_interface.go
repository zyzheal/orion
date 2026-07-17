package service

import (
	"context"
	"orion/platform-svc-go/internal/governance/models"
	"orion/platform-svc-go/internal/governance/repository"
)

// GovernanceRepo defines the repository interface for testing.
type GovernanceRepo interface {
	CreatePolicy(ctx context.Context, req *models.CreatePolicyRequest, tenantID, createdBy string) (*models.GovernancePolicy, error)
	GetPolicy(ctx context.Context, id, tenantID string) (*models.GovernancePolicy, error)
	ListPolicies(ctx context.Context, tenantID string, q *models.PolicyListQuery) ([]models.GovernancePolicy, int, error)
	ListPoliciesPaginated(ctx context.Context, tenantID string, q *models.PolicyListQuery, offset, limit int) ([]models.GovernancePolicy, int, error)
	UpdatePolicy(ctx context.Context, id, tenantID string, updates map[string]interface{}) (*models.GovernancePolicy, error)
	DeletePolicy(ctx context.Context, id, tenantID string) error
	UpdatePolicyStatus(ctx context.Context, id, tenantID, status string) (*models.GovernancePolicy, error)
	IncrementApplyCount(ctx context.Context, id, tenantID string) error
	IncrementViolationCount(ctx context.Context, id, tenantID string) error
	CreateAuditLog(ctx context.Context, policyID string, req *repository.AuditLogCreateReq) (*models.GovernanceAuditLog, error)
	GetAuditLogs(ctx context.Context, policyID string, offset, limit int) ([]models.GovernanceAuditLog, int, error)
	CreateComplianceCheck(ctx context.Context, policyID string, req *models.ComplianceCheckRequest) error
	ListRules(ctx context.Context, tenantID string, offset, limit int) ([]models.PolicyRule, int, error)
	GetPolicyStats(ctx context.Context, tenantID string) (*repository.PolicyStats, error)
}
