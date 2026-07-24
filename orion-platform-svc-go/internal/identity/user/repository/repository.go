package repository

import (
	"context"
	"fmt"

	"orion/go-common/pkg/database"
	"orion/platform-svc-go/internal/identity/user/models"
)

// UserRepository provides data access for user entities (within tenant context).
type UserRepository struct {
	database.BaseRepository
}

func NewUserRepository(db *database.DB) *UserRepository {
	return &UserRepository{
		BaseRepository: database.NewBaseRepository(db),
	}
}

func (r *UserRepository) GetByID(ctx context.Context, id, tenantID string) (*models.User, error) {
	var user models.User
	query := `SELECT id, tenant_id, email, display_name, role, status, created_at, updated_at FROM users WHERE id = $1 AND tenant_id = $2`
	err := r.DB().GetContext(ctx, &user, query, id, tenantID)
	if err != nil {
		return nil, fmt.Errorf("user not found: %w", err)
	}
	return &user, nil
}

func (r *UserRepository) List(ctx context.Context, tenantID, search string, offset, limit int) ([]models.User, error) {
	query := `SELECT id, tenant_id, email, display_name, role, status, created_at, updated_at FROM users WHERE tenant_id = $1`
	args := []interface{}{tenantID}
	argIdx := 2

	if search != "" {
		query += " AND (email LIKE $" + fmt.Sprintf("%d", argIdx) + " OR display_name LIKE $" + fmt.Sprintf("%d", argIdx) + ")"
		args = append(args, "%"+search+"%")
		argIdx++
	}

	query += " ORDER BY created_at DESC LIMIT $" + fmt.Sprintf("%d", argIdx)
	args = append(args, limit)
	argIdx++
	query += " OFFSET $" + fmt.Sprintf("%d", argIdx)
	args = append(args, offset)

	var users []models.User
	err := r.DB().SelectContext(ctx, &users, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to list users: %w", err)
	}
	return users, nil
}

func (r *UserRepository) Update(ctx context.Context, user *models.User) error {
	query := `UPDATE users SET display_name = $1, role = $2, status = $3, updated_at = now() WHERE id = $4 AND tenant_id = $5`
	_, err := r.DB().ExecContext(ctx, query, user.DisplayName, user.Role, user.Status, user.ID, user.TenantID)
	return err
}

func (r *UserRepository) UpdateStatus(ctx context.Context, id, tenantID, status string) error {
	_, err := r.DB().ExecContext(ctx,
		"UPDATE users SET status = $1, updated_at = now() WHERE id = $2 AND tenant_id = $3",
		status, id, tenantID,
	)
	return err
}

func (r *UserRepository) SoftDelete(ctx context.Context, id, tenantID string) error {
	_, err := r.DB().ExecContext(ctx,
		"UPDATE users SET status = 'deleted', updated_at = now() WHERE id = $1 AND tenant_id = $2",
		id, tenantID,
	)
	return err
}

func (r *UserRepository) AssignRole(ctx context.Context, userID, roleID string) error {
	_, err := r.DB().ExecContext(ctx,
		"INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
		userID, roleID,
	)
	return err
}

func (r *UserRepository) RemoveRole(ctx context.Context, userID, roleID string) error {
	_, err := r.DB().ExecContext(ctx,
		"DELETE FROM user_roles WHERE user_id = $1 AND role_id = $2",
		userID, roleID,
	)
	return err
}

func (r *UserRepository) GetUserRoles(ctx context.Context, userID string) ([]models.Role, error) {
	var roles []models.Role
	query := `SELECT r.id, r.tenant_id, r.name, r.description, r.created_at, r.updated_at FROM roles r
		JOIN user_roles ur ON r.id = ur.role_id WHERE ur.user_id = $1`
	err := r.DB().SelectContext(ctx, &roles, query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user roles: %w", err)
	}
	return roles, nil
}

// RoleRepository provides data access for role entities.
type RoleRepository struct {
	database.BaseRepository
}

func NewRoleRepository(db *database.DB) *RoleRepository {
	return &RoleRepository{
		BaseRepository: database.NewBaseRepository(db),
	}
}

