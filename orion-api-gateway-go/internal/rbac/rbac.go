// Package rbac implements Role-Based Access Control for the Orion API Gateway.
//
// It provides role and permission management, user-role assignment, permission
// caching, and audit reporting. The design mirrors the TS RbacService.
package rbac

import (
	"fmt"
	"sync"
	"time"
)

// Permission represents a single capability in the system.
type Permission struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	Resource    string `json:"resource"`
	Action      string `json:"action"`
}

// Role groups permissions and supports inheritance.
type Role struct {
	ID           string   `json:"id"`
	Name         string   `json:"name"`
	Description  string   `json:"description,omitempty"`
	Permissions  []string `json:"permissions"`
	InheritedFrom []string `json:"inheritedFrom,omitempty"`
}

// UserRole tracks a user's role assignment.
type UserRole struct {
	UserID    string     `json:"userId"`
	RoleID    string     `json:"roleId"`
	GrantedAt time.Time  `json:"grantedAt"`
	GrantedBy string     `json:"grantedBy,omitempty"`
	ExpiresAt *time.Time `json:"expiresAt,omitempty"`
}

// System roles.
var SystemRoles = map[string]*Role{
	"admin": {
		ID: "admin", Name: "Administrator",
		Description: "系统管理员，拥有所有权限",
		Permissions: []string{"*"},
	},
	"developer": {
		ID: "developer", Name: "Developer",
		Description: "开发者，拥有大部分读写权限",
		Permissions: []string{
			"project:read", "project:write",
			"deployment:read", "deployment:create", "deployment:update",
			"pipeline:read", "pipeline:create", "pipeline:update", "pipeline:trigger",
			"artifact:read", "artifact:upload",
			"log:read",
		},
	},
	"operator": {
		ID: "operator", Name: "Operator",
		Description: "运维人员，拥有部署和监控权限",
		Permissions: []string{
			"deployment:read", "deployment:create", "deployment:update", "deployment:rollback",
			"pipeline:read", "pipeline:trigger",
			"monitoring:read", "log:read",
			"alert:read", "alert:acknowledge",
		},
	},
	"tester": {
		ID: "tester", Name: "Tester",
		Description: "测试人员，拥有测试相关权限",
		Permissions: []string{
			"project:read", "deployment:read",
			"pipeline:read", "pipeline:trigger",
			"test:read", "test:create", "test:execute",
			"artifact:read", "log:read",
		},
	},
	"guest": {
		ID: "guest", Name: "Guest",
		Description: "访客，仅拥有只读权限",
		Permissions: []string{
			"project:read", "deployment:read",
			"pipeline:read", "artifact:read", "log:read",
		},
	},
}

