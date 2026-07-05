//go:build integration
// +build integration

package auth

import (
	"context"
	"encoding/json"
	"os"
	"testing"

	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
)

var rbacDB *sqlx.DB

func TestMain_RbacRepo(m *testing.M) {
	dsn := os.Getenv("ORION_TEST_DSN")
	if dsn == "" {
		dsn = "postgres://orion:orion@localhost:5432/orion_test?sslmode=disable"
	}

	var err error
	rbacDB, err = sqlx.Connect("postgres", dsn)
	if err != nil {
		panic("cannot connect to test DB: " + err.Error())
	}
	defer rbacDB.Close()

	os.Exit(m.Run())
}

const (
	testTenantA = "11111111-1111-1111-1111-111111111111"
	testTenantB = "22222222-2222-2222-2222-222222222222"
)

func setupRBACTables(t *testing.T) func() {
	t.Helper()
	ctx := context.Background()

	// Create tables if not exist (matching migration 306)
	tables := map[string]string{
		"roles": `CREATE TABLE IF NOT EXISTS roles (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			tenant_id UUID NOT NULL,
			name VARCHAR(100) NOT NULL,
			description TEXT,
			is_system BOOLEAN NOT NULL DEFAULT false,
			created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
			UNIQUE(tenant_id, name)
		)`,
		"permissions": `CREATE TABLE IF NOT EXISTS permissions (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			resource VARCHAR(100) NOT NULL,
			action VARCHAR(50) NOT NULL,
			description TEXT,
			UNIQUE(resource, action)
		)`,
		"role_permissions": `CREATE TABLE IF NOT EXISTS role_permissions (
			role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
			permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
			PRIMARY KEY (role_id, permission_id)
		)`,
		"user_roles": `CREATE TABLE IF NOT EXISTS user_roles (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			tenant_id UUID NOT NULL,
			user_id UUID NOT NULL,
			role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
			created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
			UNIQUE(tenant_id, user_id, role_id)
		)`,
		"role_inheritance": `CREATE TABLE IF NOT EXISTS role_inheritance (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			tenant_id UUID NOT NULL,
			role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
			parent_role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
			created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
			UNIQUE(tenant_id, role_id, parent_role_id),
			CHECK (role_id != parent_role_id)
		)`,
		"abac_policies": `CREATE TABLE IF NOT EXISTS abac_policies (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			tenant_id UUID NOT NULL,
			name VARCHAR(200) NOT NULL,
			description TEXT,
			effect VARCHAR(10) NOT NULL DEFAULT 'deny',
			resource VARCHAR(100) NOT NULL,
			action VARCHAR(50) NOT NULL,
			conditions JSONB NOT NULL DEFAULT '{}',
			priority INTEGER NOT NULL DEFAULT 0,
			enabled BOOLEAN NOT NULL DEFAULT true,
			created_by UUID,
			created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
			UNIQUE(tenant_id, name)
		)`,
		"project_members": `CREATE TABLE IF NOT EXISTS project_members (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			tenant_id UUID NOT NULL,
			project_id UUID NOT NULL,
			user_id UUID NOT NULL,
			role VARCHAR(50) NOT NULL DEFAULT 'viewer',
			created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
			UNIQUE(tenant_id, project_id, user_id)
		)`,
		"permission_audit_logs": `CREATE TABLE IF NOT EXISTS permission_audit_logs (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			tenant_id UUID NOT NULL,
			user_id UUID NOT NULL,
			resource VARCHAR(100) NOT NULL,
			action VARCHAR(50) NOT NULL,
			resource_id VARCHAR(100),
			decision VARCHAR(10) NOT NULL,
			source VARCHAR(20) NOT NULL,
			reason TEXT,
			ip_address INET,
			user_agent TEXT,
			request_id VARCHAR(100),
			chain_hash VARCHAR(64),
			prev_hash VARCHAR(64),
			created_at TIMESTAMPTZ NOT NULL DEFAULT now()
		)`,
	}

	// Drop in reverse dependency order
	dropOrder := []string{
		"permission_audit_logs", "project_members", "abac_policies",
		"role_inheritance", "user_roles", "role_permissions", "roles", "permissions",
	}
	for _, tbl := range dropOrder {
		rbacDB.ExecContext(ctx, "DROP TABLE IF EXISTS "+tbl+" CASCADE")
	}

	// Create tables
	createOrder := []string{
		"roles", "permissions", "role_permissions", "user_roles",
		"role_inheritance", "abac_policies", "project_members", "permission_audit_logs",
	}
	for _, tbl := range createOrder {
		if _, err := rbacDB.ExecContext(ctx, tables[tbl]); err != nil {
			t.Fatalf("create table %s: %v", tbl, err)
		}
	}

	return func() {
		for _, tbl := range dropOrder {
			rbacDB.ExecContext(ctx, "DROP TABLE IF EXISTS "+tbl+" CASCADE")
		}
	}
}

