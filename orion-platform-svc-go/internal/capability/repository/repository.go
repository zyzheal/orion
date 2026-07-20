package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/capability/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// --- CRUD ---

func (r *Repository) Create(ctx context.Context, m *models.Capability) error {
	m.ID = uuid.New().String()
	m.CreatedAt = time.Now().UTC()
	m.UpdatedAt = time.Now().UTC()
	query := `INSERT INTO capabilities (id, tenant_id, name, created_at, updated_at)
		VALUES (:id, :tenant_id, :name, :created_at, :updated_at)`
	_, err := r.db.NamedExecContext(ctx, query, m)
	return err
}

func (r *Repository) GetByCapabilityID(ctx context.Context, tenantID, capabilityID string) (*models.Capability, error) {
	var m models.Capability
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM capabilities WHERE capability_id=$1 AND tenant_id=$2`, capabilityID, tenantID)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.Capability, error) {
	var m models.Capability
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM capabilities WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *Repository) List(ctx context.Context, tenantID string, limit, offset int) ([]models.Capability, error) {
	if limit <= 0 {
		limit = 50
	}
	var items []models.Capability
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM capabilities WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, tenantID, limit, offset)
	if err != nil {
		return nil, err
	}
	return items, nil
}

// ListByCategory returns capabilities filtered by category (fuzzy match on name) with pagination.
func (r *Repository) ListByCategory(ctx context.Context, tenantID, category string, limit, offset int) ([]models.Capability, error) {
	if limit <= 0 {
		limit = 50
	}
	if category == "" {
		return r.List(ctx, tenantID, limit, offset)
	}
	var items []models.Capability
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM capabilities WHERE tenant_id=$1 AND name ILIKE $2 ORDER BY created_at DESC LIMIT $3 OFFSET $4`,
		tenantID, "%"+category+"%", limit, offset)
	if err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) ListRoot(ctx context.Context, tenantID string) ([]models.Capability, error) {
	var items []models.Capability
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM capabilities WHERE tenant_id=$1 AND (parent_capability_id IS NULL OR parent_capability_id='') ORDER BY created_at`, tenantID)
	return items, err
}

func (r *Repository) ListByParent(ctx context.Context, tenantID, parentCapabilityID string) ([]models.Capability, error) {
	var items []models.Capability
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM capabilities WHERE tenant_id=$1 AND parent_capability_id=$2`, tenantID, parentCapabilityID)
	return items, err
}

func (r *Repository) Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	updates["updated_at"] = time.Now().UTC()
	_, err := r.db.ExecContext(ctx,
		`UPDATE capabilities SET updated_at = NOW() WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM capabilities WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// HasChildren checks if a capability has child capabilities.
func (r *Repository) HasChildren(ctx context.Context, tenantID, id string) (bool, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM capabilities WHERE tenant_id=$1 AND parent_capability_id=$2`, tenantID, id)
	return count > 0, err
}

// GetParent checks if a parent capability exists.
func (r *Repository) GetParent(ctx context.Context, tenantID, parentCapabilityID string) (*models.Capability, error) {
	var m models.Capability
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM capabilities WHERE id=$1 AND tenant_id=$2`, parentCapabilityID, tenantID)
	return &m, err
}

// --- Command mappings ---

func (r *Repository) InsertCommandMapping(ctx context.Context, tenantID string, capID string, cmdName, cmdAction string, envSuffix *string) error {
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO command_capability_mappings (id, tenant_id, capability_id, command_name, command_action, environment_suffix)
		VALUES (:id, :tenant_id, :capability_id, :command_name, :command_action, :environment_suffix)
		ON CONFLICT (tenant_id, command_name, command_action, environment_suffix) DO NOTHING`,
		map[string]interface{}{
			"id":                 uuid.New().String(),
			"tenant_id":          tenantID,
			"capability_id":      capID,
			"command_name":       cmdName,
			"command_action":     cmdAction,
			"environment_suffix": envSuffix,
		})
	return err
}

