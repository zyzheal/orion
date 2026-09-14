package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/capability/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// --- Column contracts ---
//
// go-common opens the pool with sqlx.Open and never calls Unsafe, so sqlx scans
// in safe mode and a wildcard select dies on the first row the moment a
// migration adds a column the model does not map --
// "missing destination name <col>". That error is not sql.ErrNoRows, so it
// walks repository -> service -> handler and every read endpoint answers 500
// instead of data. capabilities gained deleted_at/created_by/updated_by in
// migration 571/572, none of which the model maps, so GetByID, List,
// ListByCategory, ListRoot, ListByParent and GetParent were all 500s: the whole
// capability catalogue was unreadable.
const capabilityColumns = "id, tenant_id, name, parent_capability_id, created_at, updated_at"

// temporaryPermissionColumns names exactly the columns
// models.TemporaryPermission maps. revoked_at is the revocation marker -- the
// table has no revoked boolean, so the old "AND revoked=false" predicated on a
// column that does not exist and answered
// "column \"revoked\" of relation \"temporary_permissions\" does not exist".
const temporaryPermissionColumns = "id, tenant_id, user_id, capability_id, environment_suffix, " +
	"reason, granted_by, granted_at, expires_at, revoked_at, created_at"

// permissionRequestColumns names exactly the columns models.PermissionRequest
// maps. duration_hours, environment_suffix, approver_id, rejected_by and
// rejected_reason were added by migration 582: before that the INSERT named
// columns the table did not have, so CreatePermissionRequest was a 500 and
// ApproveRequest wrote approver_id into a table without the column.
const permissionRequestColumns = "id, tenant_id, user_id, capability_id, status, reason, " +
	"approver_id, rejected_by, rejected_reason, duration_hours, environment_suffix, " +
	"created_at, updated_at"

// capabilityAuditLogColumns names exactly the columns models.AuditLog maps.
//
// The table is capability_audit_logs, not permission_audit_logs: only
// capability_audit_logs has target_type, target_id and details. The repository
// used to INSERT into permission_audit_logs with those three columns, which
// never parsed -- so this module's audit trail was written nowhere at all,
// while ListAuditLogs selected from the same empty table. Both halves now point
// at the table that has the columns.
const capabilityAuditLogColumns = "id, tenant_id, action, user_id, target_type, target_id, details, created_at"

// allowedColumns is the whitelist for the dynamic SET clause in Update.
var allowedColumns = map[string]struct{}{
	"name":                 {},
	"parent_capability_id": {},
}

// ErrNoUpdatableFields means the caller passed an update set that contains no
// whitelisted column. Returning an error matters: the old implementation
// accepted the map, ignored it and ran a bare UPDATE ... SET updated_at=NOW(),
// so renaming a capability answered success and changed nothing.
var ErrNoUpdatableFields = errors.New("no updatable fields")

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
	query := `INSERT INTO capabilities (id, tenant_id, name, parent_capability_id, created_at, updated_at)
		VALUES (:id, :tenant_id, :name, :parent_capability_id, :created_at, :updated_at)`
	_, err := r.db.NamedExecContext(ctx, query, m)
	return err
}

// GetByID retrieves a single capability by id and tenant_id.
//
// sql.ErrNoRows becomes sentinel.NotFound: the handler answers 404 only for
// service.IsNotFound, which matches sentinel.NotFound, so a missing id would
// otherwise be a 500 "sql: no rows".
func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.Capability, error) {
	var m models.Capability
	err := r.db.GetContext(ctx, &m,
		`SELECT `+capabilityColumns+` FROM capabilities WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, sentinel.NotFound
		}
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
		`SELECT `+capabilityColumns+` FROM capabilities WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, tenantID, limit, offset)
	return items, err
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
		`SELECT `+capabilityColumns+` FROM capabilities WHERE tenant_id=$1 AND name ILIKE $2 ORDER BY created_at DESC LIMIT $3 OFFSET $4`,
		tenantID, "%"+category+"%", limit, offset)
	return items, err
}

// ListRoot returns the capabilities that have no parent.
//
// parent_capability_id is a UUID column, so a root is only "parent_capability_id
// IS NULL": comparing a UUID with an empty string does not parse. The old
// predicate also failed because the column itself did not exist until
// migration 582, so the whole capability tree endpoint was a 500.
func (r *Repository) ListRoot(ctx context.Context, tenantID string) ([]models.Capability, error) {
	var items []models.Capability
	err := r.db.SelectContext(ctx, &items,
		`SELECT `+capabilityColumns+` FROM capabilities WHERE tenant_id=$1 AND parent_capability_id IS NULL ORDER BY created_at`, tenantID)
	return items, err
}