func TestRBACRepository_RoleCRUD(t *testing.T) {
	cleanup := setupRBACTables(t)
	defer cleanup()

	repo := NewRBACRepository(rbacDB)
	ctx := context.Background()

	// Create
	role := &Role{ID: "role-001", TenantID: testTenantA, Name: "test_role", Description: "Test"}
	if err := repo.CreateRole(ctx, role); err != nil {
		t.Fatalf("CreateRole: %v", err)
	}

	// Get
	got, err := repo.GetRoleByID(ctx, testTenantA, "role-001")
	if err != nil {
		t.Fatalf("GetRoleByID: %v", err)
	}
	if got.Name != "test_role" {
		t.Errorf("expected name=test_role, got %s", got.Name)
	}

	// Update
	if err := repo.UpdateRole(ctx, testTenantA, "role-001", "updated_role", "Updated"); err != nil {
		t.Fatalf("UpdateRole: %v", err)
	}
	got, _ = repo.GetRoleByID(ctx, testTenantA, "role-001")
	if got.Name != "updated_role" {
		t.Errorf("expected name=updated_role, got %s", got.Name)
	}

	// List
	roles, err := repo.ListRoles(ctx, testTenantA)
	if err != nil {
		t.Fatalf("ListRoles: %v", err)
	}
	if len(roles) != 1 {
		t.Errorf("expected 1 role, got %d", len(roles))
	}

	// Delete
	if err := repo.DeleteRole(ctx, testTenantA, "role-001"); err != nil {
		t.Fatalf("DeleteRole: %v", err)
	}
	_, err = repo.GetRoleByID(ctx, testTenantA, "role-001")
	if err == nil {
		t.Error("expected error after delete, got nil")
	}
}

func TestRBACRepository_UserRoleCRUD(t *testing.T) {
	cleanup := setupRBACTables(t)
	defer cleanup()

	repo := NewRBACRepository(rbacDB)
	ctx := context.Background()

	// Setup: create roles
	repo.CreateRole(ctx, &Role{ID: "role-a", TenantID: testTenantA, Name: "admin"})
	repo.CreateRole(ctx, &Role{ID: "role-b", TenantID: testTenantA, Name: "viewer"})

	// Assign
	if err := repo.AssignRole(ctx, testTenantA, "user-1", "role-a"); err != nil {
		t.Fatalf("AssignRole: %v", err)
	}

	// Get user roles
	roles, err := repo.GetUserRoles(ctx, testTenantA, "user-1")
	if err != nil {
		t.Fatalf("GetUserRoles: %v", err)
	}
	if len(roles) != 1 || roles[0] != "role-a" {
		t.Errorf("expected [role-a], got %v", roles)
	}

	// Assign second role
	repo.AssignRole(ctx, testTenantA, "user-1", "role-b")
	roles, _ = repo.GetUserRoles(ctx, testTenantA, "user-1")
	if len(roles) != 2 {
		t.Errorf("expected 2 roles, got %d", len(roles))
	}

	// Revoke
	if err := repo.RevokeRole(ctx, testTenantA, "user-1", "role-a"); err != nil {
		t.Fatalf("RevokeRole: %v", err)
	}
	roles, _ = repo.GetUserRoles(ctx, testTenantA, "user-1")
	if len(roles) != 1 || roles[0] != "role-b" {
		t.Errorf("expected [role-b], got %v", roles)
	}

	// SetUserRoles (replace all)
	if err := repo.SetUserRoles(ctx, testTenantA, "user-1", []string{"role-a"}); err != nil {
		t.Fatalf("SetUserRoles: %v", err)
	}
	roles, _ = repo.GetUserRoles(ctx, testTenantA, "user-1")
	if len(roles) != 1 || roles[0] != "role-a" {
		t.Errorf("expected [role-a] after Set, got %v", roles)
	}

	// ListUsersByRole
	users, err := repo.ListUsersByRole(ctx, testTenantA, "role-a")
	if err != nil {
		t.Fatalf("ListUsersByRole: %v", err)
	}
	if len(users) != 1 || users[0] != "user-1" {
		t.Errorf("expected [user-1], got %v", users)
	}
}