func (r *Repository) GetCapabilityForCommand(ctx context.Context, tenantID, command, action string, env *string) (*models.Capability, error) {
	var m models.Capability
	if env != nil && *env != "" {
		err := r.db.GetContext(ctx, &m,
			`SELECT * FROM capabilities WHERE id = (SELECT capability_id FROM command_capability_mappings
				WHERE tenant_id=$1 AND command_name=$2 AND command_action=$3 AND environment_suffix=$4)`,
			tenantID, command, action, *env)
		return &m, err
	}
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM capabilities WHERE id = (SELECT capability_id FROM command_capability_mappings
			WHERE tenant_id=$1 AND command_name=$2 AND command_action=$3 AND environment_suffix IS NULL)`,
		tenantID, command, action)
	return &m, err
}

// GetCapabilityIDForCommand returns the capability_id mapped to a command+action.
// An empty env string matches rows with NULL environment_suffix.
func (r *Repository) GetCapabilityIDForCommand(ctx context.Context, tenantID, command, action, env string) (string, error) {
	if env != "" {
		var capabilityID string
		err := r.db.GetContext(ctx, &capabilityID,
			`SELECT capability_id FROM command_capability_mappings
				WHERE tenant_id=$1 AND command_name=$2 AND command_action=$3 AND environment_suffix=$4`,
			tenantID, command, action, env)
		if err != nil {
			return "", err
		}
		return capabilityID, nil
	}
	var capabilityID string
	err := r.db.GetContext(ctx, &capabilityID,
		`SELECT capability_id FROM command_capability_mappings
			WHERE tenant_id=$1 AND command_name=$2 AND command_action=$3 AND environment_suffix IS NULL`,
		tenantID, command, action)
	if err != nil {
		return "", err
	}
	return capabilityID, nil
}

// --- Role/user grants ---

func (r *Repository) GrantCapabilityToRole(ctx context.Context, tenantID string, capabilityID, roleName string) error {
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO capability_role_mappings (id, tenant_id, capability_id, role_name)
		VALUES (:id, :tenant_id, :capability_id, :role_name)
		ON CONFLICT (tenant_id, capability_id, role_name) DO NOTHING`,
		map[string]interface{}{
			"id":            uuid.New().String(),
			"tenant_id":     tenantID,
			"capability_id": capabilityID,
			"role_name":     roleName,
		})
	return err
}

func (r *Repository) RevokeCapabilityFromRole(ctx context.Context, tenantID string, capabilityID, roleName string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM capability_role_mappings WHERE tenant_id=$1 AND capability_id=$2 AND role_name=$3`,
		tenantID, capabilityID, roleName)
	return err
}

func (r *Repository) GrantCapabilityToUser(ctx context.Context, tenantID string, capabilityID, userId, grantedBy string, expiresInHours *int) error {
	expiresIn := 8
	if expiresInHours != nil && *expiresInHours > 0 {
		expiresIn = *expiresInHours
	}
	expiresAt := time.Now().UTC().Add(time.Duration(expiresIn) * time.Hour)
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO capability_user_mappings (id, tenant_id, capability_id, user_id, granted_by, expires_at)
		VALUES (:id, :tenant_id, :capability_id, :user_id, :granted_by, :expires_at)
		ON CONFLICT (tenant_id, capability_id, user_id) DO NOTHING`,
		map[string]interface{}{
			"id":            uuid.New().String(),
			"tenant_id":     tenantID,
			"capability_id": capabilityID,
			"user_id":       userId,
			"granted_by":    grantedBy,
			"expires_at":    expiresAt,
		})
	return err
}

