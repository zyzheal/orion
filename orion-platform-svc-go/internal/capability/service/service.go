package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/capability/models"
	"orion/platform-svc-go/internal/capability/repository"
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Create(ctx context.Context, tenantID string, req models.CreateCapabilityRequest) (*models.Capability, error) {
	m := &models.Capability{
		TenantID: tenantID,
		Name:     req.Name,
	}
	if err := s.repo.Create(ctx, m); err != nil {
		return nil, err
	}
	return m, nil
}

func (s *Service) Get(ctx context.Context, tenantID, id string) (*models.Capability, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) List(ctx context.Context, tenantID string, limit, offset int) ([]models.Capability, error) {
	return s.repo.List(ctx, tenantID, limit, offset)
}

func (s *Service) Update(ctx context.Context, tenantID, id string, req models.UpdateCapabilityRequest) (*models.Capability, error) {
	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if err := s.repo.Update(ctx, tenantID, id, updates); err != nil {
		return nil, err
	}
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}

// --- Capability tree & list with filter ---

// GetTree returns the capability hierarchy as a tree.
func (s *Service) GetTree(ctx context.Context, tenantID string) ([]models.Capability, error) {
	// TODO: implement tree construction from capabilities.
	items, err := s.List(ctx, tenantID, 500, 0)
	if err != nil {
		return nil, err
	}
	return items, nil
}

// ListByCategory returns capabilities filtered by category.
func (s *Service) ListByCategory(ctx context.Context, tenantID, category string, limit, offset int) ([]models.Capability, error) {
	return s.repo.ListByCategory(ctx, tenantID, category, limit, offset)
}

// --- Role-based capability grants ---

// GrantCapabilityToRole assigns a capability to a role.
func (s *Service) GrantCapabilityToRole(ctx context.Context, tenantID, capabilityID, roleName, grantedBy string) error {
	// TODO: implement role-capability grant persistence.
	return nil
}

// RevokeCapabilityFromRole removes a capability from a role.
func (s *Service) RevokeCapabilityFromRole(ctx context.Context, tenantID, capabilityID, roleName string) error {
	// TODO: implement role-capability revoke.
	return nil
}

// --- User-based capability grants ---

// GrantCapabilityToUser assigns a capability directly to a user.
func (s *Service) GrantCapabilityToUser(ctx context.Context, tenantID, capabilityID, targetUserID, grantedBy string, expiresInHours *int) error {
	// TODO: implement user-capability grant persistence.
	return nil
}

// RevokeCapabilityFromUser removes a capability from a user.
func (s *Service) RevokeCapabilityFromUser(ctx context.Context, tenantID, capabilityID, targetUserID string) error {
	// TODO: implement user-capability revoke.
	return nil
}

// --- Command-to-capability mapping ---

// MapCommandToCapability maps a command to a required capability.
func (s *Service) MapCommandToCapability(ctx context.Context, tenantID, commandName, commandAction, capabilityID, environmentSuffix string) error {
	// TODO: implement command-capability mapping.
	return nil
}

// GetCapabilityForCommand resolves which capability a command action requires.
func (s *Service) GetCapabilityForCommand(ctx context.Context, tenantID, command, action, environment string) (*string, error) {
	// TODO: implement command-capability resolution.
	return nil, nil
}

// --- Permission check ---

// CheckPermission evaluates whether a user (given their roles) can perform a capability.
func (s *Service) CheckPermission(ctx context.Context, tenantID string, req models.CheckPermissionRequest) (*models.CheckPermissionResult, error) {
	// TODO: implement full permission evaluation.
	return &models.CheckPermissionResult{Allowed: true}, nil
}

// --- Temporary permissions (legacy API: POST /temporary) ---

// GrantTemporaryPermission grants an admin-issued temporary permission.
func (s *Service) GrantTemporaryPermission(ctx context.Context, req models.GrantTemporaryRequest) (*models.TemporaryPermission, error) {
	if req.ExpiresInHours <= 0 {
		return nil, errors.New("invalid duration")
	}
	if req.ExpiresInHours > 720 {
		return nil, errors.New("duration exceeds limit")
	}
	// TODO: persist temporary permission.
	return &models.TemporaryPermission{
		UserID:           req.UserID,
		CapabilityID:     req.CapabilityID,
		EnvironmentSuffix: req.EnvironmentSuffix,
		Reason:           req.Reason,
		GrantedBy:        req.GrantedBy,
		ExpiresAt:        time.Now().UTC().Add(time.Duration(req.ExpiresInHours) * time.Hour),
		GrantedAt:        time.Now().UTC(),
	}, nil
}

// GetActiveTemporaryPermissions returns active (non-expired) permissions for a user.
func (s *Service) GetActiveTemporaryPermissions(ctx context.Context, tenantID, userID string) ([]models.TemporaryPermission, error) {
	// TODO: query active temporary permissions.
	return []models.TemporaryPermission{}, nil
}

// RevokeTemporaryPermission revokes a temporary permission by ID.
func (s *Service) RevokeTemporaryPermission(ctx context.Context, tenantID string, id int, revokedBy string, reason string) (*models.TemporaryPermission, error) {
	// TODO: persist temporary permission revocation.
	return nil, nil
}

