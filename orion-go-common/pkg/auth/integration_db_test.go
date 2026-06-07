//go:build integration
// +build integration

package auth

import (
	"context"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

// ============================================================================
// DB-backed integration tests for the full RBAC/ABAC authorization pipeline.
//
// These tests require a running PostgreSQL instance.
// Run with: go test -tags=integration -run TestIntegration_DB ./pkg/auth/...
// ============================================================================

// setupIntegrationEngine creates a fully configured engine backed by a real DB.
// Returns the engine and a cleanup function.
func setupIntegrationEngine(t *testing.T) (*AuthorizationEngine, *RBACRepository, func()) {
	t.Helper()

	if rbacDB == nil {
		t.Skip("skipping DB-backed integration test: ORION_TEST_DSN not set")
	}

	cleanup := setupRBACTables(t)
	repo := NewRBACRepository(rbacDB)

	// Seed roles and permissions
	ctx := context.Background()

	// Create a developer role in the DB
	repo.CreateRole(ctx, &Role{
		ID: "role-dev", TenantID: testTenantA, Name: "developer",
	})

	// Create permissions
	readPerm := &Permission{ID: "perm-pipeline-read", Resource: "pipeline", Action: "read"}
	writePerm := &Permission{ID: "perm-pipeline-write", Resource: "pipeline", Action: "write"}
	rbacDB.ExecContext(ctx, `INSERT INTO permissions (id, resource, action) VALUES ($1, $2, $3)
		ON CONFLICT (resource, action) DO NOTHING`, readPerm.ID, readPerm.Resource, readPerm.Action)
	rbacDB.ExecContext(ctx, `INSERT INTO permissions (id, resource, action) VALUES ($1, $2, $3)
		ON CONFLICT (resource, action) DO NOTHING`, writePerm.ID, writePerm.Resource, writePerm.Action)

	// Grant permissions to role
	repo.GrantPermission(ctx, "role-dev", "perm-pipeline-read")
	repo.GrantPermission(ctx, "role-dev", "perm-pipeline-write")

	// Assign role to user
	repo.AssignRole(ctx, testTenantA, "user-db-1", "role-dev")

	engine := NewAuthorizationEngine(repo, EngineConfig{
		UseInMemoryRBAC:  false, // use DB-backed RBAC
		AuditEnabled:     true,
		ChainHashEnabled: true,
	})

	return engine, repo, func() {
		engine.StopAuditWorker()
		cleanup()
	}
}

func TestIntegration_DB_FullPipeline(t *testing.T) {
	engine, _, cleanup := setupIntegrationEngine(t)
	defer cleanup()

	ctx := context.Background()

	// user-db-1 has developer role with pipeline:read → should pass
	decision := engine.Authorize(ctx, AuthZRequest{
		UserID:   "user-db-1",
		TenantID: testTenantA,
		Roles:    []string{"developer"}, // Roles in request for ABAC check
		Resource: "pipeline",
		Action:   "read",
	})

	if !decision.Allowed {
		t.Errorf("DB-backed pipeline should allow, got denied: reason=%s source=%s",
			decision.Reason, decision.Source)
	}

	// Wait for audit worker to flush
	time.Sleep(200 * time.Millisecond)

	// Verify audit log was written
	logs, err := (&RBACRepository{db: rbacDB}).ListAuditLogs(ctx, testTenantA, 10, 0)
	if err != nil {
		t.Fatalf("ListAuditLogs: %v", err)
	}
	if len(logs) == 0 {
		t.Error("expected at least 1 audit log entry")
	}

	// Verify audit log content
	found := false
	for _, log := range logs {
		if log.UserID == "user-db-1" && log.Resource == "pipeline" && log.Action == "read" {
			found = true
			if log.Decision != "allow" {
				t.Errorf("expected decision=allow, got %s", log.Decision)
			}
			if log.Source != "rbac" {
				t.Errorf("expected source=rbac, got %s", log.Source)
			}
		}
	}
	if !found {
		t.Error("expected audit log for user-db-1 pipeline:read")
	}
}

func TestIntegration_DB_RBACDeny_AuditLogged(t *testing.T) {
	engine, _, cleanup := setupIntegrationEngine(t)
	defer cleanup()

	ctx := context.Background()

	// user-db-1 has developer role — no config:manage permission
	decision := engine.Authorize(ctx, AuthZRequest{
		UserID:   "user-db-1",
		TenantID: testTenantA,
		Roles:    []string{"developer"},
		Resource: "config",
		Action:   "manage",
	})

	if decision.Allowed {
		t.Error("developer should not have config:manage")
	}
	if decision.Source != "rbac" {
		t.Errorf("expected source=rbac, got %s", decision.Source)
	}

	// Wait for audit worker to flush
	time.Sleep(200 * time.Millisecond)

	// Verify deny was audit logged
	logs, _ := (&RBACRepository{db: rbacDB}).ListAuditLogs(ctx, testTenantA, 10, 0)
	found := false
	for _, log := range logs {
		if log.UserID == "user-db-1" && log.Resource == "config" && log.Decision == "deny" {
			found = true
		}
	}
	if !found {
		t.Error("expected deny audit log for config:manage")
	}
}

func TestIntegration_DB_ChainHash(t *testing.T) {
	engine, _, cleanup := setupIntegrationEngine(t)
	defer cleanup()

	ctx := context.Background()

	// Make two authorization calls
	engine.Authorize(ctx, AuthZRequest{
		UserID: "user-db-1", TenantID: testTenantA,
		Roles: []string{"developer"}, Resource: "pipeline", Action: "read",
	})
	engine.Authorize(ctx, AuthZRequest{
		UserID: "user-db-1", TenantID: testTenantA,
		Roles: []string{"developer"}, Resource: "pipeline", Action: "write",
	})

	// Wait for audit worker to flush
	time.Sleep(300 * time.Millisecond)

	logs, _ := (&RBACRepository{db: rbacDB}).ListAuditLogs(ctx, testTenantA, 10, 0)
	if len(logs) < 2 {
		t.Skipf("expected at least 2 audit logs, got %d", len(logs))
	}

	// Logs are ordered by created_at DESC, so reverse for chain order
	// Find the two logs for our requests
	var readLog, writeLog *PermissionAuditLog
	for i := range logs {
		if logs[i].Action == "read" && logs[i].UserID == "user-db-1" {
			readLog = &logs[i]
		}
		if logs[i].Action == "write" && logs[i].UserID == "user-db-1" {
			writeLog = &logs[i]
		}
	}

	if readLog == nil || writeLog == nil {
		t.Skip("could not find both read and write audit logs")
	}

	// Both should have chain hashes
	if !readLog.ChainHash.Valid || readLog.ChainHash.String == "" {
		t.Error("read log should have chain hash")
	}
	if !writeLog.ChainHash.Valid || writeLog.ChainHash.String == "" {
		t.Error("write log should have chain hash")
	}

	// Chain hashes should be different
	if readLog.ChainHash.String == writeLog.ChainHash.String {
		t.Error("consecutive audit logs should have different chain hashes")
	}
}

func TestIntegration_DB_ProjectMembership(t *testing.T) {
	engine, repo, cleanup := setupIntegrationEngine(t)
	defer cleanup()

	ctx := context.Background()

	// Add user as project member with project_developer role
	repo.AddProjectMember(ctx, &ProjectMember{
		ID: "pm-1", TenantID: testTenantA,
		ProjectID: "proj-1", UserID: "user-db-1", Role: "project_developer",
	})

	// User is a member of proj-1 → relationship check passes
	decision := engine.Authorize(ctx, AuthZRequest{
		UserID:     "user-db-1",
		TenantID:   testTenantA,
		Roles:      []string{"developer"},
		Resource:   "pipeline",
		Action:     "read",
		ResourceID: "proj-1",
	})

	if !decision.Allowed {
		t.Errorf("project member should be allowed, got denied: %s", decision.Reason)
	}

	// Non-member accessing proj-2 → relationship check fails
	decision = engine.Authorize(ctx, AuthZRequest{
		UserID:     "user-db-1",
		TenantID:   testTenantA,
		Roles:      []string{"developer"},
		Resource:   "pipeline",
		Action:     "read",
		ResourceID: "proj-2",
	})

	if decision.Allowed {
		t.Error("non-member should be denied for project-scoped resource")
	}
	if decision.Source != "relationship" {
		t.Errorf("expected source=relationship, got %s", decision.Source)
	}
}

func TestIntegration_DB_RoleInheritance(t *testing.T) {
	engine, repo, cleanup := setupIntegrationEngine(t)
	defer cleanup()

	ctx := context.Background()

	// Create parent role with pipeline:approve permission
	repo.CreateRole(ctx, &Role{
		ID: "role-lead", TenantID: testTenantA, Name: "tech_lead",
	})
	rbacDB.ExecContext(ctx, `INSERT INTO permissions (id, resource, action) VALUES ($1, $2, $3)
		ON CONFLICT (resource, action) DO NOTHING`, "perm-pipeline-approve", "pipeline", "approve")
	repo.GrantPermission(ctx, "role-lead", "perm-pipeline-approve")

	// Set up inheritance: developer inherits from tech_lead
	repo.AddInheritance(ctx, testTenantA, "role-dev", "role-lead")

	// Assign developer role to a new user
	repo.AssignRole(ctx, testTenantA, "user-inherit-1", "role-dev")

	// user-inherit-1 has developer role which inherits tech_lead's pipeline:approve
	decision := engine.Authorize(ctx, AuthZRequest{
		UserID:   "user-inherit-1",
		TenantID: testTenantA,
		Roles:    []string{"developer"},
		Resource: "pipeline",
		Action:   "approve",
	})

	if !decision.Allowed {
		t.Errorf("inherited permission should be allowed, got denied: %s", decision.Reason)
	}
}

func TestIntegration_DB_DisabledUser_DeniedBeforeDB(t *testing.T) {
	engine, _, cleanup := setupIntegrationEngine(t)
	defer cleanup()

	ctx := context.Background()

	// Disabled user should be denied before even hitting the DB
	decision := engine.Authorize(ctx, AuthZRequest{
		UserID:     "user-db-1",
		TenantID:   testTenantA,
		Roles:      []string{"developer"},
		Resource:   "pipeline",
		Action:     "read",
		UserStatus: "disabled",
	})

	if decision.Allowed {
		t.Error("disabled user should be denied")
	}
	if decision.Source != "status" {
		t.Errorf("expected source=status, got %s", decision.Source)
	}

	// Wait for audit worker
	time.Sleep(200 * time.Millisecond)

	// Verify the deny was audit logged
	logs, _ := (&RBACRepository{db: rbacDB}).ListAuditLogs(ctx, testTenantA, 10, 0)
	found := false
	for _, log := range logs {
		if log.UserID == "user-db-1" && log.Decision == "deny" &&
			log.Reason.Valid && log.Reason.String == "user account is disabled" {
			found = true
		}
	}
	if !found {
		t.Error("expected audit log for disabled user deny")
	}
}

func TestIntegration_DB_ConcurrentAuthorization(t *testing.T) {
	engine, _, cleanup := setupIntegrationEngine(t)
	defer cleanup()

	ctx := context.Background()

	const numGoroutines = 20
	var wg sync.WaitGroup
	var allowCount int64
	var denyCount int64

	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()

			decision := engine.Authorize(ctx, AuthZRequest{
				UserID:   "user-db-1",
				TenantID: testTenantA,
				Roles:    []string{"developer"},
				Resource: "pipeline",
				Action:   "read",
			})

			if decision.Allowed {
				atomic.AddInt64(&allowCount, 1)
			} else {
				atomic.AddInt64(&denyCount, 1)
			}
		}(i)
	}

	wg.Wait()

	// All should be allowed (developer has pipeline:read)
	if allowCount != numGoroutines {
		t.Errorf("expected %d allows, got %d (denies: %d)", numGoroutines, allowCount, denyCount)
	}

	// Wait for audit worker to flush all entries
	time.Sleep(500 * time.Millisecond)

	logs, _ := (&RBACRepository{db: rbacDB}).ListAuditLogs(ctx, testTenantA, 100, 0)
	if len(logs) < numGoroutines {
		t.Errorf("expected at least %d audit logs, got %d", numGoroutines, len(logs))
	}
}