func TestRBACRepository_RoleInheritance(t *testing.T) {
	cleanup := setupRBACTables(t)
	defer cleanup()

	repo := NewRBACRepository(rbacDB)
	ctx := context.Background()

	// Create roles
	repo.CreateRole(ctx, &Role{ID: "parent", TenantID: testTenantA, Name: "parent_role"})
	repo.CreateRole(ctx, &Role{ID: "child", TenantID: testTenantA, Name: "child_role"})
	repo.CreateRole(ctx, &Role{ID: "grandchild", TenantID: testTenantA, Name: "grandchild_role"})

	// Add inheritance
	if err := repo.AddInheritance(ctx, testTenantA, "child", "parent"); err != nil {
		t.Fatalf("AddInheritance: %v", err)
	}
	repo.AddInheritance(ctx, testTenantA, "grandchild", "child")

	// Get parents
	parents, err := repo.GetParentRoles(ctx, testTenantA, "child")
	if err != nil {
		t.Fatalf("GetParentRoles: %v", err)
	}
	if len(parents) != 1 || parents[0] != "parent" {
		t.Errorf("expected [parent], got %v", parents)
	}

	// Expand chain (grandchild → child → parent)
	ancestors, err := repo.ExpandInheritanceChain(ctx, testTenantA, "grandchild")
	if err != nil {
		t.Fatalf("ExpandInheritanceChain: %v", err)
	}
	if len(ancestors) != 2 {
		t.Errorf("expected 2 ancestors, got %d: %v", len(ancestors), ancestors)
	}

	// Remove
	if err := repo.RemoveInheritance(ctx, testTenantA, "child", "parent"); err != nil {
		t.Fatalf("RemoveInheritance: %v", err)
	}
	parents, _ = repo.GetParentRoles(ctx, testTenantA, "child")
	if len(parents) != 0 {
		t.Errorf("expected 0 parents after remove, got %d", len(parents))
	}
}

func TestRBACRepository_ABACPolicyCRUD(t *testing.T) {
	cleanup := setupRBACTables(t)
	defer cleanup()

	repo := NewRBACRepository(rbacDB)
	ctx := context.Background()

	conditions, _ := json.Marshal(map[string]interface{}{"network": "external"})

	policy := &ABACPolicyDB{
		ID:         "policy-001",
		TenantID:   testTenantA,
		Name:       "external-restriction",
		Effect:     "deny",
		Resource:   "*",
		Action:     "*",
		Conditions: conditions,
		Priority:   80,
		Enabled:    true,
	}

	// Create
	if err := repo.CreatePolicy(ctx, policy); err != nil {
		t.Fatalf("CreatePolicy: %v", err)
	}

	// Get
	got, err := repo.GetPolicyByID(ctx, testTenantA, "policy-001")
	if err != nil {
		t.Fatalf("GetPolicyByID: %v", err)
	}
	if got.Name != "external-restriction" {
		t.Errorf("expected name=external-restriction, got %s", got.Name)
	}

	// List
	policies, err := repo.ListPolicies(ctx, testTenantA)
	if err != nil {
		t.Fatalf("ListPolicies: %v", err)
	}
	if len(policies) != 1 {
		t.Errorf("expected 1 policy, got %d", len(policies))
	}

	// ListEnabled
	enabled, _ := repo.ListEnabledPolicies(ctx, testTenantA)
	if len(enabled) != 1 {
		t.Errorf("expected 1 enabled policy, got %d", len(enabled))
	}

	// Update
	policy.Name = "updated-policy"
	policy.Priority = 90
	if err := repo.UpdatePolicy(ctx, testTenantA, "policy-001", policy); err != nil {
		t.Fatalf("UpdatePolicy: %v", err)
	}
	got, _ = repo.GetPolicyByID(ctx, testTenantA, "policy-001")
	if got.Name != "updated-policy" || got.Priority != 90 {
		t.Errorf("update failed: name=%s, priority=%d", got.Name, got.Priority)
	}

	// Delete
	if err := repo.DeletePolicy(ctx, testTenantA, "policy-001"); err != nil {
		t.Fatalf("DeletePolicy: %v", err)
	}
	_, err = repo.GetPolicyByID(ctx, testTenantA, "policy-001")
	if err == nil {
		t.Error("expected error after delete")
	}
}

