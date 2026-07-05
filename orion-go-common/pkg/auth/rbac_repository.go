package auth

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jmoiron/sqlx"
)

// RBACRepository provides database-backed CRUD for RBAC/ABAC tables.
// Tables: roles, permissions, role_permissions, user_roles, role_inheritance,
//
//	abac_policies, project_members, permission_audit_logs
type RBACRepository struct {
	db *sqlx.DB
}

// NewRBACRepository creates a new RBACRepository.
func NewRBACRepository(db *sqlx.DB) *RBACRepository {
	return &RBACRepository{db: db}
}

// ──────────────────────────────────────────────────────────────────────────────
// Role
// ──────────────────────────────────────────────────────────────────────────────

// Role represents a row in the roles table.
type Role struct {
	ID          string    `db:"id"`
	TenantID    string    `db:"tenant_id"`
	Name        string    `db:"name"`
	Description string    `db:"description"`
	IsSystem    bool      `db:"is_system"`
	CreatedAt   time.Time `db:"created_at"`
	UpdatedAt   time.Time `db:"updated_at"`
}

// GetRoleByID fetches a role by ID within a tenant.
func (r *RBACRepository) GetRoleByID(ctx context.Context, tenantID, id string) (*Role, error) {
	var role Role
	err := r.db.GetContext(ctx, &role,
		`SELECT id, tenant_id, name, description, is_system, created_at, updated_at
		 FROM roles WHERE tenant_id = $1 AND id = $2`, tenantID, id)
	if err != nil {
		return nil, err
	}
	return &role, nil
}

// ListRoles returns all roles for a tenant.
func (r *RBACRepository) ListRoles(ctx context.Context, tenantID string) ([]Role, error) {
	var roles []Role
	err := r.db.SelectContext(ctx, &roles,
		`SELECT id, tenant_id, name, description, is_system, created_at, updated_at
		 FROM roles WHERE tenant_id = $1 ORDER BY name`, tenantID)
	return roles, err
}

// CreateRole inserts a new role.
func (r *RBACRepository) CreateRole(ctx context.Context, role *Role) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO roles (id, tenant_id, name, description, is_system)
		 VALUES ($1, $2, $3, $4, $5)`,
		role.ID, role.TenantID, role.Name, role.Description, role.IsSystem)
	return err
}

// UpdateRole updates a role's name and description.
func (r *RBACRepository) UpdateRole(ctx context.Context, tenantID, id, name, description string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE roles SET name = $1, description = $2, updated_at = now()
		 WHERE tenant_id = $3 AND id = $4`, name, description, tenantID, id)
	return err
}

// DeleteRole deletes a non-system role.
func (r *RBACRepository) DeleteRole(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM roles WHERE tenant_id = $1 AND id = $2 AND is_system = false`, tenantID, id)
	return err
}

// ──────────────────────────────────────────────────────────────────────────────
// User Roles
// ──────────────────────────────────────────────────────────────────────────────

// UserRole represents a row in the user_roles table.
type UserRole struct {
	ID        string    `db:"id"`
	TenantID  string    `db:"tenant_id"`
	UserID    string    `db:"user_id"`
	RoleID    string    `db:"role_id"`
	CreatedAt time.Time `db:"created_at"`
}

// AssignRole assigns a role to a user within a tenant.
func (r *RBACRepository) AssignRole(ctx context.Context, tenantID, userID, roleID string) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO user_roles (tenant_id, user_id, role_id) VALUES ($1, $2, $3)
		 ON CONFLICT (tenant_id, user_id, role_id) DO NOTHING`,
		tenantID, userID, roleID)
	return err
}

