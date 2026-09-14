package service

//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"errors"
	"fmt"
	"time"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/capability/models"
)

// ErrNotFound is an alias for sentinel.NotFound for test compatibility.
var ErrNotFound = sentinel.NotFound

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	ApprovePermissionRequest(ctx context.Context, tenantID, ticketID, approverID string) error
	CheckPermission(ctx context.Context, tenantID, capabilityID, userID string, userRoles []string) (bool, string, error)
	CleanupExpiredTemporaryPermissions(ctx context.Context, tenantID string) (int, error)
	Create(ctx context.Context, m *models.Capability) error
	CreatePermissionRequest(ctx context.Context, tenantID string, userID, capabilityID, reason string, durationHours *int, envSuffix *string) error
	Delete(ctx context.Context, tenantID, id string) error
	GetActiveTempExpiry(ctx context.Context, tenantID, capabilityID, userID string) (*time.Time, error)
	GetActiveTemporaryPermissions(ctx context.Context, tenantID, userId string) ([]models.TemporaryPermission, error)
	GetByID(ctx context.Context, tenantID, id string) (*models.Capability, error)
	GetCapabilityIDForCommand(ctx context.Context, tenantID, command, action, env string) (string, error)
	GetPermissionRequestByID(ctx context.Context, tenantID string, ticketID string) (*models.PermissionRequest, error)
	GetTemporaryPermissionByID(ctx context.Context, tenantID string, id string) (*models.TemporaryPermission, error)
	GetUserGrantExpiry(ctx context.Context, tenantID, capabilityID, userID string) (*time.Time, error)
	GetUserPermissionRequests(ctx context.Context, tenantID, userId string) ([]models.PermissionRequest, error)
	GrantCapabilityToRole(ctx context.Context, tenantID string, capabilityID, roleName string) error
	GrantCapabilityToUser(ctx context.Context, tenantID string, capabilityID, userId, grantedBy string, expiresInHours *int) error
	GrantTemporaryPermission(ctx context.Context, tenantID string, userID, capabilityID, grantedBy, reason string, envSuffix *string, expiresInHours int) error
	InsertAuditLog(ctx context.Context, tenantID, action, userID, targetType, targetID, details string) error
	InsertCommandMapping(ctx context.Context, tenantID string, capID string, cmdName, cmdAction string, envSuffix *string) error
	List(ctx context.Context, tenantID string, limit, offset int) ([]models.Capability, error)
	ListAuditLogs(ctx context.Context, tenantID string, q *models.AuditLogQuery) ([]models.AuditLog, error)
	ListByCategory(ctx context.Context, tenantID, category string, limit, offset int) ([]models.Capability, error)
	ListByParent(ctx context.Context, tenantID, parentCapabilityID string) ([]models.Capability, error)
	ListCapabilityIDsByRole(ctx context.Context, tenantID, role string) ([]string, error)
	ListCapabilityIDsByUser(ctx context.Context, tenantID, userID string) ([]string, error)
	ListRoot(ctx context.Context, tenantID string) ([]models.Capability, error)
	RejectPermissionRequest(ctx context.Context, tenantID, ticketID, rejecterID string, reason *string) error
	RevokeCapabilityFromRole(ctx context.Context, tenantID, capabilityID, roleName string) error
	RevokeCapabilityFromUser(ctx context.Context, tenantID, capabilityID, userId string) error
	RevokeTemporaryPermissionByID(ctx context.Context, tenantID, id string) error
	Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) error
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
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

// Update renames a capability.
//
// The repository returns ErrNoUpdatableFields when the update set carries no
// whitelisted column, so a rename with an empty body is reported rather than
// silently answered as success -- which is what a zero field-set produced
// before the repository honoured its map.
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

// GetTree returns the capability hierarchy as a tree rooted at top-level capabilities.
func (s *Service) GetTree(ctx context.Context, tenantID string) ([]models.Capability, error) {
	return s.buildCapabilityTree(ctx, tenantID)
}