// SystemPermissions defines all known permission IDs.
var SystemPermissions = map[string]*Permission{
	"project:read":          {ID: "project:read", Name: "Read Projects", Resource: "project", Action: "read"},
	"project:write":         {ID: "project:write", Name: "Write Projects", Resource: "project", Action: "write"},
	"project:create":        {ID: "project:create", Name: "Create Projects", Resource: "project", Action: "create"},
	"project:delete":        {ID: "project:delete", Name: "Delete Projects", Resource: "project", Action: "delete"},
	"deployment:read":       {ID: "deployment:read", Name: "Read Deployments", Resource: "deployment", Action: "read"},
	"deployment:create":     {ID: "deployment:create", Name: "Create Deployments", Resource: "deployment", Action: "create"},
	"deployment:update":     {ID: "deployment:update", Name: "Update Deployments", Resource: "deployment", Action: "update"},
	"deployment:delete":     {ID: "deployment:delete", Name: "Delete Deployments", Resource: "deployment", Action: "delete"},
	"deployment:rollback":   {ID: "deployment:rollback", Name: "Rollback Deployments", Resource: "deployment", Action: "rollback"},
	"pipeline:read":         {ID: "pipeline:read", Name: "Read Pipelines", Resource: "pipeline", Action: "read"},
	"pipeline:create":       {ID: "pipeline:create", Name: "Create Pipelines", Resource: "pipeline", Action: "create"},
	"pipeline:update":       {ID: "pipeline:update", Name: "Update Pipelines", Resource: "pipeline", Action: "update"},
	"pipeline:delete":       {ID: "pipeline:delete", Name: "Delete Pipelines", Resource: "pipeline", Action: "delete"},
	"pipeline:trigger":      {ID: "pipeline:trigger", Name: "Trigger Pipelines", Resource: "pipeline", Action: "trigger"},
	"artifact:read":         {ID: "artifact:read", Name: "Read Artifacts", Resource: "artifact", Action: "read"},
	"artifact:upload":       {ID: "artifact:upload", Name: "Upload Artifacts", Resource: "artifact", Action: "upload"},
	"artifact:delete":       {ID: "artifact:delete", Name: "Delete Artifacts", Resource: "artifact", Action: "delete"},
	"log:read":              {ID: "log:read", Name: "Read Logs", Resource: "log", Action: "read"},
	"monitoring:read":       {ID: "monitoring:read", Name: "Read Monitoring", Resource: "monitoring", Action: "read"},
	"alert:read":            {ID: "alert:read", Name: "Read Alerts", Resource: "alert", Action: "read"},
	"alert:acknowledge":     {ID: "alert:acknowledge", Name: "Acknowledge Alerts", Resource: "alert", Action: "acknowledge"},
	"alert:resolve":         {ID: "alert:resolve", Name: "Resolve Alerts", Resource: "alert", Action: "resolve"},
	"test:read":             {ID: "test:read", Name: "Read Tests", Resource: "test", Action: "read"},
	"test:create":           {ID: "test:create", Name: "Create Tests", Resource: "test", Action: "create"},
	"test:execute":          {ID: "test:execute", Name: "Execute Tests", Resource: "test", Action: "execute"},
	"user:read":             {ID: "user:read", Name: "Read Users", Resource: "user", Action: "read"},
	"user:write":            {ID: "user:write", Name: "Write Users", Resource: "user", Action: "write"},
	"user:delete":           {ID: "user:delete", Name: "Delete Users", Resource: "user", Action: "delete"},
	"role:read":             {ID: "role:read", Name: "Read Roles", Resource: "role", Action: "read"},
	"role:assign":           {ID: "role:assign", Name: "Assign Roles", Resource: "role", Action: "assign"},
	"role:revoke":           {ID: "role:revoke", Name: "Revoke Roles", Resource: "role", Action: "revoke"},
	"cmdb:read":             {ID: "cmdb:read", Name: "Read CMDB", Resource: "cmdb", Action: "read"},
	"cmdb:create":           {ID: "cmdb:create", Name: "Create CMDB", Resource: "cmdb", Action: "create"},
	"cmdb:update":           {ID: "cmdb:update", Name: "Update CMDB", Resource: "cmdb", Action: "update"},
	"cmdb:delete":           {ID: "cmdb:delete", Name: "Delete CMDB", Resource: "cmdb", Action: "delete"},
	"tenant:create":         {ID: "tenant:create", Name: "Create Tenant", Resource: "tenant", Action: "create"},
	"tenant:update":         {ID: "tenant:update", Name: "Update Tenant", Resource: "tenant", Action: "update"},
	"tenant:delete":         {ID: "tenant:delete", Name: "Delete Tenant", Resource: "tenant", Action: "delete"},
	"tenant:suspend":        {ID: "tenant:suspend", Name: "Suspend Tenant", Resource: "tenant", Action: "suspend"},
	"tenant:activate":       {ID: "tenant:activate", Name: "Activate Tenant", Resource: "tenant", Action: "activate"},
	"tenant:quota":          {ID: "tenant:quota", Name: "Manage Tenant Quota", Resource: "tenant", Action: "quota"},
}

// Service is the RBAC engine. It is safe for concurrent use.
type Service struct {
	mu               sync.RWMutex
	roles            map[string]*Role
	permissions      map[string]*Permission
	userRoles        map[string][]*UserRole
	permissionMatrix map[string]map[string]bool // roleID -> set of permission IDs
	cacheEnabled     bool
	cacheTTL         time.Duration
	permCache        map[string]*permCacheEntry
}

type permCacheEntry struct {
	permissions []*Permission
	expiresAt   time.Time
}

// NewService creates a fully initialised RBAC service with system roles.
func NewService() *Service {
	s := &Service{
		roles:            make(map[string]*Role),
		permissions:      make(map[string]*Permission),
		userRoles:        make(map[string][]*UserRole),
		permissionMatrix: make(map[string]map[string]bool),
		cacheEnabled:     true,
		cacheTTL:         60 * time.Second,
		permCache:        make(map[string]*permCacheEntry),
	}
	for _, r := range SystemRoles {
		s.roles[r.ID] = r
	}
	for _, p := range SystemPermissions {
		s.permissions[p.ID] = p
	}
	s.buildPermissionMatrix()
	return s
}