func TestRBACRepository_ProjectMembers(t *testing.T) {
	cleanup := setupRBACTables(t)
	defer cleanup()

	repo := NewRBACRepository(rbacDB)
	ctx := context.Background()

	member := &ProjectMember{
		ID: "pm-001", TenantID: testTenantA,
		ProjectID: "proj-1", UserID: "user-1", Role: "project_developer",
	}

	// Add
	if err := repo.AddProjectMember(ctx, member); err != nil {
		t.Fatalf("AddProjectMember: %v", err)
	}

	// Get
	got, err := repo.GetProjectMember(ctx, testTenantA, "proj-1", "user-1")
	if err != nil {
		t.Fatalf("GetProjectMember: %v", err)
	}
	if got.Role != "project_developer" {
		t.Errorf("expected role=project_developer, got %s", got.Role)
	}

	// Update role
	if err := repo.UpdateProjectMemberRole(ctx, testTenantA, "proj-1", "user-1", "project_admin"); err != nil {
		t.Fatalf("UpdateProjectMemberRole: %v", err)
	}
	got, _ = repo.GetProjectMember(ctx, testTenantA, "proj-1", "user-1")
	if got.Role != "project_admin" {
		t.Errorf("expected role=project_admin, got %s", got.Role)
	}

	// List
	members, err := repo.ListProjectMembers(ctx, testTenantA, "proj-1")
	if err != nil {
		t.Fatalf("ListProjectMembers: %v", err)
	}
	if len(members) != 1 {
		t.Errorf("expected 1 member, got %d", len(members))
	}

	// ListUserProjects
	projects, err := repo.ListUserProjects(ctx, testTenantA, "user-1")
	if err != nil {
		t.Fatalf("ListUserProjects: %v", err)
	}
	if len(projects) != 1 {
		t.Errorf("expected 1 project, got %d", len(projects))
	}

	// Remove
	if err := repo.RemoveProjectMember(ctx, testTenantA, "proj-1", "user-1"); err != nil {
		t.Fatalf("RemoveProjectMember: %v", err)
	}
	_, err = repo.GetProjectMember(ctx, testTenantA, "proj-1", "user-1")
	if err == nil {
		t.Error("expected error after remove")
	}
}

func TestRBACRepository_AuditLog(t *testing.T) {
	cleanup := setupRBACTables(t)
	defer cleanup()

	repo := NewRBACRepository(rbacDB)
	ctx := context.Background()

	log := &PermissionAuditLog{
		ID:       "audit-001",
		TenantID: testTenantA,
		UserID:   "user-1",
		Resource: "pipeline",
		Action:   "read",
		Decision: "allow",
		Source:   "rbac",
	}

	// Create
	if err := repo.CreateAuditLog(ctx, log); err != nil {
		t.Fatalf("CreateAuditLog: %v", err)
	}

	// List
	logs, err := repo.ListAuditLogs(ctx, testTenantA, 10, 0)
	if err != nil {
		t.Fatalf("ListAuditLogs: %v", err)
	}
	if len(logs) != 1 {
		t.Errorf("expected 1 log, got %d", len(logs))
	}

	// Count
	count, err := repo.CountAuditLogs(ctx, testTenantA)
	if err != nil {
		t.Fatalf("CountAuditLogs: %v", err)
	}
	if count != 1 {
		t.Errorf("expected count=1, got %d", count)
	}

	// Last hash (empty for first entry)
	hash, err := repo.GetLastAuditHash(ctx, testTenantA)
	if err != nil {
		t.Fatalf("GetLastAuditHash: %v", err)
	}
	if hash != "" {
		t.Errorf("expected empty hash for first entry, got %s", hash)
	}
}

func TestRBACRepository_TenantIsolation(t *testing.T) {
	cleanup := setupRBACTables(t)
	defer cleanup()

	repo := NewRBACRepository(rbacDB)
	ctx := context.Background()

	// Create roles in different tenants
	repo.CreateRole(ctx, &Role{ID: "role-a", TenantID: testTenantA, Name: "admin"})
	repo.CreateRole(ctx, &Role{ID: "role-b", TenantID: testTenantB, Name: "admin"})

	// Tenant A should not see Tenant B's roles
	roles, _ := repo.ListRoles(ctx, testTenantA)
	if len(roles) != 1 {
		t.Errorf("tenant A: expected 1 role, got %d", len(roles))
	}
	if roles[0].ID != "role-a" {
		t.Errorf("tenant A: expected role-a, got %s", roles[0].ID)
	}

	// Tenant B should not see Tenant A's roles
	roles, _ = repo.ListRoles(ctx, testTenantB)
	if len(roles) != 1 {
		t.Errorf("tenant B: expected 1 role, got %d", len(roles))
	}
	if roles[0].ID != "role-b" {
		t.Errorf("tenant B: expected role-b, got %s", roles[0].ID)
	}

	// Cross-tenant user_roles isolation
	repo.AssignRole(ctx, testTenantA, "user-1", "role-a")
	repo.AssignRole(ctx, testTenantB, "user-1", "role-b")

	userRoles, _ := repo.GetUserRoles(ctx, testTenantA, "user-1")
	if len(userRoles) != 1 || userRoles[0] != "role-a" {
		t.Errorf("tenant A user-1: expected [role-a], got %v", userRoles)
	}

	userRoles, _ = repo.GetUserRoles(ctx, testTenantB, "user-1")
	if len(userRoles) != 1 || userRoles[0] != "role-b" {
		t.Errorf("tenant B user-1: expected [role-b], got %v", userRoles)
	}
}