func (r *Repository) RevokeCapabilityFromUser(ctx context.Context, tenantID string, capabilityID, userId string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM capability_user_mappings WHERE tenant_id=$1 AND capability_id=$2 AND user_id=$3`,
		tenantID, capabilityID, userId)
	return err
}

// --- Effective capabilities helpers ---

// ListCapabilityIDsByRole returns all capability IDs assigned to a given role.
func (r *Repository) ListCapabilityIDsByRole(ctx context.Context, tenantID, role string) ([]string, error) {
	var ids []string
	err := r.db.SelectContext(ctx, &ids,
		`SELECT capability_id FROM capability_role_mappings WHERE tenant_id=$1 AND role_name=$2`,
		tenantID, role)
	if err != nil {
		return nil, err
	}
	return ids, nil
}

// ListCapabilityIDsByUser returns all non-expired capability IDs directly assigned to a user.
func (r *Repository) ListCapabilityIDsByUser(ctx context.Context, tenantID, userID string) ([]string, error) {
	var ids []string
	err := r.db.SelectContext(ctx, &ids,
		`SELECT capability_id FROM capability_user_mappings
			WHERE tenant_id=$1 AND user_id=$2 AND (expires_at IS NULL OR expires_at > NOW())`,
		tenantID, userID)
	if err != nil {
		return nil, err
	}
	return ids, nil
}

// GetUserGrantExpiry returns the expires_at of a direct user capability grant if set.
func (r *Repository) GetUserGrantExpiry(ctx context.Context, tenantID, capabilityID, userID string) (*time.Time, error) {
	var expiresAt sql.NullTime
	err := r.db.GetContext(ctx, &expiresAt,
		`SELECT COALESCE(expires_at, NULL) FROM capability_user_mappings
			WHERE tenant_id=$1 AND capability_id=$2 AND user_id=$3
			AND (expires_at IS NULL OR expires_at > NOW())`,
		tenantID, capabilityID, userID)
	if err != nil {
		return nil, err
	}
	if expiresAt.Valid {
		return &expiresAt.Time, nil
	}
	return nil, nil
}

// --- Temporary permissions ---

func (r *Repository) GrantTemporaryPermission(ctx context.Context, tenantID string, userID, capabilityID, grantedBy string, envSuffix *string, expiresInHours int) error {
	expiresAt := time.Now().UTC().Add(time.Duration(expiresInHours) * time.Hour)
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO temporary_permissions (user_id, tenant_id, capability_id, environment_suffix, granted_by, expires_at, created_at)
		VALUES (:user_id, :tenant_id, :capability_id, :environment_suffix, :granted_by, :expires_at, :created_at)`,
		map[string]interface{}{
			"user_id":            userID,
			"tenant_id":          tenantID,
			"capability_id":      capabilityID,
			"environment_suffix": envSuffix,
			"granted_by":         grantedBy,
			"expires_at":         expiresAt,
			"created_at":         time.Now().UTC(),
		})
	return err
}

func (r *Repository) GetActiveTemporaryPermissions(ctx context.Context, tenantID, userId string) ([]models.TemporaryPermission, error) {
	var items []models.TemporaryPermission
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM temporary_permissions WHERE user_id=$1 AND tenant_id=$2 AND expires_at > NOW() AND revoked=false`,
		userId, tenantID)
	return items, err
}

func (r *Repository) RevokeTemporaryPermissionByID(ctx context.Context, id int, byUserID string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE temporary_permissions SET revoked=true, updated_at=NOW() WHERE id=$1`, id)
	return err
}