// RevokeRole removes a role assignment.
func (r *RBACRepository) RevokeRole(ctx context.Context, tenantID, userID, roleID string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM user_roles WHERE tenant_id = $1 AND user_id = $2 AND role_id = $3`,
		tenantID, userID, roleID)
	return err
}

// GetUserRoles returns all role IDs assigned to a user within a tenant.
func (r *RBACRepository) GetUserRoles(ctx context.Context, tenantID, userID string) ([]string, error) {
	var roleIDs []string
	err := r.db.SelectContext(ctx, &roleIDs,
		`SELECT role_id FROM user_roles WHERE tenant_id = $1 AND user_id = $2`,
		tenantID, userID)
	return roleIDs, err
}

// GetUserRolesWithDetails returns role details for a user.
func (r *RBACRepository) GetUserRolesWithDetails(ctx context.Context, tenantID, userID string) ([]Role, error) {
	var roles []Role
	err := r.db.SelectContext(ctx, &roles,
		`SELECT r.id, r.tenant_id, r.name, r.description, r.is_system, r.created_at, r.updated_at
		 FROM roles r
		 INNER JOIN user_roles ur ON ur.role_id = r.id AND ur.tenant_id = r.tenant_id
		 WHERE ur.tenant_id = $1 AND ur.user_id = $2
		 ORDER BY r.name`, tenantID, userID)
	return roles, err
}

// ListUsersByRole returns all user IDs with a specific role.
func (r *RBACRepository) ListUsersByRole(ctx context.Context, tenantID, roleID string) ([]string, error) {
	var userIDs []string
	err := r.db.SelectContext(ctx, &userIDs,
		`SELECT user_id FROM user_roles WHERE tenant_id = $1 AND role_id = $2`,
		tenantID, roleID)
	return userIDs, err
}

// SetUserRoles replaces all roles for a user (delete + re-insert).
func (r *RBACRepository) SetUserRoles(ctx context.Context, tenantID, userID string, roleIDs []string) error {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	_, err = tx.ExecContext(ctx,
		`DELETE FROM user_roles WHERE tenant_id = $1 AND user_id = $2`, tenantID, userID)
	if err != nil {
		return err
	}

	for _, roleID := range roleIDs {
		_, err = tx.ExecContext(ctx,
			`INSERT INTO user_roles (tenant_id, user_id, role_id) VALUES ($1, $2, $3)`,
			tenantID, userID, roleID)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

// ──────────────────────────────────────────────────────────────────────────────
// Role Inheritance
// ──────────────────────────────────────────────────────────────────────────────

// RoleInheritance represents a row in the role_inheritance table.
type RoleInheritance struct {
	ID           string    `db:"id"`
	TenantID     string    `db:"tenant_id"`
	RoleID       string    `db:"role_id"`
	ParentRoleID string    `db:"parent_role_id"`
	CreatedAt    time.Time `db:"created_at"`
}

// AddInheritance adds a parent role for a given role.
func (r *RBACRepository) AddInheritance(ctx context.Context, tenantID, roleID, parentRoleID string) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO role_inheritance (tenant_id, role_id, parent_role_id)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (tenant_id, role_id, parent_role_id) DO NOTHING`,
		tenantID, roleID, parentRoleID)
	return err
}

