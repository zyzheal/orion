package rbac

import (
	"testing"
	"time"
)

// ---------- Initialization ----------

func TestNewService(t *testing.T) {
	s := NewService()
	if s == nil {
		t.Fatal("expected non-nil service")
	}
	if len(s.roles) != len(SystemRoles) {
		t.Errorf("expected %d roles, got %d", len(SystemRoles), len(s.roles))
	}
	if len(s.permissions) != len(SystemPermissions) {
		t.Errorf("expected %d permissions, got %d", len(SystemPermissions), len(s.permissions))
	}
}

func TestNewServicePermissionMatrix(t *testing.T) {
	s := NewService()
	if len(s.permissionMatrix) != len(SystemRoles) {
		t.Errorf("expected %d matrix entries, got %d", len(SystemRoles), len(s.permissionMatrix))
	}
}

// ---------- Role Management ----------

func TestRegisterRole(t *testing.T) {
	s := NewService()
	role := &Role{ID: "custom", Name: "Custom", Permissions: []string{"project:read"}}
	s.RegisterRole(role)
	if s.GetRole("custom") == nil {
		t.Error("expected to find custom role")
	}
}

func TestGetAllRoles(t *testing.T) {
	s := NewService()
	roles := s.GetAllRoles()
	if len(roles) != len(SystemRoles) {
		t.Errorf("expected %d roles, got %d", len(SystemRoles), len(roles))
	}
}

func TestGetRoleNotFound(t *testing.T) {
	s := NewService()
	if s.GetRole("nonexistent") != nil {
		t.Error("expected nil for nonexistent role")
	}
}

// ---------- Permission Management ----------

func TestRegisterPermission(t *testing.T) {
	s := NewService()
	p := &Permission{ID: "custom:perm", Name: "Custom", Resource: "custom", Action: "perm"}
	s.RegisterPermission(p)
	all := s.GetAllPermissions()
	found := false
	for _, ap := range all {
		if ap.ID == "custom:perm" {
			found = true
			break
		}
	}
	if !found {
		t.Error("expected custom permission to be registered")
	}
}

func TestGetAllPermissions(t *testing.T) {
	s := NewService()
	perms := s.GetAllPermissions()
	if len(perms) != len(SystemPermissions) {
		t.Errorf("expected %d permissions, got %d", len(SystemPermissions), len(perms))
	}
}

// ---------- Role Assignment ----------

func TestAssignRole(t *testing.T) {
	s := NewService()
	err := s.AssignRole("user1", "admin", "admin", nil)
	if err != nil {
		t.Fatalf("assign failed: %v", err)
	}
	roles := s.GetUserRoles("user1")
	if len(roles) != 1 || roles[0].ID != "admin" {
		t.Errorf("expected [admin], got %v", roles)
	}
}

func TestAssignRoleNotFound(t *testing.T) {
	s := NewService()
	err := s.AssignRole("user1", "nonexistent", "admin", nil)
	if err == nil {
		t.Error("expected error for nonexistent role")
	}
}

func TestAssignRoleWithExpiration(t *testing.T) {
	s := NewService()
	exp := time.Now().Add(time.Hour)
	err := s.AssignRole("user1", "admin", "admin", &exp)
	if err != nil {
		t.Fatalf("assign failed: %v", err)
	}
	roles := s.GetUserRoles("user1")
	if len(roles) != 1 || roles[0].ID != "admin" {
		t.Error("expected admin role before expiry")
	}
}

func TestAssignRoleExpired(t *testing.T) {
	s := NewService()
	exp := time.Now().Add(-time.Hour)
	s.AssignRole("user1", "admin", "admin", &exp)
	roles := s.GetUserRoles("user1")
	if len(roles) != 0 {
		t.Errorf("expected 0 roles after expiry, got %d", len(roles))
	}
}

func TestAssignRoleUpdatesExisting(t *testing.T) {
	s := NewService()
	s.AssignRole("user1", "admin", "admin1", nil)
	s.AssignRole("user1", "admin", "admin2", nil)
	roles := s.GetUserRoles("user1")
	if len(roles) != 1 {
		t.Fatalf("expected 1 role, got %d", len(roles))
	}
}