// buildCapabilityTree constructs a tree from the capabilities table using parent-child relationships.
// It first fetches all root-level capabilities (no parent), then recursively resolves children.
func (s *Service) buildCapabilityTree(ctx context.Context, tenantID string) ([]models.Capability, error) {
	roots, err := s.repo.ListRoot(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	if len(roots) == 0 {
		// No roots: fall back to the full flat list so the caller gets all capabilities.
		return s.repo.List(ctx, tenantID, 500, 0)
	}
	children := s.fetchChildrenRecursively(ctx, tenantID, roots)
	// Append any children that have no parent match back as leaf nodes.
	return s.appendOrphanChildren(children), nil
}

// fetchChildrenRecursively walks down the tree for a set of parent capabilities.
func (s *Service) fetchChildrenRecursively(ctx context.Context, tenantID string, parents []models.Capability) []models.Capability {
	nodes := make([]models.Capability, 0, len(parents))
	for _, parent := range parents {
		children, err := s.repo.ListByParent(ctx, tenantID, parent.ID)
		if err == nil && len(children) > 0 {
			nodes = append(nodes, parent)
			nodes = append(nodes, s.fetchChildrenRecursively(ctx, tenantID, children)...)
		} else {
			nodes = append(nodes, parent)
		}
	}
	return nodes
}

// appendOrphanChildren appends leaf nodes that were collected during recursive walk.
func (s *Service) appendOrphanChildren(nodes []models.Capability) []models.Capability {
	return nodes
}

// ListByCategory returns capabilities filtered by category.
func (s *Service) ListByCategory(ctx context.Context, tenantID, category string, limit, offset int) ([]models.Capability, error) {
	return s.repo.ListByCategory(ctx, tenantID, category, limit, offset)
}

// --- Role-based capability grants ---

// GrantCapabilityToRole assigns a capability to a role.
func (s *Service) GrantCapabilityToRole(ctx context.Context, tenantID, capabilityID, roleName, grantedBy string) error {
	if capabilityID == "" || roleName == "" {
		return errors.New("capabilityID and roleName are required")
	}
	if err := s.verifyCapabilityExists(ctx, tenantID, capabilityID); err != nil {
		return err
	}
	if err := s.repo.GrantCapabilityToRole(ctx, tenantID, capabilityID, roleName); err != nil {
		return err
	}
	s.recordAudit(ctx, tenantID, "grant_to_role", grantedBy, "capability", capabilityID, fmt.Sprintf("granted to role %q", roleName))
	return nil
}

// RevokeCapabilityFromRole removes a capability from a role.
func (s *Service) RevokeCapabilityFromRole(ctx context.Context, tenantID, capabilityID, roleName string) error {
	if capabilityID == "" || roleName == "" {
		return errors.New("capabilityID and roleName are required")
	}
	if err := s.verifyCapabilityExists(ctx, tenantID, capabilityID); err != nil {
		return err
	}
	if err := s.repo.RevokeCapabilityFromRole(ctx, tenantID, capabilityID, roleName); err != nil {
		return err
	}
	return nil
}

// --- User-based capability grants ---

// GrantCapabilityToUser assigns a capability directly to a user.
func (s *Service) GrantCapabilityToUser(ctx context.Context, tenantID, capabilityID, targetUserID, grantedBy string, expiresInHours *int) error {
	if capabilityID == "" || targetUserID == "" {
		return errors.New("capabilityID and targetUserID are required")
	}
	if err := s.verifyCapabilityExists(ctx, tenantID, capabilityID); err != nil {
		return err
	}
	if err := s.repo.GrantCapabilityToUser(ctx, tenantID, capabilityID, targetUserID, grantedBy, expiresInHours); err != nil {
		return err
	}
	s.recordAudit(ctx, tenantID, "grant_to_user", grantedBy, "capability", capabilityID, fmt.Sprintf("granted to user %q", targetUserID))
	return nil
}

// RevokeCapabilityFromUser removes a capability from a user.
func (s *Service) RevokeCapabilityFromUser(ctx context.Context, tenantID, capabilityID, targetUserID string) error {
	if capabilityID == "" || targetUserID == "" {
		return errors.New("capabilityID and targetUserID are required")
	}
	if err := s.verifyCapabilityExists(ctx, tenantID, capabilityID); err != nil {
		return err
	}
	return s.repo.RevokeCapabilityFromUser(ctx, tenantID, capabilityID, targetUserID)
}

// --- Command-to-capability mapping ---

// MapCommandToCapability maps a command action to a required capability.
func (s *Service) MapCommandToCapability(ctx context.Context, tenantID, commandName, commandAction, capabilityID, environmentSuffix string) error {
	if commandName == "" || commandAction == "" || capabilityID == "" {
		return errors.New("commandName, commandAction, and capabilityID are required")
	}
	if err := s.verifyCapabilityExists(ctx, tenantID, capabilityID); err != nil {
		return err
	}
	var envSuffix *string
	if environmentSuffix != "" {
		envSuffix = &environmentSuffix
	}
	return s.repo.InsertCommandMapping(ctx, tenantID, capabilityID, commandName, commandAction, envSuffix)
}

// GetCapabilityForCommand resolves which capability a command action requires.
// It first looks for an environment-specific mapping, then falls back to a generic one.
func (s *Service) GetCapabilityForCommand(ctx context.Context, tenantID, command, action, environment string) (*string, error) {
	var capabilityID string
	var err error
	if environment != "" {
		capabilityID, err = s.repo.GetCapabilityIDForCommand(ctx, tenantID, command, action, environment)
	} else {
		capabilityID, err = s.repo.GetCapabilityIDForCommand(ctx, tenantID, command, action, "")
	}
	if err != nil {
		return nil, err
	}
	if capabilityID == "" {
		return nil, nil
	}
	return &capabilityID, nil
}

// --- Permission check ---

// CheckPermission evaluates whether a user (given their roles) can perform a capability.
func (s *Service) CheckPermission(ctx context.Context, tenantID string, req models.CheckPermissionRequest) (*models.CheckPermissionResult, error) {
	allowed, grantedVia, err := s.repo.CheckPermission(ctx, tenantID, req.CapabilityID, req.UserID, req.UserRoles)
	if err != nil {
		return nil, err
	}

	result := &models.CheckPermissionResult{
		Allowed:      allowed,
		CapabilityID: req.CapabilityID,
		GrantedVia:   grantedVia,
	}

	if allowed {
		// If allowed via a direct user grant, attach the expiry if it exists.
		if grantedVia == "direct user grant" {
			if exp, err := s.repo.GetUserGrantExpiry(ctx, tenantID, req.CapabilityID, req.UserID); err == nil && exp != nil {
				result.ExpiresAt = exp
			}
		}
		// If allowed via a temporary permission, attach the expiry.
		if grantedVia == "active temporary permission" {
			if exp, err := s.repo.GetActiveTempExpiry(ctx, tenantID, req.CapabilityID, req.UserID); err == nil && exp != nil {
				result.ExpiresAt = exp
			}
		}
	}

	return result, nil
}

// --- Temporary permissions (legacy API: POST /temporary) ---

// GrantTemporaryPermission grants an admin-issued temporary permission.
func (s *Service) GrantTemporaryPermission(ctx context.Context, req models.GrantTemporaryRequest) (*models.TemporaryPermission, error) {
	tenantID := req.TenantID
	if tenantID == "" {
		return nil, errors.New("tenant_id is required")
	}
	if req.ExpiresInHours <= 0 {
		return nil, ErrInvalidDuration
	}
	if req.ExpiresInHours > 720 {
		return nil, ErrDurationExceedsLimit
	}
	if err := s.verifyCapabilityExists(ctx, tenantID, req.CapabilityID); err != nil {
		return nil, err
	}
	var envSuffix *string
	if req.EnvironmentSuffix != "" {
		envSuffix = &req.EnvironmentSuffix
	}
	if err := s.repo.GrantTemporaryPermission(ctx, tenantID, req.UserID, req.CapabilityID, req.GrantedBy, req.Reason, envSuffix, req.ExpiresInHours); err != nil {
		return nil, err
	}
	grantedAt := time.Now().UTC()
	return &models.TemporaryPermission{
		TenantID:          tenantID,
		UserID:            req.UserID,
		CapabilityID:      req.CapabilityID,
		EnvironmentSuffix: req.EnvironmentSuffix,
		Reason:            req.Reason,
		GrantedBy:         req.GrantedBy,
		ExpiresAt:         grantedAt.Add(time.Duration(req.ExpiresInHours) * time.Hour),
		GrantedAt:         grantedAt,
	}, nil
}

// GetActiveTemporaryPermissions returns active (non-expired) permissions for a user.
func (s *Service) GetActiveTemporaryPermissions(ctx context.Context, tenantID, userID string) ([]models.TemporaryPermission, error) {
	return s.repo.GetActiveTemporaryPermissions(ctx, tenantID, userID)
}

// RevokeTemporaryPermission revokes a temporary permission by ID.
func (s *Service) RevokeTemporaryPermission(ctx context.Context, tenantID string, id string, revokedBy string, reason string) (*models.TemporaryPermission, error) {
	perm, err := s.repo.GetTemporaryPermissionByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if err := s.repo.RevokeTemporaryPermissionByID(ctx, tenantID, id); err != nil {
		return nil, err
	}
	s.recordAudit(ctx, tenantID, "revoke_temporary_permission", revokedBy, "temporary_permission", id, fmt.Sprintf("reason=%s", reason))
	now := time.Now().UTC()
	perm.RevokedAt = &now
	return perm, nil
}

// --- Permission audit ---

// GetAuditLogs returns permission audit log entries.
//
// The repository returns typed rows now, so there is no map conversion here:
// the old SelectContext into []map[string]interface{} could never return a row
// and every audit read answered an empty list while claiming success.
func (s *Service) GetAuditLogs(ctx context.Context, tenantID string, q models.AuditLogQuery) ([]models.AuditLog, error) {
	return s.repo.ListAuditLogs(ctx, tenantID, &q)
}

// --- Permission request (legacy API) ---

// CreatePermissionRequest creates a new permission request record.
func (s *Service) CreatePermissionRequest(ctx context.Context, tenantID, userID, capabilityID string, body models.CreatePermissionRequestBody) (*models.PermissionRequest, error) {
	if err := s.verifyCapabilityExists(ctx, tenantID, capabilityID); err != nil {
		return nil, err
	}
	duration := 8
	var durationPtr *int
	if body.DurationHours != nil && *body.DurationHours > 0 {
		duration = *body.DurationHours
	}
	durationPtr = &duration
	now := time.Now().UTC()
	if err := s.repo.CreatePermissionRequest(ctx, tenantID, userID, capabilityID, body.Reason, durationPtr, nil); err != nil {
		return nil, err
	}
	pr := &models.PermissionRequest{
		CapabilityID:  capabilityID,
		UserID:        userID,
		TenantID:      tenantID,
		Reason:        body.Reason,
		Status:        "pending",
		DurationHours: durationPtr,
		CreatedAt:     now,
		UpdatedAt:     now,
	}
	s.recordAudit(ctx, tenantID, "create_permission_request", userID, "permission_request", permissionRequestIDString(pr), fmt.Sprintf("capability=%q reason=%s", capabilityID, body.Reason))
	return pr, nil
}

// permissionRequestIDString returns a stable string key for a PermissionRequest
// (used by audit logging before the row ID is known).
func permissionRequestIDString(pr *models.PermissionRequest) string {
	if pr.ID != "" {
		return pr.ID
	}
	return "pending"
}

// GetPermissionRequestByTicket retrieves a request by its id.
func (s *Service) GetPermissionRequestByTicket(ctx context.Context, tenantID string, ticketID string) (*models.PermissionRequest, error) {
	return s.repo.GetPermissionRequestByID(ctx, tenantID, ticketID)
}

// CleanupExpiredTemporaryPermissions removes expired temporary permissions.
func (s *Service) CleanupExpiredTemporaryPermissions(ctx context.Context, tenantID string) (*models.CleanupResult, error) {
	n, err := s.repo.CleanupExpiredTemporaryPermissions(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	return &models.CleanupResult{Deleted: n}, nil
}

// --- Simplified permission request API ---

// RequestPermission creates a simplified permission request.
func (s *Service) RequestPermission(ctx context.Context, tenantID string, body models.RequestPermissionBody) (*models.PermissionRequest, error) {
	if body.UserID == "" {
		return nil, errors.New("user_id is required")
	}
	if err := s.verifyCapabilityExists(ctx, tenantID, body.CapabilityID); err != nil {
		return nil, err
	}
	duration := body.DurationHours
	if duration <= 0 {
		duration = 8
	}
	durationPtr := duration
	var envSuffix *string
	if body.EnvironmentSuffix != "" {
		envSuffix = &body.EnvironmentSuffix
	}
	if err := s.repo.CreatePermissionRequest(ctx, tenantID, body.UserID, body.CapabilityID, body.Reason, &durationPtr, envSuffix); err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	pr := &models.PermissionRequest{
		CapabilityID:      body.CapabilityID,
		UserID:            body.UserID,
		TenantID:          tenantID,
		Status:            "pending",
		Reason:            body.Reason,
		CreatedAt:         now,
		UpdatedAt:         now,
		EnvironmentSuffix: body.EnvironmentSuffix,
		DurationHours:     &durationPtr,
	}
	s.recordAudit(ctx, tenantID, "request_permission", body.UserID, "permission_request", permissionRequestIDString(pr), fmt.Sprintf("capability=%q reason=%s duration=%d", body.CapabilityID, body.Reason, duration))
	return pr, nil
}

// ApproveRequest approves a permission request and auto-grants a temporary permission.
//
// The auto-grant error is propagated: an approval that silently failed to grant
// the requested capability would leave a ticket marked approved while the user
// still cannot perform the action.
func (s *Service) ApproveRequest(ctx context.Context, tenantID string, ticketID, approverID string, approverRoles []string) (*models.PermissionRequest, error) {
	if approverID == "" {
		return nil, errors.New("approver_id is required")
	}
	pr, err := s.repo.GetPermissionRequestByID(ctx, tenantID, ticketID)
	if err != nil {
		return nil, err
	}
	if pr == nil {
		return nil, sentinel.NotFound
	}
	if pr.Status != "pending" {
		return nil, errors.New("request is not in pending status")
	}
	if err := s.repo.ApprovePermissionRequest(ctx, tenantID, ticketID, approverID); err != nil {
		return nil, err
	}
	pr.Status = "approved"
	pr.ApproverID = &approverID
	pr.UpdatedAt = time.Now().UTC()
	// Auto-grant a temporary permission for the requested capability.
	duration := 8
	if pr.DurationHours != nil && *pr.DurationHours > 0 {
		duration = *pr.DurationHours
	}
	var envSuffix *string
	if pr.EnvironmentSuffix != "" {
		envSuffix = &pr.EnvironmentSuffix
	}
	if err := s.repo.GrantTemporaryPermission(ctx, tenantID, pr.UserID, pr.CapabilityID, approverID, pr.Reason, envSuffix, duration); err != nil {
		return nil, err
	}
	s.recordAudit(ctx, tenantID, "approve_permission_request", approverID, "permission_request", ticketID, fmt.Sprintf("granted capability=%q for user=%s", pr.CapabilityID, pr.UserID))
	return pr, nil
}

// RejectRequest rejects a permission request.
//
// The read is tenant-scoped and the request must be pending, mirroring
// ApproveRequest: rejecting by bare id let any tenant close another tenant's
// open ticket.
func (s *Service) RejectRequest(ctx context.Context, tenantID, ticketID, rejecterID, reason string) (bool, error) {
	if rejecterID == "" {
		return false, errors.New("rejecter_id is required")
	}
	pr, err := s.repo.GetPermissionRequestByID(ctx, tenantID, ticketID)
	if err != nil {
		return false, err
	}
	if pr == nil {
		return false, sentinel.NotFound
	}
	if pr.Status != "pending" {
		return false, errors.New("request is not in pending status")
	}
	var reasonPtr *string
	if reason != "" {
		reasonPtr = &reason
	}
	if err := s.repo.RejectPermissionRequest(ctx, tenantID, ticketID, rejecterID, reasonPtr); err != nil {
		return false, err
	}
	s.recordAudit(ctx, tenantID, "reject_permission_request", rejecterID, "permission_request", ticketID, fmt.Sprintf("reason=%s", reason))
	return true, nil
}

// GrantSimplified grants a simplified temporary permission.
func (s *Service) GrantSimplified(ctx context.Context, req models.GrantSimplifiedRequest) (*models.TemporaryPermission, error) {
	tenantID := req.TenantID
	if tenantID == "" {
		return nil, errors.New("tenant_id is required")
	}
	if req.DurationHours <= 0 {
		return nil, ErrInvalidDuration
	}
	if req.DurationHours > 720 {
		return nil, ErrDurationExceedsLimit
	}
	if err := s.verifyCapabilityExists(ctx, tenantID, req.CapabilityID); err != nil {
		return nil, err
	}
	var envSuffix *string
	if req.EnvironmentSuffix != "" {
		envSuffix = &req.EnvironmentSuffix
	}
	if err := s.repo.GrantTemporaryPermission(ctx, tenantID, req.UserID, req.CapabilityID, req.GrantorId, req.Reason, envSuffix, req.DurationHours); err != nil {
		return nil, err
	}
	grantedAt := time.Now().UTC()
	return &models.TemporaryPermission{
		TenantID:          tenantID,
		UserID:            req.UserID,
		CapabilityID:      req.CapabilityID,
		EnvironmentSuffix: req.EnvironmentSuffix,
		Reason:            req.Reason,
		GrantedBy:         req.GrantorId,
		ExpiresAt:         grantedAt.Add(time.Duration(req.DurationHours) * time.Hour),
		GrantedAt:         grantedAt,
	}, nil
}

// RevokeSimplified revokes a simplified temporary permission by ID.
func (s *Service) RevokeSimplified(ctx context.Context, tenantID string, id string, revokedBy string) (*models.TemporaryPermission, error) {
	perm, err := s.repo.GetTemporaryPermissionByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if err := s.repo.RevokeTemporaryPermissionByID(ctx, tenantID, id); err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	perm.RevokedAt = &now
	s.recordAudit(ctx, tenantID, "revoke_temporary_permission", revokedBy, "temporary_permission", id, "revoked simplified")
	return perm, nil
}

// --- Effective capabilities for a user ---

// GetUserEffectiveCapabilities returns all capabilities a user has (via roles + direct grants).
func (s *Service) GetUserEffectiveCapabilities(ctx context.Context, tenantID, userID string, roles []string) ([]string, error) {
	if userID == "" {
		return []string{}, nil
	}
	// Collect capability IDs from role grants.
	capIDs := make(map[string]struct{})
	for _, role := range roles {
		ids, err := s.repo.ListCapabilityIDsByRole(ctx, tenantID, role)
		if err != nil {
			continue
		}
		for _, id := range ids {
			capIDs[id] = struct{}{}
		}
	}
	// Collect capability IDs from direct user grants (non-expired).
	ids, err := s.repo.ListCapabilityIDsByUser(ctx, tenantID, userID)
	if err != nil {
		return nil, err
	}
	for _, id := range ids {
		capIDs[id] = struct{}{}
	}
	result := make([]string, 0, len(capIDs))
	for id := range capIDs {
		result = append(result, id)
	}
	return result, nil
}

// --- User permission requests ---

// GetUserPermissionRequests returns all permission requests for a user.
func (s *Service) GetUserPermissionRequests(ctx context.Context, tenantID, userID string) ([]models.PermissionRequest, error) {
	return s.repo.GetUserPermissionRequests(ctx, tenantID, userID)
}

// --- Internal helpers ---

// verifyCapabilityExists checks that a capability exists for the tenant.
func (s *Service) verifyCapabilityExists(ctx context.Context, tenantID, capabilityID string) error {
	_, err := s.repo.GetByID(ctx, tenantID, capabilityID)
	if err != nil {
		return ErrCapabilityNotFound
	}
	return nil
}

// recordAudit writes an audit log entry for a permission action.
//
// The error is deliberately discarded: an audit write must not fail the action
// it records, and the caller has already committed the primary write. The defect
// that made this a no-op was structural -- InsertAuditLog targeted
// permission_audit_logs, which has no target_type, target_id or details column,
// so every call failed at parse and this module never wrote a single audit row.
func (s *Service) recordAudit(ctx context.Context, tenantID, action, userID, targetType, targetID, details string) {
	_ = s.repo.InsertAuditLog(ctx, tenantID, action, userID, targetType, targetID, details)
}

// --- Errors ---

// Known sentinel errors used by handlers for status-code routing.
var (
	ErrParentNotFound           = errors.New("parent not found")
	ErrInvalidRiskLevel         = errors.New("invalid risk level")
	ErrRoleNotFound             = errors.New("role not found")
	ErrInvalidDuration          = errors.New("invalid duration")
	ErrDurationExceedsLimit     = errors.New("duration exceeds limit")
	ErrHasChildren              = errors.New("has children")
	ErrInsufficientApprovalRole = errors.New("insufficient approval role")
	ErrCapabilityNotFound       = errors.New("capability not found")
)

// IsNotFound returns true if the error indicates a resource was not found.
func IsNotFound(err error) bool {
	return errors.Is(err, sentinel.NotFound) || errors.Is(err, ErrCapabilityNotFound)
}

// ErrNotFoundCapability returns a not-found error for a given capability ID.
func ErrNotFoundCapability(id string) error {
	return fmt.Errorf("capability %q not found: %w", id, sentinel.NotFound)
}
