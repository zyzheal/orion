package permission

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"orion/auth-svc-go/internal/model"
	"orion/auth-svc-go/internal/repository"
	"orion/go-common/pkg/database"

	"github.com/google/uuid"
	"go.uber.org/zap"
)

// PermissionError represents an error returned by PermissionService.
type PermissionError struct {
	Code string
	Msg  string
}

func (e *PermissionError) Error() string {
	return fmt.Sprintf("[%s] %s", e.Code, e.Msg)
}

// Cache key structure: tenantID -> serviceName -> permissionKey -> Permission
type PermissionCache map[string]map[string]map[string]model.Permission

// Service encapsulates permission CRUD, assignment, and check logic with an in-memory cache.
type Service struct {
	repo  *repository.PermissionRepository
	log   *zap.Logger
	cache PermissionCache
	mu    sync.RWMutex
}

func NewService(db *database.DB, log *zap.Logger) *Service {
	repo := repository.NewPermissionRepository(db)
	return &Service{
		repo:  repo,
		log:   log,
		cache: make(PermissionCache),
	}
}

// InitCache loads permissions from the database into the in-memory cache.
func (s *Service) InitCache(ctx context.Context, tenantID string) error {
	perms, err := s.repo.ListByTenant(ctx, tenantID)
	if err != nil {
		return err
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.cache[tenantID]; !ok {
		s.cache[tenantID] = make(map[string]map[string]model.Permission)
	}
	for _, p := range perms {
		if s.cache[tenantID][p.Resource] == nil {
			s.cache[tenantID][p.Resource] = make(map[string]model.Permission)
		}
		s.cache[tenantID][p.Resource][p.Action] = p
	}

	s.log.Info("permission cache initialized",
		zap.String("tenant_id", tenantID),
		zap.Int("count", len(perms)))
	return nil
}

// InvalidateCache clears the cache for a given tenant (or all tenants if empty).
func (s *Service) InvalidateCache(tenantID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if tenantID != "" {
		delete(s.cache, tenantID)
	} else {
		s.cache = make(PermissionCache)
	}
}

// --- CRUD ---

// List returns all permissions for a tenant, optionally filtered by resource.
func (s *Service) List(ctx context.Context, tenantID, resource string) ([]model.Permission, error) {
	// Try cache first
	if resource != "" {
		s.mu.RLock()
		svc := s.cache[tenantID][resource]
		s.mu.RUnlock()
		if len(svc) > 0 {
			result := make([]model.Permission, 0, len(svc))
			for _, p := range svc {
				result = append(result, p)
			}
			return result, nil
		}
	}

	// Fall back to DB
	perms, err := s.repo.ListByTenant(ctx, tenantID)
	if err != nil {
		return nil, err
	}

	// Populate cache
	s.mu.Lock()
	if s.cache[tenantID] == nil {
		s.cache[tenantID] = make(map[string]map[string]model.Permission)
	}
	for _, p := range perms {
		if s.cache[tenantID][p.Resource] == nil {
			s.cache[tenantID][p.Resource] = make(map[string]model.Permission)
		}
		s.cache[tenantID][p.Resource][p.Action] = p
	}
	s.mu.Unlock()

	// Filter by resource if requested
	if resource != "" {
		filtered := make([]model.Permission, 0)
		for _, p := range perms {
			if p.Resource == resource {
				filtered = append(filtered, p)
			}
		}
		return filtered, nil
	}
	return perms, nil
}

// Get returns a permission by ID.
func (s *Service) Get(ctx context.Context, id string) (*model.Permission, error) {
	p, err := s.repo.GetByID(ctx, id)
	if err != nil || p == nil {
		return nil, err
	}
	// Populate cache
	s.mu.Lock()
	if s.cache[p.TenantID] == nil {
		s.cache[p.TenantID] = make(map[string]map[string]model.Permission)
	}
	if s.cache[p.TenantID][p.Resource] == nil {
		s.cache[p.TenantID][p.Resource] = make(map[string]model.Permission)
	}
	s.cache[p.TenantID][p.Resource][p.Action] = *p
	s.mu.Unlock()
	return p, nil
}

// Create inserts a new permission.
func (s *Service) Create(ctx context.Context, tenantID, resource, action, description string) (*model.Permission, error) {
	if resource == "" || action == "" {
		return nil, &PermissionError{Code: "INVALID_INPUT", Msg: "resource and action are required"}
	}

	p := &model.Permission{
		ID:          uuid.New().String(),
		TenantID:    tenantID,
		Resource:    resource,
		Action:      action,
		Description: description,
	}
	if err := s.repo.Create(ctx, p); err != nil {
		if isDuplicateError(err) {
			return nil, &PermissionError{Code: "DUPLICATE_PERMISSION", Msg: fmt.Sprintf("permission already exists: %s:%s", resource, action)}
		}
		return nil, err
	}

	// Populate cache
	s.mu.Lock()
	if s.cache[tenantID] == nil {
		s.cache[tenantID] = make(map[string]map[string]model.Permission)
	}
	if s.cache[tenantID][resource] == nil {
		s.cache[tenantID][resource] = make(map[string]model.Permission)
	}
	s.cache[tenantID][resource][action] = *p
	s.mu.Unlock()

	s.log.Info("permission created", zap.String("resource", resource), zap.String("action", action), zap.String("tenant_id", tenantID))
	return p, nil
}

// Update modifies an existing permission.
func (s *Service) Update(ctx context.Context, id, description string, enabled *bool) (*model.Permission, error) {
	existing, err := s.repo.GetByID(ctx, id)
	if err != nil || existing == nil {
		return nil, fmt.Errorf("permission not found: %s", id)
	}

	updates := make(map[string]interface{})
	if description != "" {
		updates["description"] = description
	}
	if enabled != nil {
		updates["enabled"] = *enabled
	}
	updates["updated_at"] = time.Now()

	if err := s.repo.Update(ctx, id, updates); err != nil {
		return nil, err
	}

	// Invalidate and re-fetch from DB
	p, err := s.repo.GetByID(ctx, id)
	if err != nil || p == nil {
		return nil, err
	}

	s.mu.Lock()
	if s.cache[p.TenantID] == nil {
		s.cache[p.TenantID] = make(map[string]map[string]model.Permission)
	}
	if s.cache[p.TenantID][p.Resource] == nil {
		s.cache[p.TenantID][p.Resource] = make(map[string]model.Permission)
	}
	s.cache[p.TenantID][p.Resource][p.Action] = *p
	s.mu.Unlock()

	return p, nil
}

// Delete removes a permission by ID.
func (s *Service) Delete(ctx context.Context, id string) error {
	p, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if p == nil {
		return fmt.Errorf("permission not found: %s", id)
	}

	if err := s.repo.Delete(ctx, id); err != nil {
		return err
	}

	// Invalidate cache entry
	s.mu.Lock()
	if svc := s.cache[p.TenantID]; svc != nil {
		if actMap := svc[p.Resource]; actMap != nil {
			delete(actMap, p.Action)
		}
	}
	s.mu.Unlock()

	s.log.Info("permission deleted", zap.String("id", id), zap.String("tenant_id", p.TenantID))
	return nil
}

// --- Assignment ---

// AssignPermission grants a permission to a user and/or role within a tenant.
func (s *Service) AssignPermission(ctx context.Context, tenantID, userID, roleID, permissionID, grantedBy string) error {
	return s.repo.Assign(ctx, &model.UserPermission{
		ID:           uuid.New().String(),
		TenantID:     tenantID,
		UserID:       userID,
		RoleID:       roleID,
		PermissionID: permissionID,
		GrantedBy:    grantedBy,
		GrantedAt:    time.Now(),
	})
}

// RevokePermission removes a permission assignment.
func (s *Service) RevokePermission(ctx context.Context, tenantID, userID, roleID, permissionID string) error {
	return s.repo.Revoke(ctx, tenantID, userID, roleID, permissionID)
}

// --- Check ---

// CheckPermission checks if a user has a given permission (resource:action) in the specified tenant.
// It checks both direct user assignments and role-based assignments.
func (s *Service) CheckPermission(ctx context.Context, tenantID, userID, resource, action string) (bool, error) {
	// 1. Direct user assignment
	direct, err := s.repo.HasUserPermission(ctx, tenantID, userID, resource, action)
	if err != nil {
		return false, err
	}
	if direct {
		return true, nil
	}

	// 2. Role-based: get user's roles, then check each role's permissions
	roleIDs, err := s.repo.GetUserRoles(ctx, tenantID, userID)
	if err != nil {
		return false, err
	}

	for _, roleID := range roleIDs {
		has, err := s.repo.HasRolePermission(ctx, tenantID, roleID, resource, action)
		if err != nil {
			return false, err
		}
		if has {
			return true, nil
		}
	}

	return false, nil
}

// isDuplicateError checks for PostgreSQL unique constraint violations.
func isDuplicateError(err error) bool {
	if err == nil {
		return false
	}
	msg := err.Error()
	// PostgreSQL error codes: 23505 = unique_violation
	return strings.Contains(msg, "23505") || strings.Contains(msg, "duplicate key") || strings.Contains(msg, "violates unique constraint")
}
