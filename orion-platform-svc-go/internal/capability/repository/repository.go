package repository

import (
	"context"
	"fmt"
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

func (r *Repository) CleanupExpiredTemporaryPermissions(ctx context.Context) (int, error) {
	result, err := r.db.ExecContext(ctx,
		`UPDATE temporary_permissions SET revoked=true WHERE expires_at < NOW() AND revoked=false`)
	if err != nil {
		return 0, err
	}
	n, _ := result.RowsAffected()
	return int(n), nil
}

// --- Permission requests ---

func (r *Repository) CreatePermissionRequest(ctx context.Context, tenantID string, userID, capabilityID, reason string, durationHours int, envSuffix *string) error {
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO permission_requests (user_id, capability_id, reason, status, duration_hours, environment_suffix, created_at)
		VALUES (:user_id, :capability_id, :reason, :status, :duration_hours, :environment_suffix, :created_at)`,
		map[string]interface{}{
			"user_id":            userID,
			"capability_id":      capabilityID,
			"reason":             reason,
			"status":             "pending",
			"duration_hours":     durationHours,
			"environment_suffix": envSuffix,
			"created_at":         time.Now().UTC(),
		})
	return err
}

func (r *Repository) GetPermissionRequestByID(ctx context.Context, ticketID int) (*models.PermissionRequest, error) {
	var pr models.PermissionRequest
	err := r.db.GetContext(ctx, &pr,
		`SELECT * FROM permission_requests WHERE id=$1`, ticketID)
	if err != nil {
		return nil, err
	}
	return &pr, nil
}

func (r *Repository) GetUserPermissionRequests(ctx context.Context, tenantID, userId string) ([]models.PermissionRequest, error) {
	var items []models.PermissionRequest
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM permission_requests WHERE user_id=$1 ORDER BY created_at DESC`, userId)
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

	// Check role-based grant
	if len(userRoles) > 0 {
		for _, role := range userRoles {
			var count int
			err = r.db.GetContext(ctx, &count,
				`SELECT COUNT(*) FROM capability_role_mappings WHERE capability_id=$1 AND role_name=$2`,
				capabilityID, role)
			if err != nil {
				return false, "", err
			}
			if count > 0 {
				return true, "role-based grant", nil
			}
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
	var sql string
	var args []interface{}

	if q.UserID != nil && q.CapabilityID != nil && q.Action != nil {
		sql = `SELECT * FROM permission_audit_logs WHERE tenant_id=$1 AND user_id=$2 AND capability_id=$3 AND action=$4 ORDER BY created_at DESC`
		args = []interface{}{tenantID, *q.UserID, *q.CapabilityID, *q.Action}
	} else if q.UserID != nil && q.CapabilityID != nil {
		sql = `SELECT * FROM permission_audit_logs WHERE tenant_id=$1 AND user_id=$2 AND capability_id=$3 ORDER BY created_at DESC`
		args = []interface{}{tenantID, *q.UserID, *q.CapabilityID}
	} else if q.UserID != nil {
		sql = `SELECT * FROM permission_audit_logs WHERE tenant_id=$1 AND user_id=$2 ORDER BY created_at DESC`
		args = []interface{}{tenantID, *q.UserID}
	} else if q.CapabilityID != nil {
		sql = `SELECT * FROM permission_audit_logs WHERE tenant_id=$1 AND capability_id=$2 ORDER BY created_at DESC`
		args = []interface{}{tenantID, *q.CapabilityID}
	} else {
		sql = `SELECT * FROM permission_audit_logs WHERE tenant_id=$1 ORDER BY created_at DESC`
		args = []interface{}{tenantID}
	}

	var rows []map[string]interface{}
	err := r.db.SelectContext(ctx, &rows, sql, args...)
	return rows, err
}

func (r *Repository) GetCapabilityForPermissionRequest(ctx context.Context, tenantID, capabilityID string) (*models.Capability, error) {
	var m models.Capability
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM capabilities WHERE capability_id=$1 AND tenant_id=$2`, capabilityID, tenantID)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func NotYetImplemented(msg string) error {
	return fmt.Errorf("%s", msg)
}