// RemoveInheritance removes a parent role relationship.
func (r *RBACRepository) RemoveInheritance(ctx context.Context, tenantID, roleID, parentRoleID string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM role_inheritance
		 WHERE tenant_id = $1 AND role_id = $2 AND parent_role_id = $3`,
		tenantID, roleID, parentRoleID)
	return err
}

// GetParentRoles returns the direct parent role IDs for a given role.
func (r *RBACRepository) GetParentRoles(ctx context.Context, tenantID, roleID string) ([]string, error) {
	var parentIDs []string
	err := r.db.SelectContext(ctx, &parentIDs,
		`SELECT parent_role_id FROM role_inheritance
		 WHERE tenant_id = $1 AND role_id = $2`, tenantID, roleID)
	return parentIDs, err
}

// GetChildRoles returns the direct child role IDs for a given parent role.
func (r *RBACRepository) GetChildRoles(ctx context.Context, tenantID, parentRoleID string) ([]string, error) {
	var childIDs []string
	err := r.db.SelectContext(ctx, &childIDs,
		`SELECT role_id FROM role_inheritance
		 WHERE tenant_id = $1 AND parent_role_id = $2`, tenantID, parentRoleID)
	return childIDs, err
}

// ExpandInheritanceChain returns all ancestor role IDs for a role (recursive).
// Uses a CTE to traverse the inheritance chain up to 10 levels deep.
func (r *RBACRepository) ExpandInheritanceChain(ctx context.Context, tenantID, roleID string) ([]string, error) {
	var ancestors []string
	err := r.db.SelectContext(ctx, &ancestors, `
		WITH RECURSIVE chain AS (
			SELECT parent_role_id, 1 AS depth
			FROM role_inheritance
			WHERE tenant_id = $1 AND role_id = $2
			UNION ALL
			SELECT ri.parent_role_id, c.depth + 1
			FROM role_inheritance ri
			JOIN chain c ON ri.role_id = c.parent_role_id
			WHERE ri.tenant_id = $1 AND c.depth < 10
		)
		SELECT DISTINCT parent_role_id FROM chain
	`, tenantID, roleID)
	return ancestors, err
}

// ListInheritance returns all inheritance relationships for a tenant.
func (r *RBACRepository) ListInheritance(ctx context.Context, tenantID string) ([]RoleInheritance, error) {
	var items []RoleInheritance
	err := r.db.SelectContext(ctx, &items,
		`SELECT id, tenant_id, role_id, parent_role_id, created_at
		 FROM role_inheritance WHERE tenant_id = $1 ORDER BY role_id`, tenantID)
	return items, err
}

// ──────────────────────────────────────────────────────────────────────────────
// ABAC Policies
// ──────────────────────────────────────────────────────────────────────────────

// ABACPolicyDB represents a row in the abac_policies table.
type ABACPolicyDB struct {
	ID          string          `db:"id"`
	TenantID    string          `db:"tenant_id"`
	Name        string          `db:"name"`
	Description string          `db:"description"`
	Effect      string          `db:"effect"`
	Resource    string          `db:"resource"`
	Action      string          `db:"action"`
	Conditions  json.RawMessage `db:"conditions"`
	Priority    int             `db:"priority"`
	Enabled     bool            `db:"enabled"`
	CreatedBy   sql.NullString  `db:"created_by"`
	CreatedAt   time.Time       `db:"created_at"`
	UpdatedAt   time.Time       `db:"updated_at"`
}

// CreatePolicy inserts a new ABAC policy.
func (r *RBACRepository) CreatePolicy(ctx context.Context, p *ABACPolicyDB) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO abac_policies (id, tenant_id, name, description, effect, resource, action, conditions, priority, enabled, created_by)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
		p.ID, p.TenantID, p.Name, p.Description, p.Effect, p.Resource, p.Action,
		p.Conditions, p.Priority, p.Enabled, p.CreatedBy)
	return err
}

// GetPolicyByID fetches a policy by ID within a tenant.
func (r *RBACRepository) GetPolicyByID(ctx context.Context, tenantID, id string) (*ABACPolicyDB, error) {
	var p ABACPolicyDB
	err := r.db.GetContext(ctx, &p,
		`SELECT id, tenant_id, name, description, effect, resource, action, conditions, priority, enabled, created_by, created_at, updated_at
		 FROM abac_policies WHERE tenant_id = $1 AND id = $2`, tenantID, id)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// ListPolicies returns all ABAC policies for a tenant.
func (r *RBACRepository) ListPolicies(ctx context.Context, tenantID string) ([]ABACPolicyDB, error) {
	var policies []ABACPolicyDB
	err := r.db.SelectContext(ctx, &policies,
		`SELECT id, tenant_id, name, description, effect, resource, action, conditions, priority, enabled, created_by, created_at, updated_at
		 FROM abac_policies WHERE tenant_id = $1 ORDER BY priority DESC, name`, tenantID)
	return policies, err
}

// ListEnabledPolicies returns all enabled ABAC policies for a tenant.
func (r *RBACRepository) ListEnabledPolicies(ctx context.Context, tenantID string) ([]ABACPolicyDB, error) {
	var policies []ABACPolicyDB
	err := r.db.SelectContext(ctx, &policies,
		`SELECT id, tenant_id, name, description, effect, resource, action, conditions, priority, enabled, created_by, created_at, updated_at
		 FROM abac_policies WHERE tenant_id = $1 AND enabled = true ORDER BY priority DESC`, tenantID)
	return policies, err
}

// UpdatePolicy updates an ABAC policy.
func (r *RBACRepository) UpdatePolicy(ctx context.Context, tenantID, id string, p *ABACPolicyDB) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE abac_policies
		 SET name = $1, description = $2, effect = $3, resource = $4, action = $5,
		     conditions = $6, priority = $7, enabled = $8, updated_at = now()
		 WHERE tenant_id = $9 AND id = $10`,
		p.Name, p.Description, p.Effect, p.Resource, p.Action,
		p.Conditions, p.Priority, p.Enabled, tenantID, id)
	return err
}