// GetTemporaryPermissionByID fetches a temporary permission by its numeric row ID.
func (r *Repository) GetTemporaryPermissionByID(ctx context.Context, tenantID string, id int) (*models.TemporaryPermission, error) {
	var perm models.TemporaryPermission
	err := r.db.GetContext(ctx, &perm,
		`SELECT * FROM temporary_permissions WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &perm, nil
}

// GetActiveTempExpiry returns the earliest expires_at of active temporary permissions.
func (r *Repository) GetActiveTempExpiry(ctx context.Context, tenantID, capabilityID, userID string) (*time.Time, error) {
	var expiresAt sql.NullTime
	err := r.db.GetContext(ctx, &expiresAt,
		`SELECT MIN(expires_at) FROM temporary_permissions
			WHERE tenant_id=$1 AND capability_id=$2 AND user_id=$3
			AND expires_at > NOW() AND revoked=false`,
		tenantID, capabilityID, userID)
	if err != nil {
		return nil, err
	}
	if expiresAt.Valid {
		return &expiresAt.Time, nil
	}
	return nil, nil
}

// CleanupExpiredTemporaryPermissions revokes expired temporary permissions for a tenant.
func (r *Repository) CleanupExpiredTemporaryPermissions(ctx context.Context, tenantID string) (int, error) {
	result, err := r.db.ExecContext(ctx,
		`UPDATE temporary_permissions SET revoked=true WHERE tenant_id=$1 AND expires_at < NOW() AND revoked=false`,
		tenantID)
	if err != nil {
		return 0, err
	}
	n, _ := result.RowsAffected()
	return int(n), nil
}

// --- Permission requests ---

// CreatePermissionRequest inserts a permission request record with tenant_id.
func (r *Repository) CreatePermissionRequest(ctx context.Context, tenantID string, userID, capabilityID, reason string, durationHours int, envSuffix *string) error {
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO permission_requests (tenant_id, user_id, capability_id, reason, status, duration_hours, environment_suffix, created_at, updated_at)
		VALUES (:tenant_id, :user_id, :capability_id, :reason, :status, :duration_hours, :environment_suffix, :created_at, :updated_at)`,
		map[string]interface{}{
			"tenant_id":          tenantID,
			"user_id":            userID,
			"capability_id":      capabilityID,
			"reason":             reason,
			"status":             "pending",
			"duration_hours":     durationHours,
			"environment_suffix": envSuffix,
			"created_at":         time.Now().UTC(),
			"updated_at":         time.Now().UTC(),
		})
	return err
}

// GetPermissionRequestByID fetches a permission request by ticket ID within a tenant.
func (r *Repository) GetPermissionRequestByID(ctx context.Context, tenantID string, ticketID int) (*models.PermissionRequest, error) {
	var pr models.PermissionRequest
	err := r.db.GetContext(ctx, &pr,
		`SELECT * FROM permission_requests WHERE id=$1 AND tenant_id=$2`, ticketID, tenantID)
	if err != nil {
		return nil, err
	}
	return &pr, nil
}

// GetUserPermissionRequests returns all permission requests for a user within a tenant.
func (r *Repository) GetUserPermissionRequests(ctx context.Context, tenantID, userId string) ([]models.PermissionRequest, error) {
	var items []models.PermissionRequest
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM permission_requests WHERE tenant_id=$1 AND user_id=$2 ORDER BY created_at DESC`, tenantID, userId)
	return items, err
}

func (r *Repository) ApprovePermissionRequest(ctx context.Context, ticketID int, approverID string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE permission_requests SET status='approved', approver_id=$1, updated_at=NOW() WHERE id=$2`,
		approverID, ticketID)
	return err
}

func (r *Repository) RejectPermissionRequest(ctx context.Context, ticketID int, rejecterID string, reason *string) error {
	if reason != nil {
		_, err := r.db.ExecContext(ctx,
			`UPDATE permission_requests SET status='rejected', rejected_by=$1, rejected_reason=$2, updated_at=NOW() WHERE id=$3`,
			rejecterID, *reason, ticketID)
		return err
	}
	_, err := r.db.ExecContext(ctx,
		`UPDATE permission_requests SET status='rejected', rejected_by=$1, updated_at=NOW() WHERE id=$2`,
		rejecterID, ticketID)
	return err
}

// --- Permission check ---

func (r *Repository) CheckPermission(ctx context.Context, tenantID, capabilityID, userID string, userRoles []string) (bool, string, error) {
	// Check temporary permission first
	var activeCount int
	err := r.db.GetContext(ctx, &activeCount,
		`SELECT COUNT(*) FROM temporary_permissions WHERE user_id=$1 AND capability_id=$2 AND expires_at > NOW() AND revoked=false`,
		userID, capabilityID)
	if err != nil {
		return false, "", err
	}
	if activeCount > 0 {
		return true, "active temporary permission", nil
	}

	// Check role-based grant using IN clause
	if len(userRoles) > 0 {
		placeholders := make([]string, len(userRoles))
		args := make([]interface{}, 2+len(userRoles))
		args[0] = capabilityID
		for i, role := range userRoles {
			placeholders[i] = fmt.Sprintf("$%d", i+2)
			args[i+2] = role
		}
		var count int
		err = r.db.GetContext(ctx, &count,
			`SELECT COUNT(*) FROM capability_role_mappings WHERE capability_id=$1 AND role_name IN (`+strings.Join(placeholders, ",")+`)`,
			args...)
		if err != nil {
			return false, "", err
		}
		if count > 0 {
			return true, "role-based grant", nil
		}
	}

	// Check direct user grant
	var userCount int
	err = r.db.GetContext(ctx, &userCount,
		`SELECT COUNT(*) FROM capability_user_mappings WHERE capability_id=$1 AND user_id=$2 AND (expires_at IS NULL OR expires_at > NOW())`,
		capabilityID, userID)
	if err != nil {
		return false, "", err
	}
	if userCount > 0 {
		return true, "direct user grant", nil
	}

	return false, "no permission found", nil
}