func TestRevokeRole(t *testing.T) {
	s := NewService()
	s.AssignRole("user1", "admin", "admin", nil)
	s.AssignRole("user1", "developer", "admin", nil)
	s.RevokeRole("user1", "admin")
	roles := s.GetUserRoles("user1")
	if len(roles) != 1 || roles[0].ID != "developer" {
		t.Errorf("expected [developer], got %v", roles)
	}
}

func TestRevokeRoleNotAssigned(t *testing.T) {
	s := NewService()
	s.RevokeRole("user1", "admin") // no error expected
	roles := s.GetUserRoles("user1")
	if len(roles) != 0 {
		t.Errorf("expected 0 roles, got %d", len(roles))
	}
}

func TestGetUserRolesEmpty(t *testing.T) {
	s := NewService()
	roles := s.GetUserRoles("unknown-user")
	if len(roles) != 0 {
		t.Errorf("expected 0 roles, got %d", len(roles))
	}
}

// ---------- Permission Checks ----------

func TestHasPermissionAdmin(t *testing.T) {
	s := NewService()
	s.AssignRole("user1", "admin", "admin", nil)
	if !s.HasPermission("user1", "project:read") {
		t.Error("admin should have all permissions via wildcard")
	}
	if !s.HasPermission("user1", "user:delete") {
		t.Error("admin should have all permissions via wildcard")
	}
}

func TestHasPermissionDeveloper(t *testing.T) {
	s := NewService()
	s.AssignRole("user1", "developer", "admin", nil)
	if !s.HasPermission("user1", "project:read") {
		t.Error("developer should have project:read")
	}
	if s.HasPermission("user1", "user:delete") {
		t.Error("developer should NOT have user:delete")
	}
}

func TestHasPermissionGuest(t *testing.T) {
	s := NewService()
	s.AssignRole("user1", "guest", "admin", nil)
	if !s.HasPermission("user1", "project:read") {
		t.Error("guest should have project:read")
	}
	if s.HasPermission("user1", "project:write") {
		t.Error("guest should NOT have project:write")
	}
}

func TestHasPermissionNoRoles(t *testing.T) {
	s := NewService()
	if s.HasPermission("user1", "project:read") {
		t.Error("user with no roles should have no permissions")
	}
}

func TestHasAnyPermission(t *testing.T) {
	s := NewService()
	s.AssignRole("user1", "guest", "admin", nil)
	if !s.HasAnyPermission("user1", []string{"project:write", "project:read"}) {
		t.Error("guest should have project:read")
	}
	if s.HasAnyPermission("user1", []string{"user:delete", "role:assign"}) {
		t.Error("guest should not have user:delete or role:assign")
	}
}

func TestHasAllPermissions(t *testing.T) {
	s := NewService()
	s.AssignRole("user1", "developer", "admin", nil)
	if !s.HasAllPermissions("user1", []string{"project:read", "log:read"}) {
		t.Error("developer should have both project:read and log:read")
	}
	if s.HasAllPermissions("user1", []string{"project:read", "user:delete"}) {
		t.Error("developer should not have both project:read and user:delete")
	}
}

func TestHasRole(t *testing.T) {
	s := NewService()
	s.AssignRole("user1", "admin", "admin", nil)
	if !s.HasRole("user1", "admin") {
		t.Error("user1 should have admin role")
	}
	if s.HasRole("user1", "developer") {
		t.Error("user1 should NOT have developer role")
	}
}

func TestCheckResourcePermission(t *testing.T) {
	s := NewService()
	s.AssignRole("user1", "developer", "admin", nil)
	if !s.CheckResourcePermission("user1", "project", "read") {
		t.Error("developer should have project:read")
	}
	if !s.CheckResourcePermission("user1", "pipeline", "trigger") {
		t.Error("developer should have pipeline:trigger")
	}
	if s.CheckResourcePermission("user1", "user", "delete") {
		t.Error("developer should NOT have user:delete")
	}
}

