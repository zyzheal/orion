package service

import (
	"context"
	"errors"

	"orion/platform-svc-go/internal/identity/user/models"
	"orion/platform-svc-go/internal/identity/user/repository"
)

var (
	ErrUserNotFound = errors.New("user not found")
	ErrRoleNotFound = errors.New("role not found")
)

// UserService handles user management business logic.
type UserService struct {
	userRepo *repository.UserRepository
}

func NewUserService(userRepo *repository.UserRepository) *UserService {
	return &UserService{userRepo: userRepo}
}

func (s *UserService) ListUsers(ctx context.Context, tenantID, search string, page, pageSize int) ([]models.User, error) {
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}
	offset := (page - 1) * pageSize
	return s.userRepo.List(ctx, tenantID, search, offset, pageSize)
}

func (s *UserService) GetUser(ctx context.Context, id, tenantID string) (*models.User, error) {
	user, err := s.userRepo.GetByID(ctx, id, tenantID)
	if err != nil {
		return nil, ErrUserNotFound
	}
	return user, nil
}

func (s *UserService) UpdateUser(ctx context.Context, id, tenantID string, req models.UpdateUserRequest) error {
	user, err := s.userRepo.GetByID(ctx, id, tenantID)
	if err != nil {
		return ErrUserNotFound
	}

	if req.DisplayName != "" {
		user.DisplayName = req.DisplayName
	}
	if req.Role != "" {
		user.Role = req.Role
	}
	if req.Status != "" {
		user.Status = req.Status
	}

	return s.userRepo.Update(ctx, user)
}

func (s *UserService) DeleteUser(ctx context.Context, id, tenantID string) error {
	exists, err := s.userExists(ctx, id, tenantID)
	if err != nil || !exists {
		return ErrUserNotFound
	}
	return s.userRepo.SoftDelete(ctx, id, tenantID)
}

func (s *UserService) UpdateUserStatus(ctx context.Context, id, tenantID, status string) error {
	exists, err := s.userExists(ctx, id, tenantID)
	if err != nil || !exists {
		return ErrUserNotFound
	}
	return s.userRepo.UpdateStatus(ctx, id, tenantID, status)
}

func (s *UserService) GetUserRoles(ctx context.Context, userID string) ([]models.Role, error) {
	return s.userRepo.GetUserRoles(ctx, userID)
}

func (s *UserService) userExists(ctx context.Context, id, tenantID string) (bool, error) {
	_, err := s.userRepo.GetByID(ctx, id, tenantID)
	if err != nil {
		return false, nil
	}
	return true, nil
}

// RBACService handles role and permission business logic.
type RBACService struct {
	userRepo *repository.UserRepository
	roleRepo *repository.RoleRepository
	permRepo *repository.PermissionRepository
}

func NewRBACService(userRepo *repository.UserRepository, roleRepo *repository.RoleRepository, permRepo *repository.PermissionRepository) *RBACService {
	return &RBACService{
		userRepo: userRepo,
		roleRepo: roleRepo,
		permRepo: permRepo,
	}
}

func (s *RBACService) CreateRole(ctx context.Context, req models.CreateRoleRequest, tenantID string) (*models.Role, error) {
	role := &models.Role{
		TenantID:    tenantID,
		Name:        req.Name,
		Description: req.Description,
	}
	if err := s.roleRepo.Create(ctx, role); err != nil {
		return nil, err
	}
	return role, nil
}

func (s *RBACService) ListRoles(ctx context.Context) ([]models.Role, error) {
	return s.roleRepo.List(ctx)
}

func (s *RBACService) GetRole(ctx context.Context, id string) (*models.Role, error) {
	role, err := s.roleRepo.GetByID(ctx, id)
	if err != nil {
		return nil, ErrRoleNotFound
	}
	return role, nil
}

func (s *RBACService) UpdateRole(ctx context.Context, id string, req models.UpdateRoleRequest) error {
	role, err := s.roleRepo.GetByID(ctx, id)
	if err != nil {
		return ErrRoleNotFound
	}
	role.Name = req.Name
	role.Description = req.Description
	return s.roleRepo.Update(ctx, role)
}

func (s *RBACService) DeleteRole(ctx context.Context, id string) error {
	if _, err := s.roleRepo.GetByID(ctx, id); err != nil {
		return ErrRoleNotFound
	}
	return s.roleRepo.Delete(ctx, id)
}

func (s *RBACService) CreatePermission(ctx context.Context, req models.CreatePermissionRequest) (*models.Permission, error) {
	perm := &models.Permission{
		Resource:    req.Resource,
		Action:      req.Action,
		Description: req.Description,
	}
	if err := s.permRepo.Create(ctx, perm); err != nil {
		return nil, err
	}
	return perm, nil
}

func (s *RBACService) ListPermissions(ctx context.Context) ([]models.Permission, error) {
	return s.permRepo.List(ctx)
}

func (s *RBACService) UpdatePermission(ctx context.Context, id string, req models.UpdatePermissionRequest) error {
	perm := &models.Permission{
		ID:          id,
		Resource:    req.Resource,
		Action:      req.Action,
		Description: req.Description,
	}
	return s.permRepo.Update(ctx, perm)
}

func (s *RBACService) DeletePermission(ctx context.Context, id string) error {
	return s.permRepo.Delete(ctx, id)
}

func (s *RBACService) AssignPermissionToRole(ctx context.Context, roleID, permissionID string) error {
	return s.permRepo.AssignToRole(ctx, roleID, permissionID)
}

func (s *RBACService) RemovePermissionFromRole(ctx context.Context, roleID, permissionID string) error {
	return s.permRepo.RemoveFromRole(ctx, roleID, permissionID)
}

func (s *RBACService) GetRolePermissions(ctx context.Context, roleID string) ([]models.Permission, error) {
	return s.permRepo.GetByRoleID(ctx, roleID)
}

// CheckPermission verifies if a user has a specific permission through their roles.
func (s *RBACService) CheckPermission(ctx context.Context, userID, resource, action string) (bool, error) {
	roles, err := s.userRepo.GetUserRoles(ctx, userID)
	if err != nil {
		return false, err
	}

	for _, role := range roles {
		perms, err := s.permRepo.GetByRoleID(ctx, role.ID)
		if err != nil {
			continue
		}
		for _, perm := range perms {
			if perm.Resource == resource && (perm.Action == action || perm.Action == "*") {
				return true, nil
			}
		}
	}

	return false, nil
}