// --- Audit logs ---

func (r *Repository) ListAuditLogs(ctx context.Context, tenantID string, q *models.AuditLogQuery) ([]map[string]interface{}, error) {
	var query string
	var args []interface{}

	if q.UserID != nil && q.CapabilityID != nil && q.Action != nil {
		query = `SELECT * FROM permission_audit_logs WHERE tenant_id=$1 AND user_id=$2 AND capability_id=$3 AND action=$4 ORDER BY created_at DESC`
		args = []interface{}{tenantID, *q.UserID, *q.CapabilityID, *q.Action}
	} else if q.UserID != nil && q.CapabilityID != nil {
		query = `SELECT * FROM permission_audit_logs WHERE tenant_id=$1 AND user_id=$2 AND capability_id=$3 ORDER BY created_at DESC`
		args = []interface{}{tenantID, *q.UserID, *q.CapabilityID}
	} else if q.UserID != nil {
		query = `SELECT * FROM permission_audit_logs WHERE tenant_id=$1 AND user_id=$2 ORDER BY created_at DESC`
		args = []interface{}{tenantID, *q.UserID}
	} else if q.CapabilityID != nil {
		query = `SELECT * FROM permission_audit_logs WHERE tenant_id=$1 AND capability_id=$2 ORDER BY created_at DESC`
		args = []interface{}{tenantID, *q.CapabilityID}
	} else {
		query = `SELECT * FROM permission_audit_logs WHERE tenant_id=$1 ORDER BY created_at DESC`
		args = []interface{}{tenantID}
	}

	// Apply pagination if requested
	limit := 50
	offset := 0
	if q.Limit != nil && *q.Limit > 0 {
		limit = *q.Limit
	}
	if q.Offset != nil && *q.Offset > 0 {
		offset = *q.Offset
	}
	if limit > 0 {
		query += fmt.Sprintf(" LIMIT %d OFFSET %d", limit, offset)
	}

	var rows []map[string]interface{}
	err := r.db.SelectContext(ctx, &rows, query, args...)
	return rows, err
}

// GetCapabilityForPermissionRequest checks that a capability exists by capability_id.
func (r *Repository) GetCapabilityForPermissionRequest(ctx context.Context, tenantID, capabilityID string) (*models.Capability, error) {
	var m models.Capability
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM capabilities WHERE capability_id=$1 AND tenant_id=$2`, capabilityID, tenantID)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// InsertAuditLog writes a single permission audit log entry.
func (r *Repository) InsertAuditLog(ctx context.Context, tenantID, action, userID, targetType, targetID, details string) error {
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO permission_audit_logs (tenant_id, action, user_id, target_type, target_id, details, created_at)
		VALUES (:tenant_id, :action, :user_id, :target_type, :target_id, :details, :created_at)`,
		map[string]interface{}{
			"tenant_id":   tenantID,
			"action":      action,
			"user_id":     userID,
			"target_type": targetType,
			"target_id":   targetID,
			"details":     details,
			"created_at":  time.Now().UTC(),
		})
	return err
}

// --- Sentinel errors ---

// ErrPermissionNotFound indicates a temporary permission was not found.
var ErrPermissionNotFound = errors.New("temporary permission not found")

// --- Deprecated helper ---

// NotYetImplemented returns a placeholder error for unimplemented repository methods.
func NotYetImplemented(msg string) error {
	return fmt.Errorf("%s", msg)
}