// ---------- Role-Level Checks ----------

func TestRoleHasPermission(t *testing.T) {
	s := NewService()
	if !s.RoleHasPermission("admin", "project:read") {
		t.Error("admin role should have project:read")
	}
	if !s.RoleHasPermission("admin", "anything") {
		t.Error("admin role should have wildcard permission")
	}
	if !s.RoleHasPermission("developer", "project:read") {
		t.Error("developer role should have project:read")
	}
	if s.RoleHasPermission("developer", "user:delete") {
		t.Error("developer role should NOT have user:delete")
	}
	if s.RoleHasPermission("nonexistent", "project:read") {
		t.Error("nonexistent role should have no permissions")
	}
}

// ---------- Role Inheritance ----------

func TestRoleInheritance(t *testing.T) {
	s := NewService()
	customRole := &Role{
		ID:            "custom-dev",
		Name:          "Custom Developer",
		Permissions:   []string{"custom:perm"},
		InheritedFrom: []string{"developer"},
	}
	s.RegisterRole(customRole)

	if !s.RoleHasPermission("custom-dev", "custom:perm") {
		t.Error("custom-dev should have custom:perm")
	}
	if !s.RoleHasPermission("custom-dev", "project:read") {
		t.Error("custom-dev should inherit project:read from developer")
	}
	if !s.RoleHasPermission("custom-dev", "pipeline:trigger") {
		t.Error("custom-dev should inherit pipeline:trigger from developer")
	}
}

func TestRoleInheritanceMultiple(t *testing.T) {
	s := NewService()
	base1 := &Role{ID: "base1", Name: "Base1", Permissions: []string{"project:read"}}
	base2 := &Role{ID: "base2", Name: "Base2", Permissions: []string{"log:read"}}
	s.RegisterRole(base1)
	s.RegisterRole(base2)

	combined := &Role{
		ID:            "combined",
		Name:          "Combined",
		Permissions:   []string{"artifact:read"},
		InheritedFrom: []string{"base1", "base2"},
	}
	s.RegisterRole(combined)

	if !s.RoleHasPermission("combined", "project:read") {
		t.Error("combined should inherit project:read from base1")
	}
	if !s.RoleHasPermission("combined", "log:read") {
		t.Error("combined should inherit log:read from base2")
	}
	if !s.RoleHasPermission("combined", "artifact:read") {
		t.Error("combined should have its own artifact:read")
	}
}

func TestRoleInheritanceInvalidParent(t *testing.T) {
	s := NewService()
	role := &Role{
		ID:            "orphan",
		Name:          "Orphan",
		Permissions:   []string{"project:read"},
		InheritedFrom: []string{"nonexistent"},
	}
	s.RegisterRole(role)
	if !s.RoleHasPermission("orphan", "project:read") {
		t.Error("orphan should still have its own permission")
	}
}

// ---------- Cache ----------

func TestCacheEnabled(t *testing.T) {
	s := NewService()
	s.AssignRole("user1", "developer", "admin", nil)
	perms1 := s.GetUserPermissions("user1")
	perms2 := s.GetUserPermissions("user1")
	if len(perms1) != len(perms2) {
		t.Errorf("cached and fresh permissions differ: %d vs %d", len(perms1), len(perms2))
	}
}

func TestCacheDisabled(t *testing.T) {
	s := NewService()
	s.SetCacheConfig(false, 0)
	s.AssignRole("user1", "developer", "admin", nil)
	perms1 := s.GetUserPermissions("user1")
	perms2 := s.GetUserPermissions("user1")
	if len(perms1) == 0 || len(perms2) == 0 {
		t.Error("permissions should not be empty with cache disabled")
	}
}

func TestInvalidateCache(t *testing.T) {
	s := NewService()
	s.AssignRole("user1", "developer", "admin", nil)
	s.GetUserPermissions("user1") // populate cache
	s.RevokeRole("user1", "developer")
	s.InvalidateCache()
	perms := s.GetUserPermissions("user1")
	if len(perms) != 0 {
		t.Errorf("expected 0 permissions after revoke+invalidate, got %d", len(perms))
	}
}

