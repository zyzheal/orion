package repository

import (
	"time"
	"context"
	"orion/platform-svc-go/internal/capability/models"
)


// RepositoryInterface defines the data access contract for the capability module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
	Create(ctx context.Context, m *models.Capability) error
	GetByCapabilityID(ctx context.Context, tenantID, capabilityID string) (*models.Capability, error)
	GetByID(ctx context.Context, tenantID, id string) (*models.Capability, error)
	List(ctx context.Context, tenantID string, limit, offset int) ([]models.Capability, error)
	ListByCategory(ctx context.Context, tenantID, category string, limit, offset int) ([]models.Capability, error)
	ListRoot(ctx context.Context, tenantID string) ([]models.Capability, error)
	ListByParent(ctx context.Context, tenantID, parentCapabilityID string) ([]models.Capability, error)
	Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) error
	Delete(ctx context.Context, tenantID, id string) error
	HasChildren(ctx context.Context, tenantID, id string) (bool, error)
	GetParent(ctx context.Context, tenantID, parentCapabilityID string) (*models.Capability, error)
	InsertCommandMapping(ctx context.Context, tenantID string, capID string, cmdName, cmdAction string, envSuffix *string) error
	GetCapabilityForCommand(ctx context.Context, tenantID, command, action string, env *string) (*models.Capability, error)
	GetCapabilityIDForCommand(ctx context.Context, tenantID, command, action, env string) (string, error)
	GrantCapabilityToRole(ctx context.Context, tenantID string, capabilityID, roleName string) error
	RevokeCapabilityFromRole(ctx context.Context, tenantID string, capabilityID, roleName string) error
	GrantCapabilityToUser(ctx context.Context, tenantID string, capabilityID, userId, grantedBy string, expiresInHours *int) error
	RevokeCapabilityFromUser(ctx context.Context, tenantID string, capabilityID, userId string) error
	ListCapabilityIDsByRole(ctx context.Context, tenantID, role string) ([]string, error)
	ListCapabilityIDsByUser(ctx context.Context, tenantID, userID string) ([]string, error)
	GetUserGrantExpiry(ctx context.Context, tenantID, capabilityID, userID string) (*time.Time, error)
	GrantTemporaryPermission(ctx context.Context, tenantID string, userID, capabilityID, grantedBy string, envSuffix *string, expiresInHours int) error
	GetActiveTemporaryPermissions(ctx context.Context, tenantID, userId string) ([]models.TemporaryPermission, error)
	RevokeTemporaryPermissionByID(ctx context.Context, id int, byUserID string) error
	GetTemporaryPermissionByID(ctx context.Context, tenantID string, id int) (*models.TemporaryPermission, error)
	GetActiveTempExpiry(ctx context.Context, tenantID, capabilityID, userID string) (*time.Time, error)
	CleanupExpiredTemporaryPermissions(ctx context.Context, tenantID string) (int, error)
	CreatePermissionRequest(ctx context.Context, tenantID string, userID, capabilityID, reason string, durationHours int, envSuffix *string) error
	GetPermissionRequestByID(ctx context.Context, tenantID string, ticketID int) (*models.PermissionRequest, error)
	GetUserPermissionRequests(ctx context.Context, tenantID, userId string) ([]models.PermissionRequest, error)
	ApprovePermissionRequest(ctx context.Context, ticketID int, approverID string) error
	RejectPermissionRequest(ctx context.Context, ticketID int, rejecterID string, reason *string) error
	CheckPermission(ctx context.Context, tenantID, capabilityID, userID string, userRoles []string) (bool, string, error)
	ListAuditLogs(ctx context.Context, tenantID string, q *models.AuditLogQuery) ([]map[string]interface{}, error)
	GetCapabilityForPermissionRequest(ctx context.Context, tenantID, capabilityID string) (*models.Capability, error)
	InsertAuditLog(ctx context.Context, tenantID, action, userID, targetType, targetID, details string) error
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
