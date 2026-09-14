package repository

import (
	"context"
	"time"

	"orion/platform-svc-go/internal/capability/models"
)

// RepositoryInterface defines the contract for capability data access.
//
// Every ID is a string: the capability, temporary-permission and
// permission-request tables all have UUID primary keys, so an int id produced
// "pq: invalid input syntax for type uuid: \"1\"".
//
// tools/generate_service_interface.go globs only internal/**/repository/
// repository.go and skips any package that already has an *_interface.go, so
// this file is not regenerated -- it was hand-edited alongside the repository.
type RepositoryInterface interface {
	ApprovePermissionRequest(ctx context.Context, tenantID, ticketID, approverID string) error
	CheckPermission(ctx context.Context, tenantID, capabilityID, userID string, userRoles []string) (bool, string, error)
	CleanupExpiredTemporaryPermissions(ctx context.Context, tenantID string) (int, error)
	Create(ctx context.Context, m *models.Capability) error
	CreatePermissionRequest(ctx context.Context, tenantID, userID, capabilityID, reason string, durationHours *int, envSuffix *string) error
	Delete(ctx context.Context, tenantID, id string) error
	GetActiveTempExpiry(ctx context.Context, tenantID, capabilityID, userID string) (*time.Time, error)
	GetActiveTemporaryPermissions(ctx context.Context, tenantID, userID string) ([]models.TemporaryPermission, error)
	GetByID(ctx context.Context, tenantID, id string) (*models.Capability, error)
	GetCapabilityIDForCommand(ctx context.Context, tenantID, command, action, env string) (string, error)
	GetParent(ctx context.Context, tenantID, capabilityID string) (*models.Capability, error)
	GetPermissionRequestByID(ctx context.Context, tenantID string, ticketID string) (*models.PermissionRequest, error)
	GetTemporaryPermissionByID(ctx context.Context, tenantID string, id string) (*models.TemporaryPermission, error)
	GetUserGrantExpiry(ctx context.Context, tenantID, capabilityID, userID string) (*time.Time, error)
	GetUserPermissionRequests(ctx context.Context, tenantID, userID string) ([]models.PermissionRequest, error)
	GrantCapabilityToRole(ctx context.Context, tenantID, capabilityID, roleName string) error
	GrantCapabilityToUser(ctx context.Context, tenantID, capabilityID, userID, grantedBy string, expiresInHours *int) error
	GrantTemporaryPermission(ctx context.Context, tenantID, userID, capabilityID, grantedBy, reason string, envSuffix *string, expiresInHours int) error
	HasChildren(ctx context.Context, tenantID, capabilityID string) (bool, error)
	InsertAuditLog(ctx context.Context, tenantID, action, userID, targetType, targetID, details string) error
	InsertCommandMapping(ctx context.Context, tenantID, capabilityID, commandName, commandAction string, envSuffix *string) error
	List(ctx context.Context, tenantID string, limit, offset int) ([]models.Capability, error)
	ListAuditLogs(ctx context.Context, tenantID string, q *models.AuditLogQuery) ([]models.AuditLog, error)
	ListByCategory(ctx context.Context, tenantID, category string, limit, offset int) ([]models.Capability, error)
	ListByParent(ctx context.Context, tenantID, parentCapabilityID string) ([]models.Capability, error)
	ListCapabilityIDsByRole(ctx context.Context, tenantID, role string) ([]string, error)
	ListCapabilityIDsByUser(ctx context.Context, tenantID, userID string) ([]string, error)
	ListRoot(ctx context.Context, tenantID string) ([]models.Capability, error)
	RejectPermissionRequest(ctx context.Context, tenantID, ticketID, rejecterID string, reason *string) error
	RevokeCapabilityFromRole(ctx context.Context, tenantID, capabilityID, roleName string) error
	RevokeCapabilityFromUser(ctx context.Context, tenantID, capabilityID, userID string) error
	RevokeTemporaryPermissionByID(ctx context.Context, tenantID, id string) error
	Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) error
}

var _ RepositoryInterface = (*Repository)(nil)