func (r *Repository) ListByParent(ctx context.Context, tenantID, parentCapabilityID string) ([]models.Capability, error) {
	var items []models.Capability
	err := r.db.SelectContext(ctx, &items,
		`SELECT `+capabilityColumns+` FROM capabilities WHERE tenant_id=$1 AND parent_capability_id=$2`, tenantID, parentCapabilityID)
	return items, err
}

// Update applies a whitelisted SET clause keyed on id AND tenant_id.
//
// The old body accepted the updates map and never used it, running a bare
// "UPDATE capabilities SET updated_at=NOW()" instead: a rename answered nil
// and changed nothing. The keys are sorted so the rendered SQL is deterministic,
// and the id/tenant placeholders always sit at the two trailing positions.
func (r *Repository) Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	if len(updates) == 0 {
		return ErrNoUpdatableFields
	}
	keys := make([]string, 0, len(updates))
	for k := range updates {
		if _, ok := allowedColumns[k]; !ok {
			return fmt.Errorf("unknown column %q", k)
		}
		keys = append(keys, k)
	}
	sort.Strings(keys)

	setClauses := make([]string, 0, len(keys)+1)
	args := make([]interface{}, 0, len(keys)+2)
	idx := 1
	for _, k := range keys {
		setClauses = append(setClauses, fmt.Sprintf("%s=$%d", k, idx))
		args = append(args, updates[k])
		idx++
	}
	setClauses = append(setClauses, "updated_at=NOW()")
	args = append(args, id, tenantID)

	query := fmt.Sprintf("UPDATE capabilities SET %s WHERE id=$%d AND tenant_id=$%d",
		strings.Join(setClauses, ", "), idx, idx+1)
	_, err := r.db.ExecContext(ctx, query, args...)
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
		`SELECT `+capabilityColumns+` FROM capabilities WHERE id=$1 AND tenant_id=$2`, parentCapabilityID, tenantID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, sentinel.NotFound
		}
		return nil, err
	}
	return &m, nil
}

// --- Command mappings ---

func (r *Repository) InsertCommandMapping(ctx context.Context, tenantID string, capID string, cmdName, cmdAction string, envSuffix *string) error {
	env := ""
	if envSuffix != nil {
		env = *envSuffix
	}
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
			"environment_suffix": env,
		})
	return err
}

// GetCapabilityIDForCommand returns the capability id mapped to a command+action.
// An empty env matches the tenant-wide mapping, stored with environment_suffix=""
//
// environment_suffix is NOT NULL DEFAULT "", so the match predicate is ="" rather
// than IS NULL. With a nullable column the ON CONFLICT above would never have
// fired -- plain UNIQUE treats every NULL as distinct -- and the SELECT below
// would have returned several rows into a scalar destination with
// "sql: multiple rows returned".
func (r *Repository) GetCapabilityIDForCommand(ctx context.Context, tenantID, command, action, env string) (string, error) {
	var capabilityID string
	err := r.db.GetContext(ctx, &capabilityID,
		`SELECT capability_id FROM command_capability_mappings
			WHERE tenant_id=$1 AND command_name=$2 AND command_action=$3 AND environment_suffix=$4`,
		tenantID, command, action, env)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", nil
		}
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
	return ids, err
}

// ListCapabilityIDsByUser returns all non-expired capability IDs directly assigned to a user.
func (r *Repository) ListCapabilityIDsByUser(ctx context.Context, tenantID, userID string) ([]string, error) {
	var ids []string
	err := r.db.SelectContext(ctx, &ids,
		`SELECT capability_id FROM capability_user_mappings
			WHERE tenant_id=$1 AND user_id=$2 AND (expires_at IS NULL OR expires_at > NOW())`,
		tenantID, userID)
	return ids, err
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
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	if expiresAt.Valid {
		return &expiresAt.Time, nil
	}
	return nil, nil
}

// --- Temporary permissions ---