// --- Permission audit ---

// GetAuditLogs returns permission audit log entries.
func (s *Service) GetAuditLogs(ctx context.Context, tenantID string, q models.AuditLogQuery) ([]models.AuditLog, error) {
	// TODO: query audit log table.
	return []models.AuditLog{}, nil
}

// --- Permission request (legacy API) ---

// CreatePermissionRequest creates a new permission request record.
func (s *Service) CreatePermissionRequest(ctx context.Context, tenantID, userID, capabilityID string, body models.CreatePermissionRequestBody) (*models.PermissionRequest, error) {
	// TODO: validate capability exists and create request record.
	return &models.PermissionRequest{
		CapabilityID: capabilityID,
		Status:       "pending",
	}, nil
}

// GetPermissionRequestByTicket retrieves a request by ticket ID.
func (s *Service) GetPermissionRequestByTicket(ctx context.Context, tenantID string, ticketID int) (*models.PermissionRequest, error) {
	// TODO: query permission requests.
	return nil, nil
}

// CleanupExpiredTemporaryPermissions removes expired temporary permissions.
func (s *Service) CleanupExpiredTemporaryPermissions(ctx context.Context, tenantID string) (*models.CleanupResult, error) {
	// TODO: clean up expired rows.
	return &models.CleanupResult{Deleted: 0}, nil
}

// --- Simplified permission request API ---

// RequestPermission creates a simplified permission request.
func (s *Service) RequestPermission(ctx context.Context, tenantID string, body models.RequestPermissionBody) (*models.PermissionRequest, error) {
	// TODO: validate capability exists, create request record, kick off approval flow.
	return &models.PermissionRequest{
		CapabilityID: body.CapabilityID,
		Status:       "pending",
	}, nil
}

// ApproveRequest approves a permission request.
func (s *Service) ApproveRequest(ctx context.Context, tenantID string, ticketID int, approverID string, approverRoles []string) (*models.PermissionRequest, error) {
	// TODO: implement approval logic and auto-grant.
	return nil, nil
}

// RejectRequest rejects a permission request.
func (s *Service) RejectRequest(ctx context.Context, tenantID string, ticketID int, rejecterID string, reason string) (bool, error) {
	// TODO: implement rejection logic.
	return false, nil
}

// GrantSimplified grants a simplified temporary permission.
func (s *Service) GrantSimplified(ctx context.Context, req models.GrantSimplifiedRequest) (*models.TemporaryPermission, error) {
	// TODO: persist temporary permission.
	return &models.TemporaryPermission{
		UserID:            req.UserID,
		CapabilityID:      req.CapabilityID,
		EnvironmentSuffix: req.EnvironmentSuffix,
		Reason:            req.Reason,
		GrantedBy:         req.GrantorId,
		ExpiresAt:         time.Now().UTC().Add(time.Duration(req.DurationHours) * time.Hour),
		GrantedAt:         time.Now().UTC(),
	}, nil
}

// RevokeSimplified revokes a simplified temporary permission by ID.
func (s *Service) RevokeSimplified(ctx context.Context, tenantID string, id int, revokedBy string) (*models.TemporaryPermission, error) {
	// TODO: persist revocation.
	return nil, nil
}

// --- Effective capabilities for a user ---

// GetUserEffectiveCapabilities returns all capabilities a user has (via roles + direct grants).
func (s *Service) GetUserEffectiveCapabilities(ctx context.Context, tenantID, userID string, roles []string) ([]string, error) {
	// TODO: resolve effective capabilities from roles and direct grants.
	return []string{}, nil
}

// --- User permission requests ---

// GetUserPermissionRequests returns all permission requests for a user.
func (s *Service) GetUserPermissionRequests(ctx context.Context, tenantID, userID string) ([]models.PermissionRequest, error) {
	// TODO: query user's permission requests.
	return []models.PermissionRequest{}, nil
}

// --- Errors ---

// Known sentinel errors used by handlers for status-code routing.
var (
	ErrNotFound          = errors.New("not found")
	ErrParentNotFound    = errors.New("parent not found")
	ErrInvalidRiskLevel  = errors.New("invalid risk level")
	ErrRoleNotFound      = errors.New("role not found")
	ErrInvalidDuration   = errors.New("invalid duration")
	ErrDurationExceedsLimit = errors.New("duration exceeds limit")
	ErrHasChildren       = errors.New("has children")
	ErrInsufficientApprovalRole = errors.New("insufficient approval role")
	ErrCapabilityNotFound = errors.New("capability not found")
)

// IsNotFound returns true if the error indicates a resource was not found.
func IsNotFound(err error) bool {
	return errors.Is(err, ErrNotFound) || errors.Is(err, ErrCapabilityNotFound)
}

// ErrNotFoundCapability returns a not-found error for a given capability ID.
func ErrNotFoundCapability(id string) error {
	return fmt.Errorf("capability %q not found: %w", id, ErrNotFound)
}