// DeletePolicy deletes an ABAC policy.
func (r *RBACRepository) DeletePolicy(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM abac_policies WHERE tenant_id = $1 AND id = $2`, tenantID, id)
	return err
}

// ──────────────────────────────────────────────────────────────────────────────
// Project Members
// ──────────────────────────────────────────────────────────────────────────────

// ProjectMember represents a row in the project_members table.
type ProjectMember struct {
	ID        string    `db:"id"`
	TenantID  string    `db:"tenant_id"`
	ProjectID string    `db:"project_id"`
	UserID    string    `db:"user_id"`
	Role      string    `db:"role"`
	CreatedAt time.Time `db:"created_at"`
	UpdatedAt time.Time `db:"updated_at"`
}

// AddProjectMember adds a user to a project with a role.
func (r *RBACRepository) AddProjectMember(ctx context.Context, m *ProjectMember) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO project_members (id, tenant_id, project_id, user_id, role)
		 VALUES ($1, $2, $3, $4, $5)
		 ON CONFLICT (tenant_id, project_id, user_id) DO UPDATE SET role = $5, updated_at = now()`,
		m.ID, m.TenantID, m.ProjectID, m.UserID, m.Role)
	return err
}

// RemoveProjectMember removes a user from a project.
func (r *RBACRepository) RemoveProjectMember(ctx context.Context, tenantID, projectID, userID string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM project_members
		 WHERE tenant_id = $1 AND project_id = $2 AND user_id = $3`,
		tenantID, projectID, userID)
	return err
}

// GetProjectMember returns a specific project member.
func (r *RBACRepository) GetProjectMember(ctx context.Context, tenantID, projectID, userID string) (*ProjectMember, error) {
	var m ProjectMember
	err := r.db.GetContext(ctx, &m,
		`SELECT id, tenant_id, project_id, user_id, role, created_at, updated_at
		 FROM project_members WHERE tenant_id = $1 AND project_id = $2 AND user_id = $3`,
		tenantID, projectID, userID)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// ListProjectMembers returns all members of a project.
func (r *RBACRepository) ListProjectMembers(ctx context.Context, tenantID, projectID string) ([]ProjectMember, error) {
	var members []ProjectMember
	err := r.db.SelectContext(ctx, &members,
		`SELECT id, tenant_id, project_id, user_id, role, created_at, updated_at
		 FROM project_members WHERE tenant_id = $1 AND project_id = $2 ORDER BY role, user_id`,
		tenantID, projectID)
	return members, err
}

// UpdateProjectMemberRole updates a member's role in a project.
func (r *RBACRepository) UpdateProjectMemberRole(ctx context.Context, tenantID, projectID, userID, role string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE project_members SET role = $1, updated_at = now()
		 WHERE tenant_id = $2 AND project_id = $3 AND user_id = $4`,
		role, tenantID, projectID, userID)
	return err
}