func (s *Service) buildPermissionMatrix() {
	for roleID, role := range s.roles {
		permSet := make(map[string]bool)
		for _, p := range role.Permissions {
			permSet[p] = true
		}
		for _, inheritedID := range role.InheritedFrom {
			if inherited, ok := s.roles[inheritedID]; ok {
				for _, p := range inherited.Permissions {
					permSet[p] = true
				}
			}
		}
		s.permissionMatrix[roleID] = permSet
	}
}

// RegisterRole adds or updates a custom role.
func (s *Service) RegisterRole(role *Role) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.roles[role.ID] = role
	permSet := make(map[string]bool)
	for _, p := range role.Permissions {
		permSet[p] = true
	}
	for _, inheritedID := range role.InheritedFrom {
		if inherited, ok := s.roles[inheritedID]; ok {
			for _, p := range inherited.Permissions {
				permSet[p] = true
			}
		}
	}
	s.permissionMatrix[role.ID] = permSet
	s.invalidateCacheLocked()
}

// RegisterPermission adds or updates a permission definition.
func (s *Service) RegisterPermission(p *Permission) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.permissions[p.ID] = p
}

// GetRole returns a role by ID.
func (s *Service) GetRole(roleID string) *Role {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.roles[roleID]
}

// GetAllRoles returns all registered roles.
func (s *Service) GetAllRoles() []*Role {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]*Role, 0, len(s.roles))
	for _, r := range s.roles {
		result = append(result, r)
	}
	return result
}

// GetAllPermissions returns all registered permissions.
func (s *Service) GetAllPermissions() []*Permission {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]*Permission, 0, len(s.permissions))
	for _, p := range s.permissions {
		result = append(result, p)
	}
	return result
}

// AssignRole grants a role to a user.
func (s *Service) AssignRole(userID, roleID, grantedBy string, expiresAt *time.Time) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.roles[roleID]; !ok {
		return fmt.Errorf("role %q not found", roleID)
	}
	for _, ur := range s.userRoles[userID] {
		if ur.RoleID == roleID {
			ur.ExpiresAt = expiresAt
			ur.GrantedAt = time.Now()
			ur.GrantedBy = grantedBy
			s.invalidateUserCacheLocked(userID)
			return nil
		}
	}
	s.userRoles[userID] = append(s.userRoles[userID], &UserRole{
		UserID:    userID,
		RoleID:    roleID,
		GrantedAt: time.Now(),
		GrantedBy: grantedBy,
		ExpiresAt: expiresAt,
	})
	s.invalidateUserCacheLocked(userID)
	return nil
}

// RevokeRole removes a role from a user.
func (s *Service) RevokeRole(userID, roleID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	roles := s.userRoles[userID]
	filtered := roles[:0]
	for _, ur := range roles {
		if ur.RoleID != roleID {
			filtered = append(filtered, ur)
		}
	}
	s.userRoles[userID] = filtered
	s.invalidateUserCacheLocked(userID)
}

// GetUserRoles returns the valid (non-expired) roles for a user.
func (s *Service) GetUserRoles(userID string) []*Role {
	s.mu.RLock()
	defer s.mu.RUnlock()
	now := time.Now()
	var result []*Role
	for _, ur := range s.userRoles[userID] {
		if ur.ExpiresAt != nil && ur.ExpiresAt.Before(now) {
			continue
		}
		if role, ok := s.roles[ur.RoleID]; ok {
			result = append(result, role)
		}
	}
	return result
}

// GetUserPermissions returns the full Permission objects for a user (with caching).
func (s *Service) GetUserPermissions(userID string) []*Permission {
	if s.cacheEnabled {
		s.mu.RLock()
		if cached, ok := s.permCache[userID]; ok && time.Now().Before(cached.expiresAt) {
			s.mu.RUnlock()
			return cached.permissions
		}
		s.mu.RUnlock()
	}

	roles := s.GetUserRoles(userID)
	permSet := make(map[string]bool)
	for _, role := range roles {
		if perms, ok := s.permissionMatrix[role.ID]; ok {
			if perms["*"] {
				permSet["*"] = true
				break
			}
			for p := range perms {
				permSet[p] = true
			}
		}
	}

	var permissions []*Permission
	if permSet["*"] {
		s.mu.RLock()
		for _, p := range s.permissions {
			permissions = append(permissions, p)
		}
		s.mu.RUnlock()
	} else {
		s.mu.RLock()
		for pid := range permSet {
			if p, ok := s.permissions[pid]; ok {
				permissions = append(permissions, p)
			}
		}
		s.mu.RUnlock()
	}

	if s.cacheEnabled {
		s.mu.Lock()
		s.permCache[userID] = &permCacheEntry{
			permissions: permissions,
			expiresAt:   time.Now().Add(s.cacheTTL),
		}
		s.mu.Unlock()
	}
	return permissions
}