func TestSetCacheConfig(t *testing.T) {
	s := NewService()
	s.SetCacheConfig(true, 30*time.Second)
	if !s.cacheEnabled {
		t.Error("cache should be enabled")
	}
	if s.cacheTTL != 30*time.Second {
		t.Errorf("expected TTL 30s, got %v", s.cacheTTL)
	}
}

// ---------- Permission Audit ----------

func TestPermissionAuditLowRisk(t *testing.T) {
	s := NewService()
	s.AssignRole("user1", "guest", "admin", nil)
	audit := s.GetPermissionAudit("user1")
	if audit.RiskLevel != "low" {
		t.Errorf("expected low risk, got %s", audit.RiskLevel)
	}
	if len(audit.Warnings) != 0 {
		t.Errorf("expected no warnings, got %v", audit.Warnings)
	}
	if audit.UserID != "user1" {
		t.Errorf("expected userID user1, got %s", audit.UserID)
	}
}

func TestPermissionAuditHighRisk(t *testing.T) {
	s := NewService()
	s.AssignRole("user1", "admin", "admin", nil)
	audit := s.GetPermissionAudit("user1")
	if audit.RiskLevel != "high" {
		t.Errorf("expected high risk, got %s", audit.RiskLevel)
	}
	if len(audit.Warnings) == 0 {
		t.Error("expected warnings for admin")
	}
}

func TestPermissionAuditMediumRisk(t *testing.T) {
	s := NewService()
	// Create a role with a high-risk permission but not wildcard
	riskyRole := &Role{ID: "risky", Name: "Risky", Permissions: []string{"user:delete"}}
	s.RegisterRole(riskyRole)
	s.AssignRole("user1", "risky", "admin", nil)
	audit := s.GetPermissionAudit("user1")
	if audit.RiskLevel != "medium" {
		t.Errorf("expected medium risk, got %s", audit.RiskLevel)
	}
	if len(audit.Warnings) == 0 {
		t.Error("expected warnings for high-risk permission")
	}
}

func TestPermissionAuditNoRoles(t *testing.T) {
	s := NewService()
	audit := s.GetPermissionAudit("unknown")
	if audit.RiskLevel != "low" {
		t.Errorf("expected low risk for unknown user, got %s", audit.RiskLevel)
	}
	if len(audit.Roles) != 0 {
		t.Errorf("expected 0 roles, got %d", len(audit.Roles))
	}
}

// ---------- Multi-Role Users ----------

func TestMultiRolePermissions(t *testing.T) {
	s := NewService()
	s.AssignRole("user1", "developer", "admin", nil)
	s.AssignRole("user1", "operator", "admin", nil)
	// developer has project:read, operator has monitoring:read
	if !s.HasPermission("user1", "project:read") {
		t.Error("user should have project:read from developer")
	}
	if !s.HasPermission("user1", "monitoring:read") {
		t.Error("user should have monitoring:read from operator")
	}
}

// ---------- Concurrent Access ----------

func TestConcurrentAccess(t *testing.T) {
	s := NewService()
	done := make(chan bool, 4)
	for g := 0; g < 4; g++ {
		go func(id int) {
			userID := "user" + string(rune('a'+id))
			s.AssignRole(userID, "admin", "admin", nil)
			_ = s.GetUserPermissions(userID)
			_ = s.HasPermission(userID, "project:read")
			s.RevokeRole(userID, "admin")
			done <- true
		}(g)
	}
	for i := 0; i < 4; i++ {
		<-done
	}
}

func TestConcurrentAssignAndRead(t *testing.T) {
	s := NewService()
	done := make(chan bool, 2)
	go func() {
		for i := 0; i < 100; i++ {
			s.AssignRole("user1", "admin", "admin", nil)
		}
		done <- true
	}()
	go func() {
		for i := 0; i < 100; i++ {
			_ = s.GetUserPermissionIDs("user1")
		}
		done <- true
	}()
	<-done
	<-done
}