// ListUserProjects returns all project IDs a user is a member of.
func (r *RBACRepository) ListUserProjects(ctx context.Context, tenantID, userID string) ([]ProjectMember, error) {
	var members []ProjectMember
	err := r.db.SelectContext(ctx, &members,
		`SELECT id, tenant_id, project_id, user_id, role, created_at, updated_at
		 FROM project_members WHERE tenant_id = $1 AND user_id = $2 ORDER BY project_id`,
		tenantID, userID)
	return members, err
}

// ──────────────────────────────────────────────────────────────────────────────
// Permission Audit Logs
// ──────────────────────────────────────────────────────────────────────────────

// PermissionAuditLog represents a row in the permission_audit_logs table.
type PermissionAuditLog struct {
	ID         string         `db:"id"`
	TenantID   string         `db:"tenant_id"`
	UserID     string         `db:"user_id"`
	Resource   string         `db:"resource"`
	Action     string         `db:"action"`
	ResourceID sql.NullString `db:"resource_id"`
	Decision   string         `db:"decision"`
	Source     string         `db:"source"`
	Reason     sql.NullString `db:"reason"`
	IPAddress  sql.NullString `db:"ip_address"`
	UserAgent  sql.NullString `db:"user_agent"`
	RequestID  sql.NullString `db:"request_id"`
	ChainHash  sql.NullString `db:"chain_hash"`
	PrevHash   sql.NullString `db:"prev_hash"`
	CreatedAt  time.Time      `db:"created_at"`
}

// CreateAuditLog inserts a new permission audit log entry.
func (r *RBACRepository) CreateAuditLog(ctx context.Context, log *PermissionAuditLog) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO permission_audit_logs
		 (id, tenant_id, user_id, resource, action, resource_id, decision, source, reason, ip_address, user_agent, request_id, chain_hash, prev_hash)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
		log.ID, log.TenantID, log.UserID, log.Resource, log.Action, log.ResourceID,
		log.Decision, log.Source, log.Reason, log.IPAddress, log.UserAgent,
		log.RequestID, log.ChainHash, log.PrevHash)
	return err
}

// ListAuditLogs returns audit logs for a tenant with pagination.
func (r *RBACRepository) ListAuditLogs(ctx context.Context, tenantID string, limit, offset int) ([]PermissionAuditLog, error) {
	var logs []PermissionAuditLog
	err := r.db.SelectContext(ctx, &logs,
		`SELECT id, tenant_id, user_id, resource, action, resource_id, decision, source, reason, ip_address, user_agent, request_id, chain_hash, prev_hash, created_at
		 FROM permission_audit_logs
		 WHERE tenant_id = $1
		 ORDER BY created_at DESC
		 LIMIT $2 OFFSET $3`, tenantID, limit, offset)
	return logs, err
}

// ListAuditLogsByUser returns audit logs for a specific user.
func (r *RBACRepository) ListAuditLogsByUser(ctx context.Context, tenantID, userID string, limit, offset int) ([]PermissionAuditLog, error) {
	var logs []PermissionAuditLog
	err := r.db.SelectContext(ctx, &logs,
		`SELECT id, tenant_id, user_id, resource, action, resource_id, decision, source, reason, ip_address, user_agent, request_id, chain_hash, prev_hash, created_at
		 FROM permission_audit_logs
		 WHERE tenant_id = $1 AND user_id = $2
		 ORDER BY created_at DESC
		 LIMIT $3 OFFSET $4`, tenantID, userID, limit, offset)
	return logs, err
}