func (r *RoleRepository) Create(ctx context.Context, role *models.Role) error {
	query := `INSERT INTO roles (tenant_id, name, description) VALUES ($1, $2, $3) RETURNING id, created_at, updated_at`
	err := r.DB().QueryRowContext(ctx, query, role.TenantID, role.Name, role.Description).Scan(&role.ID, &role.CreatedAt, &role.UpdatedAt)
	return err
}

func (r *RoleRepository) GetByID(ctx context.Context, id string) (*models.Role, error) {
	var role models.Role
	query := `SELECT id, tenant_id, name, description, created_at, updated_at FROM roles WHERE id = $1`
	err := r.DB().GetContext(ctx, &role, query, id)
	if err != nil {
		return nil, fmt.Errorf("role not found: %w", err)
	}
	return &role, nil
}

func (r *RoleRepository) List(ctx context.Context) ([]models.Role, error) {
	var roles []models.Role
	err := r.DB().SelectContext(ctx, &roles, "SELECT id, tenant_id, name, description, created_at, updated_at FROM roles ORDER BY created_at DESC")
	if err != nil {
		return nil, fmt.Errorf("failed to list roles: %w", err)
	}
	return roles, nil
}

func (r *RoleRepository) Update(ctx context.Context, role *models.Role) error {
	_, err := r.DB().ExecContext(ctx,
		"UPDATE roles SET name = $1, description = $2, updated_at = now() WHERE id = $3",
		role.Name, role.Description, role.ID,
	)
	return err
}

func (r *RoleRepository) Delete(ctx context.Context, id string) error {
	_, err := r.DB().ExecContext(ctx, "DELETE FROM roles WHERE id = $1", id)
	return err
}

// PermissionRepository provides data access for permission entities.
type PermissionRepository struct {
	database.BaseRepository
}

func NewPermissionRepository(db *database.DB) *PermissionRepository {
	return &PermissionRepository{
		BaseRepository: database.NewBaseRepository(db),
	}
}

func (r *PermissionRepository) Create(ctx context.Context, perm *models.Permission) error {
	query := `INSERT INTO permissions (resource, action, description) VALUES ($1, $2, $3) RETURNING id, created_at`
	err := r.DB().QueryRowContext(ctx, query, perm.Resource, perm.Action, perm.Description).Scan(&perm.ID, &perm.CreatedAt)
	return err
}

func (r *PermissionRepository) List(ctx context.Context) ([]models.Permission, error) {
	var perms []models.Permission
	err := r.DB().SelectContext(ctx, &perms, "SELECT id, resource, action, description, created_at FROM permissions ORDER BY resource, action")
	if err != nil {
		return nil, fmt.Errorf("failed to list permissions: %w", err)
	}
	return perms, nil
}

func (r *PermissionRepository) Update(ctx context.Context, perm *models.Permission) error {
	_, err := r.DB().ExecContext(ctx,
		"UPDATE permissions SET resource = $1, action = $2, description = $3 WHERE id = $4",
		perm.Resource, perm.Action, perm.Description, perm.ID,
	)
	return err
}

func (r *PermissionRepository) Delete(ctx context.Context, id string) error {
	_, err := r.DB().ExecContext(ctx, "DELETE FROM permissions WHERE id = $1", id)
	return err
}

func (r *PermissionRepository) AssignToRole(ctx context.Context, roleID, permissionID string) error {
	_, err := r.DB().ExecContext(ctx,
		"INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
		roleID, permissionID,
	)
	return err
}

func (r *PermissionRepository) RemoveFromRole(ctx context.Context, roleID, permissionID string) error {
	_, err := r.DB().ExecContext(ctx,
		"DELETE FROM role_permissions WHERE role_id = $1 AND permission_id = $2",
		roleID, permissionID,
	)
	return err
}

func (r *PermissionRepository) GetByRoleID(ctx context.Context, roleID string) ([]models.Permission, error) {
	var perms []models.Permission
	query := `SELECT p.id, p.resource, p.action, p.description, p.created_at FROM permissions p
		JOIN role_permissions rp ON p.id = rp.permission_id WHERE rp.role_id = $1`
	err := r.DB().SelectContext(ctx, &perms, query, roleID)
	if err != nil {
		return nil, fmt.Errorf("failed to get role permissions: %w", err)
	}
	return perms, nil
}