// GrantTemporaryPermission inserts an admin-issued temporary permission.
//
// reason and granted_at are both NOT NULL with no default, so omitting either
// makes the INSERT fail at the server:
// "null value in column \"reason\" ... violates not-null constraint" and the
// same for granted_at. Both halves of this module therefore answered 500.
func (r *Repository) GrantTemporaryPermission(ctx context.Context, tenantID string, userID, capabilityID, grantedBy, reason string, envSuffix *string, expiresInHours int) error {
	now := time.Now().UTC()
	env := ""
	if envSuffix != nil {
		env = *envSuffix
	}
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO temporary_permissions (user_id, tenant_id, capability_id, environment_suffix, reason, granted_by, granted_at, expires_at, created_at)
		VALUES (:user_id, :tenant_id, :capability_id, :environment_suffix, :reason, :granted_by, :granted_at, :expires_at, :created_at)`,
		map[string]interface{}{
			"user_id":            userID,
			"tenant_id":          tenantID,
			"capability_id":      capabilityID,
			"environment_suffix": env,
			"reason":             reason,
			"granted_by":         grantedBy,
			"granted_at":         now,
			"expires_at":         now.Add(time.Duration(expiresInHours) * time.Hour),
			"created_at":         now,
		})
	return err
}

func (r *Repository) GetActiveTemporaryPermissions(ctx context.Context, tenantID, userId string) ([]models.TemporaryPermission, error) {
	var items []models.TemporaryPermission
	err := r.db.SelectContext(ctx, &items,
		`SELECT `+temporaryPermissionColumns+` FROM temporary_permissions WHERE user_id=$1 AND tenant_id=$2 AND expires_at > NOW() AND revoked_at IS NULL`,
		userId, tenantID)
	return items, err
}

// RevokeTemporaryPermissionByID marks a temporary permission revoked.
//
// The predicate is revoked_at IS NULL so an already-revoked row cannot be
// revoked twice and the marker is idempotent, and the row is keyed on tenant_id
// so one tenant cannot revoke another tenant's grant. The revoker has nowhere to
// be persisted -- the table has no revoked_by column -- so the audit entry
// written by the caller is the only record of who revoked it.
func (r *Repository) RevokeTemporaryPermissionByID(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE temporary_permissions SET revoked_at=NOW() WHERE id=$1 AND tenant_id=$2 AND revoked_at IS NULL`,
		id, tenantID)
	return err
}

// GetTemporaryPermissionByID fetches a temporary permission by its UUID.
//
// id is a string because the column is UUID: with an int argument a legitimate
// request fails in the driver with "invalid input syntax for type uuid" before
// any SQL is sent.
func (r *Repository) GetTemporaryPermissionByID(ctx context.Context, tenantID string, id string) (*models.TemporaryPermission, error) {
	var perm models.TemporaryPermission
	err := r.db.GetContext(ctx, &perm,
		`SELECT `+temporaryPermissionColumns+` FROM temporary_permissions WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, sentinel.NotFound
		}
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
			AND expires_at > NOW() AND revoked_at IS NULL`,
		tenantID, capabilityID, userID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
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
		`UPDATE temporary_permissions SET revoked_at=NOW() WHERE tenant_id=$1 AND expires_at < NOW() AND revoked_at IS NULL`,
		tenantID)
	if err != nil {
		return 0, err
	}
	n, _ := result.RowsAffected()
	return int(n), nil
}

// --- Permission requests ---

// CreatePermissionRequest inserts a permission request record with tenant_id.
func (r *Repository) CreatePermissionRequest(ctx context.Context, tenantID string, userID, capabilityID, reason string, durationHours *int, envSuffix *string) error {
	env := ""
	if envSuffix != nil {
		env = *envSuffix
	}
	now := time.Now().UTC()
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
			"environment_suffix": env,
			"created_at":         now,
			"updated_at":         now,
		})
	return err
}

// GetPermissionRequestByID fetches a permission request by id within a tenant.
func (r *Repository) GetPermissionRequestByID(ctx context.Context, tenantID string, ticketID string) (*models.PermissionRequest, error) {
	var pr models.PermissionRequest
	err := r.db.GetContext(ctx, &pr,
		`SELECT `+permissionRequestColumns+` FROM permission_requests WHERE id=$1 AND tenant_id=$2`, ticketID, tenantID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, sentinel.NotFound
		}
		return nil, err
	}
	return &pr, nil
}

// GetUserPermissionRequests returns all permission requests for a user within a tenant.
func (r *Repository) GetUserPermissionRequests(ctx context.Context, tenantID, userId string) ([]models.PermissionRequest, error) {
	var items []models.PermissionRequest
	err := r.db.SelectContext(ctx, &items,
		`SELECT `+permissionRequestColumns+` FROM permission_requests WHERE tenant_id=$1 AND user_id=$2 ORDER BY created_at DESC`, tenantID, userId)
	return items, err
}