// GetLastAuditHash returns the chain_hash of the most recent audit log for a tenant.
// Used for chain hash computation (Phase 4 tamper-proofing).
func (r *RBACRepository) GetLastAuditHash(ctx context.Context, tenantID string) (string, error) {
	var hash sql.NullString
	err := r.db.GetContext(ctx, &hash,
		`SELECT chain_hash FROM permission_audit_logs
		 WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 1`, tenantID)
	if err == sql.ErrNoRows {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	return hash.String, nil
}

// CountAuditLogs returns the total number of audit logs for a tenant.
func (r *RBACRepository) CountAuditLogs(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM permission_audit_logs WHERE tenant_id = $1`, tenantID)
	return count, err
}

// ──────────────────────────────────────────────────────────────────────────────
// Permission (read-only)
// ──────────────────────────────────────────────────────────────────────────────

// Permission represents a row in the permissions table.
type Permission struct {
	ID          string `db:"id"`
	Resource    string `db:"resource"`
	Action      string `db:"action"`
	Description string `db:"description"`
}

// ListPermissions returns all defined permissions.
func (r *RBACRepository) ListPermissions(ctx context.Context) ([]Permission, error) {
	var perms []Permission
	err := r.db.SelectContext(ctx, &perms,
		`SELECT id, resource, action, description FROM permissions ORDER BY resource, action`)
	return perms, err
}

// GetRolePermissions returns the permission strings (resource:action) for a role.
func (r *RBACRepository) GetRolePermissions(ctx context.Context, tenantID, roleID string) ([]string, error) {
	var perms []string
	err := r.db.SelectContext(ctx, &perms,
		`SELECT p.resource || ':' || p.action
		 FROM permissions p
		 INNER JOIN role_permissions rp ON rp.permission_id = p.id
		 WHERE rp.role_id = $1`, roleID)
	return perms, err
}

// GrantPermission grants a permission to a role.
func (r *RBACRepository) GrantPermission(ctx context.Context, roleID, permissionID string) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)
		 ON CONFLICT (role_id, permission_id) DO NOTHING`, roleID, permissionID)
	return err
}

// RevokePermission revokes a permission from a role.
func (r *RBACRepository) RevokePermission(ctx context.Context, roleID, permissionID string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM role_permissions WHERE role_id = $1 AND permission_id = $2`,
		roleID, permissionID)
	return err
}

// GetPermissionByID fetches a permission by resource and action.
func (r *RBACRepository) GetPermissionByResourceAction(ctx context.Context, resource, action string) (*Permission, error) {
	var perm Permission
	err := r.db.GetContext(ctx, &perm,
		`SELECT id, resource, action, description FROM permissions WHERE resource = $1 AND action = $2`,
		resource, action)
	if err != nil {
		return nil, err
	}
	return &perm, nil
}

// ──────────────────────────────────────────────────────────────────────────────
// Helper: resolve all permissions for a user (with inheritance expansion)
// ──────────────────────────────────────────────────────────────────────────────

// ResolveUserPermissions returns all effective permission strings for a user,
// expanding role inheritance. Combines direct role assignments + inherited parent roles.
func (r *RBACRepository) ResolveUserPermissions(ctx context.Context, tenantID, userID string) ([]string, error) {
	// 1. Get direct role IDs
	directRoles, err := r.GetUserRoles(ctx, tenantID, userID)
	if err != nil {
		return nil, fmt.Errorf("get user roles: %w", err)
	}

	// 2. Expand inheritance for each role
	allRoleIDs := make(map[string]bool)
	for _, roleID := range directRoles {
		allRoleIDs[roleID] = true
		ancestors, err := r.ExpandInheritanceChain(ctx, tenantID, roleID)
		if err != nil {
			return nil, fmt.Errorf("expand inheritance for role %s: %w", roleID, err)
		}
		for _, a := range ancestors {
			allRoleIDs[a] = true
		}
	}

	// 3. Collect permissions from all roles
	permSet := make(map[string]bool)
	for roleID := range allRoleIDs {
		perms, err := r.GetRolePermissions(ctx, tenantID, roleID)
		if err != nil {
			return nil, fmt.Errorf("get role permissions for %s: %w", roleID, err)
		}
		for _, p := range perms {
			permSet[p] = true
		}
	}

	result := make([]string, 0, len(permSet))
	for p := range permSet {
		result = append(result, p)
	}
	return result, nil
}
