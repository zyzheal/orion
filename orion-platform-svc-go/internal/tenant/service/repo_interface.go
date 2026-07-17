package service

import "context"

// TenantRepo is the repository interface used by the tenant service.
// All signatures match internal/tenant/repository/repository.go exactly.
type TenantRepo interface {
	// --- Tenants ---
	CreateTenant(ctx context.Context, name string, displayName *string, settingsJSON string, status string) (*int, error)
	GetTenantRow(ctx context.Context, id string) (*map[string]any, error)
	ListTenants(ctx context.Context, status *string, limit, offset int) ([]map[string]any, int, error)
	UpdateTenant(ctx context.Context, id string, name *string, displayName *string, status *string, settingsJSON string) error
	DeleteTenant(ctx context.Context, id string) error
	TenantCount(ctx context.Context, status *string) (int, error)

	// --- Tenant users ---
	GetUserTenants(ctx context.Context, userID string) ([]map[string]any, error)
	ListTenantUsers(ctx context.Context, tenantID string) ([]map[string]any, error)
	AddTenantUser(ctx context.Context, tenantID, userID, role string) error
	RemoveTenantUser(ctx context.Context, tenantID, userID string) error
	CountTenantAdmins(ctx context.Context, tenantID string) (int, error)

	// --- Invitations ---
	GetTenantByRow(ctx context.Context, tenantID string) (*map[string]any, error)
	GetPendingInvite(ctx context.Context, tenantID, email string) (*map[string]any, error)
	GetTenantUserByEmail(ctx context.Context, tenantID, email string) (bool, error)
	CreateInvite(ctx context.Context, tenantID, email, role, inviteCode, invitedBy string, expiresAt string) (*map[string]any, error)
	GetInviteByCode(ctx context.Context, code string) (*map[string]any, error)
	UserIsTenantMember(ctx context.Context, tenantID, userID string) (bool, error)
	UpdateInviteStatus(ctx context.Context, status, userID string, id string) error

	// --- Namespace allocations ---
	AllocateNamespace(ctx context.Context, tenantID int, nsName string, purpose string) error
	ReleaseNamespace(ctx context.Context, nsName string) error
	GetTenantNamespaces(ctx context.Context, tenantID string) ([]map[string]any, error)
	NamespaceCount(ctx context.Context, tenantID string) (int, error)
	PoolStatus(ctx context.Context) (*map[string]any, error)

	// --- Quota ---
	GetQuota(ctx context.Context, tenantID int, tenantIDStr string) (*map[string]any, error)

	// --- Alerts ---
	GetTenantQuotaAlerts(ctx context.Context, tenantID string, status *string, limit, offset int) ([]map[string]any, int, error)
	GetAlertStatusCounts(ctx context.Context, tenantID string) ([]map[string]any, error)
	GetAlertResourceCounts(ctx context.Context, tenantID string) ([]map[string]any, error)
	GetActiveAlerts(ctx context.Context, tenantID string, limit int) ([]map[string]any, error)

	// --- Migration helpers (split) ---
	MigrateUserToTenant(ctx context.Context, newTenantID int, userID string) error
	MoveNamespaces(ctx context.Context, newTenantID int, nsName string, oldTenantID int) error
	MovePipeline(ctx context.Context, newTenantID int, pipelineID string, oldTenantID int) error
}