// ApprovePermissionRequest flips a request to approved and records who approved
// it. The row is keyed on tenant_id: the old statement wrote by id alone, so any
// tenant could approve another tenant's request.
func (r *Repository) ApprovePermissionRequest(ctx context.Context, tenantID, ticketID, approverID string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE permission_requests SET status='approved', approver_id=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3`,
		approverID, ticketID, tenantID)
	return err
}

// RejectPermissionRequest flips a request to rejected and records who rejected
// it. Both branches are keyed on tenant_id for the same reason.
func (r *Repository) RejectPermissionRequest(ctx context.Context, tenantID, ticketID, rejecterID string, reason *string) error {
	if reason != nil {
		_, err := r.db.ExecContext(ctx,
			`UPDATE permission_requests SET status='rejected', rejected_by=$1, rejected_reason=$2, updated_at=NOW() WHERE id=$3 AND tenant_id=$4`,
			rejecterID, *reason, ticketID, tenantID)
		return err
	}
	_, err := r.db.ExecContext(ctx,
		`UPDATE permission_requests SET status='rejected', rejected_by=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3`,
		rejecterID, ticketID, tenantID)
	return err
}

// --- Permission check ---

func (r *Repository) CheckPermission(ctx context.Context, tenantID, capabilityID, userID string, userRoles []string) (bool, string, error) {
	// Check temporary permission first
	var activeCount int
	err := r.db.GetContext(ctx, &activeCount,
		`SELECT COUNT(*) FROM temporary_permissions WHERE tenant_id=$1 AND user_id=$2 AND capability_id=$3 AND expires_at > NOW() AND revoked_at IS NULL`,
		tenantID, userID, capabilityID)
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
		args[0] = tenantID
		args[1] = capabilityID
		for i, role := range userRoles {
			placeholders[i] = fmt.Sprintf("$%d", i+3)
			args[i+2] = role
		}
		var count int
		err = r.db.GetContext(ctx, &count,
			`SELECT COUNT(*) FROM capability_role_mappings WHERE tenant_id=$1 AND capability_id=$2 AND role_name IN (`+strings.Join(placeholders, ",")+`)`,
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
		`SELECT COUNT(*) FROM capability_user_mappings WHERE tenant_id=$1 AND capability_id=$2 AND user_id=$3 AND (expires_at IS NULL OR expires_at > NOW())`,
		tenantID, capabilityID, userID)
	if err != nil {
		return false, "", err
	}
	if userCount > 0 {
		return true, "direct user grant", nil
	}

	return false, "no permission found", nil
}

// --- Audit logs ---

// ListAuditLogs returns permission audit log entries for a tenant.
//
// The predicate is built incrementally so every placeholder is numbered from the
// argument count, and limit/offset are bound parameters rather than interpolated
// integers -- they come from a query string.
func (r *Repository) ListAuditLogs(ctx context.Context, tenantID string, q *models.AuditLogQuery) ([]models.AuditLog, error) {
	cond := "WHERE tenant_id=$1"
	args := []interface{}{tenantID}

	if q.UserID != nil {
		cond += fmt.Sprintf(" AND user_id=$%d", len(args)+1)
		args = append(args, *q.UserID)
	}
	if q.CapabilityID != nil {
		// capability_audit_logs records a capability on target_id, not on a
		// capability_id column; mapping the query onto a column that does not
		// exist is how this method used to answer
		// "column \"capability_id\" does not exist".
		cond += fmt.Sprintf(" AND target_id=$%d", len(args)+1)
		args = append(args, *q.CapabilityID)
	}
	if q.TargetID != "" {
		cond += fmt.Sprintf(" AND target_id=$%d", len(args)+1)
		args = append(args, q.TargetID)
	}
	if q.Action != nil {
		cond += fmt.Sprintf(" AND action=$%d", len(args)+1)
		args = append(args, *q.Action)
	}
	if q.From != "" {
		cond += fmt.Sprintf(" AND created_at >= $%d", len(args)+1)
		args = append(args, q.From)
	}
	if q.To != "" {
		cond += fmt.Sprintf(" AND created_at <= $%d", len(args)+1)
		args = append(args, q.To)
	}

	limit := 50
	if q.Limit != nil && *q.Limit > 0 {
		limit = *q.Limit
	}
	offset := 0
	if q.Offset != nil && *q.Offset > 0 {
		offset = *q.Offset
	}
	cond += fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d OFFSET $%d", len(args)+1, len(args)+2)
	args = append(args, limit, offset)

	var items []models.AuditLog
	err := r.db.SelectContext(ctx, &items,
		`SELECT `+capabilityAuditLogColumns+` FROM capability_audit_logs `+cond, args...)
	return items, err
}

// InsertAuditLog writes a single permission audit log entry.
func (r *Repository) InsertAuditLog(ctx context.Context, tenantID, action, userID, targetType, targetID, details string) error {
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO capability_audit_logs (tenant_id, action, user_id, target_type, target_id, details, created_at)
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
