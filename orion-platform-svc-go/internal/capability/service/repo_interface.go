package service

import (
	"context"
	"time"

	"orion/platform-svc-go/internal/capability/models"
)

// CapabilityRepo defines the repository interface for testing.
type CapabilityRepo interface {
	Create(ctx context.Context, c *models.Capability) error
	GetByID(ctx context.Context, tenantID, id string) (*models.Capability, error)
	List(ctx context.Context, tenantID string, limit, offset int) ([]models.Capability, error)
	ListRoot(ctx context.Context, tenantID string) ([]models.Capability, error)
	ListByParent(ctx context.Context, tenantID, parentID string) ([]models.Capability, error)
	ListByCategory(ctx context.Context, tenantID, category string, limit, offset int) ([]models.Capability, error)
	Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) error
	Delete(ctx context.Context, tenantID, id string) error

	// Role grants
	GrantCapabilityToRole(ctx context.Context, tenantID, capabilityID, roleName string) error
	RevokeCapabilityFromRole(ctx context.Context, tenantID, capabilityID, roleName string) error
	ListCapabilityIDsByRole(ctx context.Context, tenantID, roleName string) ([]string, error)

	// User grants
	GrantCapabilityToUser(ctx context.Context, tenantID, capabilityID, targetUserID, grantedBy string, expiresInHours *int) error
	RevokeCapabilityFromUser(ctx context.Context, tenantID, capabilityID, targetUserID string) error
	ListCapabilityIDsByUser(ctx context.Context, tenantID, userID string) ([]string, error)
	GetUserGrantExpiry(ctx context.Context, tenantID, capabilityID, userID string) (*time.Time, error)

	// Command mapping
	InsertCommandMapping(ctx context.Context, tenantID, capabilityID, commandName, commandAction string, envSuffix *string) error
	GetCapabilityIDForCommand(ctx context.Context, tenantID, command, action, env string) (string, error)

	// Permission check
	CheckPermission(ctx context.Context, tenantID, capabilityID, userID string, roles []string) (bool, string, error)

	// Temporary permissions
	GrantTemporaryPermission(ctx context.Context, tenantID, userID, capabilityID, grantedBy string, envSuffix *string, expires int) error
	GetActiveTemporaryPermissions(ctx context.Context, tenantID, userID string) ([]models.TemporaryPermission, error)
	GetActiveTempExpiry(ctx context.Context, tenantID, capabilityID, userID string) (*time.Time, error)
	GetTemporaryPermissionByID(ctx context.Context, tenantID string, id int) (*models.TemporaryPermission, error)
	RevokeTemporaryPermissionByID(ctx context.Context, id int, revokedBy string) error
	CleanupExpiredTemporaryPermissions(ctx context.Context, tenantID string) (int, error)

	// Permission requests
	CreatePermissionRequest(ctx context.Context, tenantID, userID, capabilityID, reason string, duration int, envSuffix *string) error
	GetPermissionRequestByID(ctx context.Context, tenantID string, ticketID int) (*models.PermissionRequest, error)
	ApprovePermissionRequest(ctx context.Context, ticketID int, approverID string) error
	RejectPermissionRequest(ctx context.Context, ticketID int, rejecterID string, reason *string) error
	GetUserPermissionRequests(ctx context.Context, tenantID, userID string) ([]models.PermissionRequest, error)

	// Audit
	InsertAuditLog(ctx context.Context, tenantID, action, userID, targetType, targetID, details string) error
	ListAuditLogs(ctx context.Context, tenantID string, q *models.AuditLogQuery) ([]map[string]interface{}, error)
}
