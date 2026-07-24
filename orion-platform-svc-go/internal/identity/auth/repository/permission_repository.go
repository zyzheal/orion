package repository

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"orion/platform-svc-go/internal/identity/auth/model"
	"orion/go-common/pkg/database"
)

type PermissionRepository struct {
	db *database.DB
}

func NewPermissionRepository(db *database.DB) *PermissionRepository {
	return &PermissionRepository{db: db}
}

// --- CRUD ---

func (r *PermissionRepository) ListByTenant(ctx context.Context, tenantID string) ([]model.Permission, error) {
	var perms []model.Permission
	err := r.db.SelectContext(ctx, &perms, "SELECT * FROM permissions WHERE tenant_id = $1 ORDER BY resource, action", tenantID)
	return perms, err
}

func (r *PermissionRepository) GetByID(ctx context.Context, id string) (*model.Permission, error) {
	var p model.Permission
	err := r.db.GetContext(ctx, &p, "SELECT * FROM permissions WHERE id = $1", id)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &p, err
}

func (r *PermissionRepository) Create(ctx context.Context, p *model.Permission) error {
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO permissions (id, tenant_id, service_name, permission_key, description, enabled, created_at, updated_at)
		VALUES (:id, :tenant_id, :resource, :action, :description, true, now(), now())
	`, p)
	return err
}

func (r *PermissionRepository) Update(ctx context.Context, id string, updates map[string]interface{}) error {
	if len(updates) == 0 {
		return nil
	}
	setParts := make([]string, 0, len(updates))
	args := make([]interface{}, 0, len(updates)+1)
	argIdx := 1
	for key, val := range updates {
		setParts = append(setParts, fmt.Sprintf("%s = $%d", key, argIdx))
		args = append(args, val)
		argIdx++
	}
	args = append(args, id)
	query := fmt.Sprintf("UPDATE permissions SET %s WHERE id = $%d", strings.Join(setParts, ", "), argIdx)
	_, err := r.db.ExecContext(ctx, query, args...)
	return err
}

func (r *PermissionRepository) Delete(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM permissions WHERE id = $1", id)
	return err
}

// --- Assignment ---

func (r *PermissionRepository) Assign(ctx context.Context, up *model.UserPermission) error {
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO user_permissions (id, tenant_id, user_id, role_id, permission_id, granted_at, granted_by)
		VALUES (:id, :tenant_id, :user_id, :role_id, :permission_id, :granted_at, :granted_by)
	`, up)
	return err
}

func (r *PermissionRepository) Revoke(ctx context.Context, tenantID, userID, roleID, permissionID string) error {
	_, err := r.db.ExecContext(ctx,
		"DELETE FROM user_permissions WHERE tenant_id = $1 AND user_id = $2 AND permission_id = $3",
		tenantID, userID, permissionID)
	return err
}

// --- Permission Check Helpers ---

// HasUserPermission checks if a user has been directly granted a permission (resource:action).
func (r *PermissionRepository) HasUserPermission(ctx context.Context, tenantID, userID, resource, action string) (bool, error) {
	var count int
	err := r.db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM user_permissions up
		 JOIN permissions p ON up.permission_id = p.id
		 WHERE up.tenant_id = $1 AND up.user_id = $2
		   AND p.service_name = $3 AND p.permission_key = $4`,
		tenantID, userID, resource, action).Scan(&count)
	return count > 0, err
}

// GetUserRoles returns the role IDs assigned to a user.
func (r *PermissionRepository) GetUserRoles(ctx context.Context, tenantID, userID string) ([]string, error) {
	var roleIDs []string
	err := r.db.SelectContext(ctx, &roleIDs,
		"SELECT r.id FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.tenant_id = $1 AND ur.user_id = $2",
		tenantID, userID)
	return roleIDs, err
}

// HasRolePermission checks if a role has a given permission (resource:action).
func (r *PermissionRepository) HasRolePermission(ctx context.Context, tenantID, roleID, resource, action string) (bool, error) {
	var count int
	err := r.db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM user_permissions up
		 JOIN permissions p ON up.permission_id = p.id
		 WHERE up.tenant_id = $1 AND up.role_id = $2
		   AND p.service_name = $3 AND p.permission_key = $4`,
		tenantID, roleID, resource, action).Scan(&count)
	return count > 0, err
}