// GetUserPermissionIDs returns a set of permission IDs for a user (no caching, fast).
func (s *Service) GetUserPermissionIDs(userID string) map[string]bool {
	roles := s.GetUserRoles(userID)
	permSet := make(map[string]bool)
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, role := range roles {
		if perms, ok := s.permissionMatrix[role.ID]; ok {
			for p := range perms {
				permSet[p] = true
			}
		}
	}
	return permSet
}

// HasPermission checks if a user has a specific permission.
func (s *Service) HasPermission(userID, permissionID string) bool {
	permIDs := s.GetUserPermissionIDs(userID)
	if permIDs["*"] {
		return true
	}
	return permIDs[permissionID]
}

// HasAnyPermission checks if a user has any of the given permissions.
func (s *Service) HasAnyPermission(userID string, permissionIDs []string) bool {
	for _, pid := range permissionIDs {
		if s.HasPermission(userID, pid) {
			return true
		}
	}
	return false
}

// HasAllPermissions checks if a user has all of the given permissions.
func (s *Service) HasAllPermissions(userID string, permissionIDs []string) bool {
	for _, pid := range permissionIDs {
		if !s.HasPermission(userID, pid) {
			return false
		}
	}
	return true
}

// HasRole checks if a user has a specific role.
func (s *Service) HasRole(userID, roleID string) bool {
	for _, role := range s.GetUserRoles(userID) {
		if role.ID == roleID {
			return true
		}
	}
	return false
}

// CheckResourcePermission checks resource-level permission.
func (s *Service) CheckResourcePermission(userID, resource, action string) bool {
	return s.HasPermission(userID, resource+":"+action)
}

// InvalidateCache clears all permission cache entries.
func (s *Service) InvalidateCache() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.invalidateCacheLocked()
}

func (s *Service) invalidateCacheLocked() {
	s.permCache = make(map[string]*permCacheEntry)
}

func (s *Service) invalidateUserCacheLocked(userID string) {
	delete(s.permCache, userID)
}

// SetCacheConfig configures caching behaviour.
func (s *Service) SetCacheConfig(enabled bool, ttl time.Duration) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.cacheEnabled = enabled
	if ttl > 0 {
		s.cacheTTL = ttl
	}
	if !enabled {
		s.invalidateCacheLocked()
	}
}

// RoleHasPermission checks if a role has a specific permission.
func (s *Service) RoleHasPermission(roleID, permissionID string) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	perms, ok := s.permissionMatrix[roleID]
	if !ok {
		return false
	}
	return perms["*"] || perms[permissionID]
}

// PermissionAudit represents a user's permission audit report.
type PermissionAudit struct {
	UserID      string         `json:"userId"`
	Roles       []*Role        `json:"roles"`
	Permissions []*Permission  `json:"permissions"`
	RiskLevel   string         `json:"riskLevel"`
	Warnings    []string       `json:"warnings"`
}

// GetPermissionAudit generates an audit report for a user.
func (s *Service) GetPermissionAudit(userID string) *PermissionAudit {
	roles := s.GetUserRoles(userID)
	permissions := s.GetUserPermissions(userID)
	permIDs := s.GetUserPermissionIDs(userID)
	warnings := []string{}

	highRisk := []string{"user:delete", "role:assign", "tenant:delete", "*"}
	for _, rp := range highRisk {
		if permIDs[rp] {
			warnings = append(warnings, "Has high-risk permission: "+rp)
		}
	}

	riskLevel := "low"
	if permIDs["*"] {
		riskLevel = "high"
	} else if len(warnings) > 0 {
		riskLevel = "medium"
	}

	return &PermissionAudit{
		UserID:      userID,
		Roles:       roles,
		Permissions: permissions,
		RiskLevel:   riskLevel,
		Warnings:    warnings,
	}
}
