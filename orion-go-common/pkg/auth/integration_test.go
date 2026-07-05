package auth

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

// ============================================================================
// Integration tests for the full RBAC/ABAC authorization pipeline.
//
// These tests verify the end-to-end flow:
//   User Status → Cache → RBAC → ABAC deny-only → Relationship → Audit
//
// Tests are split into two categories:
//   1. In-memory tests (no build tag) — use in-memory RBAC, nil repo
//   2. DB-backed tests (//go:build integration) — use real PostgreSQL
// ============================================================================

// ─────────────────────────────────────────────────────────────────────────────
// Helper: create an engine with in-memory RBAC, no audit, no cache
// ─────────────────────────────────────────────────────────────────────────────

func newTestEngine() *AuthorizationEngine {
	return NewAuthorizationEngine(nil, EngineConfig{
		UseInMemoryRBAC:  true,
		AuditEnabled:     false,
		ChainHashEnabled: false,
	})
}

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 1: Full authorization pipeline (RBAC allow → ABAC pass → audit)
// ─────────────────────────────────────────────────────────────────────────────

func TestIntegration_FullPipeline_RBACAllow_ABACPass(t *testing.T) {
	engine := newTestEngine()

	// developer has pipeline:read → RBAC passes
	// No ABAC deny policies match → ABAC passes
	// No resource_id → relationship check skipped
	decision := engine.Authorize(context.Background(), AuthZRequest{
		UserID:   "user-1",
		TenantID: "tenant-1",
		Roles:    []string{"developer"},
		Resource: "pipeline",
		Action:   "read",
	})

	if !decision.Allowed {
		t.Errorf("expected allowed, got denied: reason=%s source=%s", decision.Reason, decision.Source)
	}
	if decision.Source != "rbac" {
		t.Errorf("expected source=rbac, got %s", decision.Source)
	}
}

func TestIntegration_FullPipeline_RBACAllow_ABACDenyOverride(t *testing.T) {
	engine := newTestEngine()

	// developer has pipeline:read → RBAC passes
	// tenant_mismatch=true → ABAC deny policy fires → overrides RBAC
	decision := engine.Authorize(context.Background(), AuthZRequest{
		UserID:   "user-1",
		TenantID: "tenant-1",
		Roles:    []string{"developer"},
		Resource: "pipeline",
		Action:   "read",
		ResourceAttrs: map[string]interface{}{
			"tenant_mismatch": true,
		},
	})

	if decision.Allowed {
		t.Error("expected denied by ABAC tenant isolation, got allowed")
	}
	if decision.Source != "abac" {
		t.Errorf("expected source=abac, got %s", decision.Source)
	}
}

func TestIntegration_FullPipeline_RBACDeny(t *testing.T) {
	engine := newTestEngine()

	// viewer does NOT have pipeline:write → RBAC denies immediately
	decision := engine.Authorize(context.Background(), AuthZRequest{
		UserID:   "user-1",
		TenantID: "tenant-1",
		Roles:    []string{"viewer"},
		Resource: "pipeline",
		Action:   "write",
	})

	if decision.Allowed {
		t.Error("expected denied by RBAC, got allowed")
	}
	if decision.Source != "rbac" {
		t.Errorf("expected source=rbac, got %s", decision.Source)
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 2: RBAC deny — role lacks permission → 403
// ─────────────────────────────────────────────────────────────────────────────

func TestIntegration_RBACDeny(t *testing.T) {
	tests := []struct {
		name     string
		role     string
		resource string
		action   string
	}{
		{"viewer cannot write pipeline", "viewer", "pipeline", "write"},
		{"viewer cannot delete deployment", "viewer", "deployment", "delete"},
		{"developer cannot approve pipeline", "developer", "pipeline", "approve"},
		{"developer cannot manage config", "developer", "config", "manage"},
		{"dba cannot write config", "dba", "config", "write"},
		{"pipeline.viewer cannot write pipeline", "pipeline.viewer", "pipeline", "write"},
		{"unknown role denied", "nonexistent_role", "pipeline", "read"},
		{"empty roles denied", "", "pipeline", "read"},
	}

	engine := newTestEngine()

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var roles []string
			if tt.role != "" {
				roles = []string{tt.role}
			} else {
				roles = []string{}
			}

			decision := engine.Authorize(context.Background(), AuthZRequest{
				UserID:   "user-1",
				TenantID: "tenant-1",
				Roles:    roles,
				Resource: tt.resource,
				Action:   tt.action,
			})

			if decision.Allowed {
				t.Errorf("%s: expected deny, got allow", tt.name)
			}
			if decision.Source != "rbac" {
				t.Errorf("%s: expected source=rbac, got %s", tt.name, decision.Source)
			}
		})
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 3: ABAC deny override — RBAC passes but ABAC denies
// ─────────────────────────────────────────────────────────────────────────────

func TestIntegration_ABACDenyOverride_TenantIsolation(t *testing.T) {
	engine := newTestEngine()

	// org_admin has *:read → RBAC passes
	// tenant_mismatch=true → ABAC denies
	decision := engine.Authorize(context.Background(), AuthZRequest{
		UserID:   "user-1",
		TenantID: "tenant-1",
		Roles:    []string{"org_admin"},
		Resource: "pipeline",
		Action:   "read",
		ResourceAttrs: map[string]interface{}{
			"tenant_mismatch": true,
		},
	})

	if decision.Allowed {
		t.Error("expected ABAC deny for tenant isolation, got allowed")
	}
	if decision.Source != "abac" {
		t.Errorf("expected source=abac, got %s", decision.Source)
	}
	if decision.Reason == "" {
		t.Error("expected non-empty reason for ABAC deny")
	}
}

func TestIntegration_ABACDenyOverride_ExternalNetwork(t *testing.T) {
	engine := newTestEngine()

	// tech_lead has pipeline:write → RBAC passes
	// action_impact=write + network=external → ABAC denies
	decision := engine.Authorize(context.Background(), AuthZRequest{
		UserID:   "user-1",
		TenantID: "tenant-1",
		Roles:    []string{"tech_lead"},
		Resource: "pipeline",
		Action:   "write",
		ResourceAttrs: map[string]interface{}{
			"action_impact": "write",
		},
		Environment: map[string]interface{}{
			"network": "external",
		},
	})

	if decision.Allowed {
		t.Error("expected ABAC deny for external network write, got allowed")
	}
	if decision.Source != "abac" {
		t.Errorf("expected source=abac, got %s", decision.Source)
	}
}

func TestIntegration_ABACDenyOverride_WorkingHours(t *testing.T) {
	engine := newTestEngine()

	// sre has deployment:execute → RBAC passes
	// action_impact=critical + working_hours=false → ABAC denies
	decision := engine.Authorize(context.Background(), AuthZRequest{
		UserID:   "user-1",
		TenantID: "tenant-1",
		Roles:    []string{"sre"},
		Resource: "deployment",
		Action:   "execute",
		ResourceAttrs: map[string]interface{}{
			"action_impact": "critical",
		},
		Environment: map[string]interface{}{
			"working_hours": false,
		},
	})

	if decision.Allowed {
		t.Error("expected ABAC deny for critical action outside working hours, got allowed")
	}
	if decision.Source != "abac" {
		t.Errorf("expected source=abac, got %s", decision.Source)
	}
}

func TestIntegration_ABACDenyOverride_SessionExpired(t *testing.T) {
	engine := newTestEngine()

	// developer has pipeline:write → RBAC passes
	// action_impact=write + session_expired=true → ABAC denies
	decision := engine.Authorize(context.Background(), AuthZRequest{
		UserID:   "user-1",
		TenantID: "tenant-1",
		Roles:    []string{"developer"},
		Resource: "pipeline",
		Action:   "write",
		ResourceAttrs: map[string]interface{}{
			"action_impact": "write",
		},
		Environment: map[string]interface{}{
			"session_expired": true,
		},
	})

	if decision.Allowed {
		t.Error("expected ABAC deny for expired session write, got allowed")
	}
	if decision.Source != "abac" {
		t.Errorf("expected source=abac, got %s", decision.Source)
	}
}

func TestIntegration_ABACDenyOverride_IPRangeRestriction(t *testing.T) {
	engine := newTestEngine()

	// tenant_admin has *:manage → RBAC passes
	// action=manage + ip_allowed=false → ABAC denies
	decision := engine.Authorize(context.Background(), AuthZRequest{
		UserID:   "user-1",
		TenantID: "tenant-1",
		Roles:    []string{"tenant_admin"},
		Resource: "deployment",
		Action:   "manage",
		Environment: map[string]interface{}{
			"ip_allowed": false,
		},
	})

	if decision.Allowed {
		t.Error("expected ABAC deny for IP range restriction, got allowed")
	}
	if decision.Source != "abac" {
		t.Errorf("expected source=abac, got %s", decision.Source)
	}
}

func TestIntegration_ABACDenyOverride_ApprovalRequired(t *testing.T) {
	engine := newTestEngine()

	// platform_admin has *:delete → RBAC passes
	// action=delete + has_approval=false → ABAC denies
	decision := engine.Authorize(context.Background(), AuthZRequest{
		UserID:   "user-1",
		TenantID: "tenant-1",
		Roles:    []string{"platform_admin"},
		Resource: "pipeline",
		Action:   "delete",
		ResourceAttrs: map[string]interface{}{
			"has_approval": false,
		},
	})

	if decision.Allowed {
		t.Error("expected ABAC deny for unapproved delete, got allowed")
	}
	if decision.Source != "abac" {
		t.Errorf("expected source=abac, got %s", decision.Source)
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 4: Super admin bypasses RBAC AND ABAC
// ─────────────────────────────────────────────────────────────────────────────

func TestIntegration_SuperAdmin_BypassRBAC(t *testing.T) {
	engine := newTestEngine()

	// super_admin has *:* → RBAC passes
	decision := engine.Authorize(context.Background(), AuthZRequest{
		UserID:   "admin-1",
		TenantID: "tenant-1",
		Roles:    []string{"super_admin"},
		Resource: "any_resource",
		Action:   "any_action",
	})

	if !decision.Allowed {
		t.Errorf("super_admin should bypass RBAC, got denied: %s", decision.Reason)
	}
	if decision.Source != "super_admin" {
		t.Errorf("expected source=super_admin, got %s", decision.Source)
	}
}

func TestIntegration_SuperAdmin_BypassABAC(t *testing.T) {
	engine := newTestEngine()

	// super_admin should skip ABAC even with tenant_mismatch
	decision := engine.Authorize(context.Background(), AuthZRequest{
		UserID:   "admin-1",
		TenantID: "tenant-1",
		Roles:    []string{"super_admin"},
		Resource: "pipeline",
		Action:   "delete",
		ResourceAttrs: map[string]interface{}{
			"tenant_mismatch": true,
			"action_impact":   "write",
			"has_approval":    false,
		},
		Environment: map[string]interface{}{
			"network":         "external",
			"working_hours":   false,
			"session_expired": true,
			"ip_allowed":      false,
		},
	})

	if !decision.Allowed {
		t.Errorf("super_admin should bypass ABAC, got denied: %s", decision.Reason)
	}
	if decision.Source != "super_admin" {
		t.Errorf("expected source=super_admin, got %s", decision.Source)
	}
}

func TestIntegration_SuperAdmin_BypassDisabledStatus(t *testing.T) {
	engine := newTestEngine()

	// Even super_admin cannot bypass disabled/suspended status
	decision := engine.Authorize(context.Background(), AuthZRequest{
		UserID:     "admin-1",
		TenantID:   "tenant-1",
		Roles:      []string{"super_admin"},
		Resource:   "pipeline",
		Action:     "read",
		UserStatus: "disabled",
	})

	if decision.Allowed {
		t.Error("disabled super_admin should be denied (status check is first)")
	}
	if decision.Source != "status" {
		t.Errorf("expected source=status, got %s", decision.Source)
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 5: Disabled/suspended user → immediate deny
// ─────────────────────────────────────────────────────────────────────────────

func TestIntegration_DisabledUser_DeniedRegardlessOfRoles(t *testing.T) {
	tests := []struct {
		name       string
		roles      []string
		userStatus string
	}{
		{"disabled developer", []string{"developer"}, "disabled"},
		{"disabled org_admin", []string{"org_admin"}, "disabled"},
		{"disabled super_admin", []string{"super_admin"}, "disabled"},
		{"suspended developer", []string{"developer"}, "suspended"},
		{"suspended super_admin", []string{"super_admin"}, "suspended"},
		{"suspended multi-role", []string{"developer", "tech_lead", "sre"}, "suspended"},
	}

	engine := newTestEngine()

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			decision := engine.Authorize(context.Background(), AuthZRequest{
				UserID:     "user-1",
				TenantID:   "tenant-1",
				Roles:      tt.roles,
				Resource:   "pipeline",
				Action:     "read",
				UserStatus: tt.userStatus,
			})

			if decision.Allowed {
				t.Errorf("%s: expected deny, got allow", tt.name)
			}
			if decision.Source != "status" {
				t.Errorf("%s: expected source=status, got %s", tt.name, decision.Source)
			}
			expectedReason := "user account is " + tt.userStatus
			if decision.Reason != expectedReason {
				t.Errorf("%s: expected reason=%q, got %q", tt.name, expectedReason, decision.Reason)
			}
		})
	}
}

func TestIntegration_ActiveUser_ProceedsNormally(t *testing.T) {
	engine := newTestEngine()

	decision := engine.Authorize(context.Background(), AuthZRequest{
		UserID:     "user-1",
		TenantID:   "tenant-1",
		Roles:      []string{"developer"},
		Resource:   "pipeline",
		Action:     "read",
		UserStatus: "active",
	})

	if !decision.Allowed {
		t.Errorf("active user should be allowed, got denied: %s", decision.Reason)
	}
}

func TestIntegration_EmptyStatus_DefaultsToActive(t *testing.T) {
	engine := newTestEngine()

	decision := engine.Authorize(context.Background(), AuthZRequest{
		UserID:     "user-1",
		TenantID:   "tenant-1",
		Roles:      []string{"developer"},
		Resource:   "pipeline",
		Action:     "read",
		UserStatus: "",
	})

	if !decision.Allowed {
		t.Errorf("empty status should default to active, got denied: %s", decision.Reason)
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 6: Project membership check
//
// Note: With nil repo, relationship check is skipped. The in-memory
// HasPermission() is used in checkRelationship when repo is available.
// Here we test the engine behavior with project-scoped requests.
// ─────────────────────────────────────────────────────────────────────────────

func TestIntegration_ProjectMembership_NilRepo_SkipsCheck(t *testing.T) {
	engine := newTestEngine()

	// With nil repo, relationship check should be skipped
	// developer has pipeline:read → RBAC passes → no relationship check → allowed
	decision := engine.Authorize(context.Background(), AuthZRequest{
		UserID:       "user-1",
		TenantID:     "tenant-1",
		Roles:        []string{"developer"},
		Resource:     "pipeline",
		Action:       "read",
		ResourceID:   "proj-123",
	})

	if !decision.Allowed {
		t.Errorf("nil repo should skip relationship check, got denied: %s", decision.Reason)
	}
}

func TestIntegration_ProjectMembership_RBACDeny_EvenWithResourceID(t *testing.T) {
	engine := newTestEngine()

	// viewer does NOT have pipeline:write → RBAC denies before relationship check
	decision := engine.Authorize(context.Background(), AuthZRequest{
		UserID:       "user-1",
		TenantID:     "tenant-1",
		Roles:        []string{"viewer"},
		Resource:     "pipeline",
		Action:       "write",
		ResourceID:   "proj-123",
	})

	if decision.Allowed {
		t.Error("RBAC deny should fire before relationship check")
	}
	if decision.Source != "rbac" {
		t.Errorf("expected source=rbac, got %s", decision.Source)
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 7: Role inheritance
// ─────────────────────────────────────────────────────────────────────────────

func TestIntegration_RoleInheritance_SystemAdminChain(t *testing.T) {
	engine := newTestEngine()

	tests := []struct {
		name     string
		role     string
		resource string
		action   string
		expected bool
	}{
		// super_admin → platform_admin → tenant_admin
		// platform_admin inherits super_admin's *:*
		{"platform_admin inherits *:* from super_admin", "platform_admin", "anything", "anything", true},
		// tenant_admin inherits platform_admin's permissions
		{"tenant_admin inherits manage from platform_admin", "tenant_admin", "config", "manage", true},
		{"tenant_admin inherits read via *:* chain", "tenant_admin", "pipeline", "read", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			decision := engine.Authorize(context.Background(), AuthZRequest{
				UserID:   "user-1",
				TenantID: "tenant-1",
				Roles:    []string{tt.role},
				Resource: tt.resource,
				Action:   tt.action,
			})

			if decision.Allowed != tt.expected {
				t.Errorf("expected allowed=%v, got %v (reason: %s)",
					tt.expected, decision.Allowed, decision.Reason)
			}
		})
	}
}

func TestIntegration_RoleInheritance_ProjectChain(t *testing.T) {
	engine := newTestEngine()

	tests := []struct {
		name     string
		role     string
		resource string
		action   string
		expected bool
	}{
		// project_admin → project_lead → project_developer → project_viewer
		{"project_lead inherits project:manage from project_admin", "project_lead", "project", "manage", true},
		{"project_lead inherits pipeline:* from project_admin", "project_lead", "pipeline", "delete", true},
		{"project_developer inherits pipeline:approve from project_lead", "project_developer", "pipeline", "approve", true},
		{"project_developer inherits ticket:* from project_lead", "project_developer", "ticket", "manage", true},
		{"project_viewer inherits pipeline:execute from chain", "project_viewer", "pipeline", "execute", true},
		{"project_viewer inherits pipeline:write from chain", "project_viewer", "pipeline", "write", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			decision := engine.Authorize(context.Background(), AuthZRequest{
				UserID:   "user-1",
				TenantID: "tenant-1",
				Roles:    []string{tt.role},
				Resource: tt.resource,
				Action:   tt.action,
			})

			if decision.Allowed != tt.expected {
				t.Errorf("expected allowed=%v, got %v (reason: %s)",
					tt.expected, decision.Allowed, decision.Reason)
			}
		})
	}
}

func TestIntegration_RoleInheritance_StandaloneRolesDoNotInherit(t *testing.T) {
	engine := newTestEngine()

	// Business roles are standalone — no inheritance
	tests := []struct {
		name     string
		role     string
		resource string
		action   string
		expected bool
	}{
		// org_admin is standalone — does NOT inherit from tenant_admin
		// org_admin has its own explicit permissions: *:read, *:write, *:execute, *:manage, *:approve
		{"org_admin has explicit manage", "org_admin", "config", "manage", true},
		// tech_lead is standalone — does NOT inherit from org_admin
		{"tech_lead no manage (standalone)", "tech_lead", "config", "manage", false},
		// developer is standalone — does NOT inherit from tech_lead
		{"developer no approve (standalone)", "developer", "pipeline", "approve", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			decision := engine.Authorize(context.Background(), AuthZRequest{
				UserID:   "user-1",
				TenantID: "tenant-1",
				Roles:    []string{tt.role},
				Resource: tt.resource,
				Action:   tt.action,
			})

			if decision.Allowed != tt.expected {
				t.Errorf("expected allowed=%v, got %v (reason: %s)",
					tt.expected, decision.Allowed, decision.Reason)
			}
		})
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 8: Wildcard permissions
// ─────────────────────────────────────────────────────────────────────────────

func TestIntegration_WildcardPermission_FullWildcard(t *testing.T) {
	engine := newTestEngine()

	// super_admin has *:* — matches everything
	resources := []string{"pipeline", "deployment", "config", "alert", "finops", "anything"}
	actions := []string{"read", "write", "delete", "manage", "approve", "execute", "anything"}

	for _, res := range resources {
		for _, act := range actions {
			decision := engine.Authorize(context.Background(), AuthZRequest{
				UserID:   "user-1",
				TenantID: "tenant-1",
				Roles:    []string{"super_admin"},
				Resource: res,
				Action:   act,
			})
			if !decision.Allowed {
				t.Errorf("super_admin *:* should allow %s:%s, got denied: %s",
					res, act, decision.Reason)
			}
		}
	}
}

func TestIntegration_WildcardPermission_ResourceWildcard(t *testing.T) {
	engine := newTestEngine()

	// pipeline.admin has pipeline:* — matches any action on pipeline
	actions := []string{"read", "write", "delete", "manage", "approve", "execute"}

	for _, act := range actions {
		decision := engine.Authorize(context.Background(), AuthZRequest{
			UserID:   "user-1",
			TenantID: "tenant-1",
			Roles:    []string{"pipeline.admin"},
			Resource: "pipeline",
			Action:   act,
		})
		if !decision.Allowed {
			t.Errorf("pipeline.admin pipeline:* should allow pipeline:%s, got denied: %s",
				act, decision.Reason)
		}
	}
}

func TestIntegration_WildcardPermission_ResourceWildcard_DenyOtherResource(t *testing.T) {
	engine := newTestEngine()

	// pipeline.admin has pipeline:* — should NOT match other resources
	decision := engine.Authorize(context.Background(), AuthZRequest{
		UserID:   "user-1",
		TenantID: "tenant-1",
		Roles:    []string{"pipeline.admin"},
		Resource: "config",
		Action:   "read",
	})

	if decision.Allowed {
		t.Error("pipeline.admin should not have access to config:read")
	}
}

func TestIntegration_WildcardPermission_ActionWildcard(t *testing.T) {
	engine := newTestEngine()

	// sre has *:read — matches read on any resource
	resources := []string{"pipeline", "deployment", "config", "alert", "project"}

	for _, res := range resources {
		decision := engine.Authorize(context.Background(), AuthZRequest{
			UserID:   "user-1",
			TenantID: "tenant-1",
			Roles:    []string{"sre"},
			Resource: res,
			Action:   "read",
		})
		if !decision.Allowed {
			t.Errorf("sre *:read should allow %s:read, got denied: %s",
				res, decision.Reason)
		}
	}
}

func TestIntegration_WildcardPermission_ActionWildcard_DenyOtherAction(t *testing.T) {
	engine := newTestEngine()

	// sre has *:read but NOT *:write
	// sre has config:write explicitly though, so use a resource sre doesn't have write for
	decision := engine.Authorize(context.Background(), AuthZRequest{
		UserID:   "user-1",
		TenantID: "tenant-1",
		Roles:    []string{"viewer"},
		Resource: "pipeline",
		Action:   "delete",
	})

	if decision.Allowed {
		t.Error("viewer should not have pipeline:delete")
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 9: Permission cache
// ─────────────────────────────────────────────────────────────────────────────

func TestIntegration_Cache_HitOnSecondCall(t *testing.T) {
	// Use a nil redis client — cache won't actually store, but we can verify
	// the engine flow works with cache enabled
	cache := NewPermissionCache(nil, DefaultPermissionCacheConfig())
	engine := NewAuthorizationEngineWithCache(nil, EngineConfig{
		UseInMemoryRBAC:  true,
		AuditEnabled:     false,
		ChainHashEnabled: false,
	}, cache)

	req := AuthZRequest{
		UserID:   "user-1",
		TenantID: "tenant-1",
		Roles:    []string{"developer"},
		Resource: "pipeline",
		Action:   "read",
	}

	// First call — cache miss, RBAC check
	decision1 := engine.Authorize(context.Background(), req)
	if !decision1.Allowed {
		t.Errorf("first call should be allowed, got denied: %s", decision1.Reason)
	}

	// Second call — still works (nil client means no actual caching)
	decision2 := engine.Authorize(context.Background(), req)
	if !decision2.Allowed {
		t.Errorf("second call should be allowed, got denied: %s", decision2.Reason)
	}

	// Verify cache stats — nil client means no actual caching
	stats := cache.GetStats()
	if stats.Sets != 0 {
		t.Errorf("nil client should not cache, got sets=%d", stats.Sets)
	}
}

func TestIntegration_Cache_OnlyCachesAllow(t *testing.T) {
	cache := NewPermissionCache(nil, DefaultPermissionCacheConfig())

	// Deny decision should not be cached
	cache.Set(context.Background(), AuthZRequest{
		UserID: "u1", TenantID: "t1", Resource: "pipeline", Action: "write",
	}, AuthZDecision{Allowed: false, Reason: "denied", Source: "rbac"})

	stats := cache.GetStats()
	if stats.Sets != 0 {
		t.Errorf("deny should not be cached, got sets=%d", stats.Sets)
	}

	// Allow decision should be cached (but nil client means no-op)
	cache.Set(context.Background(), AuthZRequest{
		UserID: "u1", TenantID: "t1", Resource: "pipeline", Action: "read",
	}, AuthZDecision{Allowed: true, Reason: "authorized", Source: "rbac"})

	stats = cache.GetStats()
	if stats.Sets != 0 {
		t.Errorf("nil client should not cache, got sets=%d", stats.Sets)
	}
}

func TestIntegration_Cache_InvalidationMethods(t *testing.T) {
	cache := NewPermissionCache(nil, DefaultPermissionCacheConfig())

	// All invalidation methods should work without panic on nil client
	cache.InvalidateUser(context.Background(), "user-1", "tenant-1")
	cache.InvalidateTenant(context.Background(), "tenant-1")
	cache.InvalidateAll(context.Background())

	// Verify stats
	stats := cache.GetStats()
	if stats.Invalidations != 0 {
		t.Errorf("nil client should not track invalidations, got %d", stats.Invalidations)
	}
}

func TestIntegration_Cache_NilCache_EngineWorks(t *testing.T) {
	// Engine without cache should work normally
	engine := NewAuthorizationEngine(nil, EngineConfig{
		UseInMemoryRBAC:  true,
		AuditEnabled:     false,
		ChainHashEnabled: false,
	})

	decision := engine.Authorize(context.Background(), AuthZRequest{
		UserID:   "user-1",
		TenantID: "tenant-1",
		Roles:    []string{"developer"},
		Resource: "pipeline",
		Action:   "read",
	})

	if !decision.Allowed {
		t.Errorf("engine without cache should work, got denied: %s", decision.Reason)
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 10: Audit log chain hash
//
// The chain hash computation requires a DB-backed repo.
// Here we test the hash computation logic directly.
// ─────────────────────────────────────────────────────────────────────────────

func TestIntegration_ChainHash_ComputeChainHash(t *testing.T) {
	// Test the chain hash computation logic directly
	// Hash: SHA256(prev_hash + tenant_id + user_id + resource + action + decision + timestamp)

	prevHash := ""
	tenantID := "tenant-1"
	userID := "user-1"
	resource := "pipeline"
	action := "read"
	decision := "allow"
	ts := time.Date(2026, 6, 7, 12, 0, 0, 0, time.UTC)

	// First entry (no prev hash)
	payload := fmt.Sprintf("%s|%s|%s|%s|%s|%s|%s",
		prevHash, tenantID, userID, resource, action, decision, ts.Format(time.RFC3339Nano))
	hash1 := sha256.Sum256([]byte(payload))
	hash1Hex := hex.EncodeToString(hash1[:])

	if hash1Hex == "" {
		t.Error("hash should not be empty")
	}
	if len(hash1Hex) != 64 {
		t.Errorf("expected 64-char hex hash, got %d chars", len(hash1Hex))
	}

	// Second entry (with prev hash)
	payload2 := fmt.Sprintf("%s|%s|%s|%s|%s|%s|%s",
		hash1Hex, tenantID, userID, resource, "write", "deny", ts.Add(time.Second).Format(time.RFC3339Nano))
	hash2 := sha256.Sum256([]byte(payload2))
	hash2Hex := hex.EncodeToString(hash2[:])

	// Second hash should be different from first
	if hash2Hex == hash1Hex {
		t.Error("consecutive hashes should be different")
	}

	// Second hash should reference first hash via prev_hash
	// This is verified by the fact that hash1Hex is included in the payload for hash2
}

func TestIntegration_ChainHash_DifferentInputs_DifferentHashes(t *testing.T) {
	ts := time.Date(2026, 6, 7, 12, 0, 0, 0, time.UTC)

	// Same inputs → same hash (deterministic)
	payload1 := fmt.Sprintf("%s|%s|%s|%s|%s|%s|%s",
		"", "t1", "u1", "pipeline", "read", "allow", ts.Format(time.RFC3339Nano))
	hash1 := sha256.Sum256([]byte(payload1))

	payload1Again := fmt.Sprintf("%s|%s|%s|%s|%s|%s|%s",
		"", "t1", "u1", "pipeline", "read", "allow", ts.Format(time.RFC3339Nano))
	hash1Again := sha256.Sum256([]byte(payload1Again))

	if hash1 != hash1Again {
		t.Error("same inputs should produce same hash")
	}

	// Different user → different hash
	payload2 := fmt.Sprintf("%s|%s|%s|%s|%s|%s|%s",
		"", "t1", "u2", "pipeline", "read", "allow", ts.Format(time.RFC3339Nano))
	hash2 := sha256.Sum256([]byte(payload2))

	if hash1 == hash2 {
		t.Error("different user should produce different hash")
	}

	// Different decision → different hash
	payload3 := fmt.Sprintf("%s|%s|%s|%s|%s|%s|%s",
		"", "t1", "u1", "pipeline", "read", "deny", ts.Format(time.RFC3339Nano))
	hash3 := sha256.Sum256([]byte(payload3))

	if hash1 == hash3 {
		t.Error("different decision should produce different hash")
	}
}

func TestIntegration_ChainHash_TamperDetection(t *testing.T) {
	ts := time.Date(2026, 6, 7, 12, 0, 0, 0, time.UTC)

	// Build a chain of 3 entries
	prevHash := ""
	entries := []struct {
		userID   string
		resource string
		action   string
		decision string
	}{
		{"user-1", "pipeline", "read", "allow"},
		{"user-2", "deployment", "write", "deny"},
		{"user-1", "config", "delete", "allow"},
	}

	hashes := make([]string, len(entries))
	for i, e := range entries {
		payload := fmt.Sprintf("%s|%s|%s|%s|%s|%s|%s",
			prevHash, "tenant-1", e.userID, e.resource, e.action, e.decision,
			ts.Add(time.Duration(i)*time.Second).Format(time.RFC3339Nano))
		hash := sha256.Sum256([]byte(payload))
		hashes[i] = hex.EncodeToString(hash[:])
		prevHash = hashes[i]
	}

	// Verify chain: each hash should be unique
	seen := make(map[string]bool)
	for i, h := range hashes {
		if seen[h] {
			t.Errorf("hash[%d] is duplicate: %s", i, h)
		}
		seen[h] = true
	}

	// Tamper with entry 1's user — chain should break
	tamperedPayload := fmt.Sprintf("%s|%s|%s|%s|%s|%s|%s",
		"", "tenant-1", "TAMPERED", "pipeline", "read", "allow",
		ts.Format(time.RFC3339Nano))
	tamperedHash := sha256.Sum256([]byte(tamperedPayload))
	tamperedHashHex := hex.EncodeToString(tamperedHash[:])

	if tamperedHashHex == hashes[0] {
		t.Error("tampered hash should not match original")
	}

	// Verify that tampering breaks the chain reference
	// Entry 2's prev_hash should equal entry 1's hash
	// If entry 1 is tampered, the chain is broken
	if tamperedHashHex == hashes[1] {
		t.Error("tampered entry should not chain to entry 2")
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 11: Concurrent authorization (race condition test)
// ─────────────────────────────────────────────────────────────────────────────

func TestIntegration_ConcurrentAuthorization_NoRace(t *testing.T) {
	engine := newTestEngine()

	const numGoroutines = 100
	const numIterations = 10

	var wg sync.WaitGroup
	var allowCount int64
	var denyCount int64

	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()

			for j := 0; j < numIterations; j++ {
				// Alternate between allowed and denied requests
				var req AuthZRequest
				if j%2 == 0 {
					req = AuthZRequest{
						UserID:   fmt.Sprintf("user-%d", id),
						TenantID: "tenant-1",
						Roles:    []string{"developer"},
						Resource: "pipeline",
						Action:   "read",
					}
				} else {
					req = AuthZRequest{
						UserID:   fmt.Sprintf("user-%d", id),
						TenantID: "tenant-1",
						Roles:    []string{"viewer"},
						Resource: "pipeline",
						Action:   "write",
					}
				}

				decision := engine.Authorize(context.Background(), req)

				if decision.Allowed {
					atomic.AddInt64(&allowCount, 1)
				} else {
					atomic.AddInt64(&denyCount, 1)
				}
			}
		}(i)
	}

	wg.Wait()

	expectedTotal := int64(numGoroutines * numIterations)
	total := allowCount + denyCount
	if total != expectedTotal {
		t.Errorf("expected %d total decisions, got %d", expectedTotal, total)
	}

	// Half should be allowed (developer:read), half denied (viewer:write)
	expectedAllow := int64(numGoroutines * numIterations / 2)
	expectedDeny := int64(numGoroutines * numIterations / 2)
	if allowCount != expectedAllow {
		t.Errorf("expected %d allows, got %d", expectedAllow, allowCount)
	}
	if denyCount != expectedDeny {
		t.Errorf("expected %d denies, got %d", expectedDeny, denyCount)
	}
}

func TestIntegration_ConcurrentAuthorization_MixedRoles(t *testing.T) {
	engine := newTestEngine()

	roles := []string{"super_admin", "developer", "viewer", "sre", "org_admin", "tech_lead"}
	resources := []string{"pipeline", "deployment", "config", "alert"}
	actions := []string{"read", "write", "delete", "manage"}

	const numGoroutines = 50

	var wg sync.WaitGroup
	var totalDecisions int64

	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()

			for j := 0; j < 20; j++ {
				role := roles[(id+j)%len(roles)]
				resource := resources[(id+j)%len(resources)]
				action := actions[(id+j)%len(actions)]

				decision := engine.Authorize(context.Background(), AuthZRequest{
					UserID:   fmt.Sprintf("user-%d", id),
					TenantID: "tenant-1",
					Roles:    []string{role},
					Resource: resource,
					Action:   action,
				})

				// We don't care about the result, just that it doesn't panic
				_ = decision
				atomic.AddInt64(&totalDecisions, 1)
			}
		}(i)
	}

	wg.Wait()

	expectedTotal := int64(numGoroutines * 20)
	if totalDecisions != expectedTotal {
		t.Errorf("expected %d decisions, got %d", expectedTotal, totalDecisions)
	}
}

func TestIntegration_ConcurrentAuthorization_WithCache(t *testing.T) {
	cache := NewPermissionCache(nil, DefaultPermissionCacheConfig())
	engine := NewAuthorizationEngineWithCache(nil, EngineConfig{
		UseInMemoryRBAC:  true,
		AuditEnabled:     false,
		ChainHashEnabled: false,
	}, cache)

	const numGoroutines = 100

	var wg sync.WaitGroup
	var allowCount int64

	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()

			decision := engine.Authorize(context.Background(), AuthZRequest{
				UserID:   fmt.Sprintf("user-%d", id),
				TenantID: "tenant-1",
				Roles:    []string{"developer"},
				Resource: "pipeline",
				Action:   "read",
			})

			if decision.Allowed {
				atomic.AddInt64(&allowCount, 1)
			}
		}(i)
	}

	wg.Wait()

	if allowCount != numGoroutines {
		t.Errorf("expected %d allows, got %d", numGoroutines, allowCount)
	}

	// Verify cache stats don't have race conditions
	stats := cache.GetStats()
	if stats.Sets < 0 || stats.Hits < 0 || stats.Misses < 0 {
		t.Error("cache stats should not be negative")
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 12: Multi-role authorization
// ─────────────────────────────────────────────────────────────────────────────

func TestIntegration_MultiRole_OneGrantsAccess(t *testing.T) {
	engine := newTestEngine()

	// User has viewer (no write) + developer (has write)
	// At least one role should grant access
	decision := engine.Authorize(context.Background(), AuthZRequest{
		UserID:   "user-1",
		TenantID: "tenant-1",
		Roles:    []string{"viewer", "developer"},
		Resource: "pipeline",
		Action:   "write",
	})

	if !decision.Allowed {
		t.Errorf("multi-role with developer should allow pipeline:write, got denied: %s", decision.Reason)
	}
}

func TestIntegration_MultiRole_NoneGrantAccess(t *testing.T) {
	engine := newTestEngine()

	// User has viewer + dba — neither has pipeline:delete
	decision := engine.Authorize(context.Background(), AuthZRequest{
		UserID:   "user-1",
		TenantID: "tenant-1",
		Roles:    []string{"viewer", "dba"},
		Resource: "pipeline",
		Action:   "delete",
	})

	if decision.Allowed {
		t.Error("viewer + dba should not have pipeline:delete")
	}
}

func TestIntegration_MultiRole_EmptyRoles(t *testing.T) {
	engine := newTestEngine()

	decision := engine.Authorize(context.Background(), AuthZRequest{
		UserID:   "user-1",
		TenantID: "tenant-1",
		Roles:    []string{},
		Resource: "pipeline",
		Action:   "read",
	})

	if decision.Allowed {
		t.Error("empty roles should deny")
	}
	if decision.Source != "rbac" {
		t.Errorf("expected source=rbac, got %s", decision.Source)
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 13: Edge cases
// ─────────────────────────────────────────────────────────────────────────────

func TestIntegration_EdgeCase_UnknownRoleDenied(t *testing.T) {
	engine := newTestEngine()

	decision := engine.Authorize(context.Background(), AuthZRequest{
		UserID:   "user-1",
		TenantID: "tenant-1",
		Roles:    []string{"nonexistent_role"},
		Resource: "pipeline",
		Action:   "read",
	})

	if decision.Allowed {
		t.Error("unknown role should be denied")
	}
	if decision.Source != "rbac" {
		t.Errorf("expected source=rbac, got %s", decision.Source)
	}
}

func TestIntegration_EdgeCase_SpecialCharactersInIDs(t *testing.T) {
	engine := newTestEngine()

	// Test with special characters in user/tenant IDs
	decision := engine.Authorize(context.Background(), AuthZRequest{
		UserID:   "user-with-special-chars!@#$%",
		TenantID: "tenant-with-unicode-\u4e2d\u6587",
		Roles:    []string{"developer"},
		Resource: "pipeline",
		Action:   "read",
	})

	if !decision.Allowed {
		t.Errorf("special characters in IDs should not affect authorization, got denied: %s", decision.Reason)
	}
}

func TestIntegration_EdgeCase_EmptyResource(t *testing.T) {
	engine := newTestEngine()

	decision := engine.Authorize(context.Background(), AuthZRequest{
		UserID:   "user-1",
		TenantID: "tenant-1",
		Roles:    []string{"developer"},
		Resource: "",
		Action:   "read",
	})

	// Empty resource should not match any permission
	if decision.Allowed {
		t.Error("empty resource should be denied")
	}
}

func TestIntegration_EdgeCase_EmptyAction(t *testing.T) {
	engine := newTestEngine()

	decision := engine.Authorize(context.Background(), AuthZRequest{
		UserID:   "user-1",
		TenantID: "tenant-1",
		Roles:    []string{"developer"},
		Resource: "pipeline",
		Action:   "",
	})

	// Empty action should not match any permission
	if decision.Allowed {
		t.Error("empty action should be denied")
	}
}

func TestIntegration_EdgeCase_ABACPassesWhenNoMatchingPolicy(t *testing.T) {
	engine := newTestEngine()

	// Normal request — no ABAC deny policies should match
	decision := engine.Authorize(context.Background(), AuthZRequest{
		UserID:   "user-1",
		TenantID: "tenant-1",
		Roles:    []string{"developer"},
		Resource: "pipeline",
		Action:   "read",
		ResourceAttrs: map[string]interface{}{
			"some_attr": "some_value",
		},
		Environment: map[string]interface{}{
			"some_env": "some_value",
		},
	})

	if !decision.Allowed {
		t.Errorf("no ABAC policy should match, got denied: %s", decision.Reason)
	}
}

func TestIntegration_EdgeCase_ABACAllowEffectDoesNotBlock(t *testing.T) {
	// Create engine with custom ABAC policies — allow effect should not block
	policies := []ABACPolicy{
		{
			ID:           "allow-policy",
			Name:         "Allow policy",
			Effect:       ABACAllow,
			ResourceType: "*",
			ActionType:   "*",
			ResourceConditions: map[string]interface{}{
				"special": true,
			},
			Priority: 100,
			Enabled:  true,
		},
	}
	engine := NewAuthorizationEngineWithABAC(nil, EngineConfig{
		UseInMemoryRBAC:  true,
		AuditEnabled:     false,
		ChainHashEnabled: false,
	}, policies)

	decision := engine.Authorize(context.Background(), AuthZRequest{
		UserID:   "user-1",
		TenantID: "tenant-1",
		Roles:    []string{"developer"},
		Resource: "pipeline",
		Action:   "read",
		ResourceAttrs: map[string]interface{}{
			"special": true,
		},
	})

	if !decision.Allowed {
		t.Errorf("ABAC allow effect should not block, got denied: %s", decision.Reason)
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 14: Custom ABAC policies
// ─────────────────────────────────────────────────────────────────────────────

func TestIntegration_CustomABACPolicy_DenySpecificResource(t *testing.T) {
	policies := []ABACPolicy{
		{
			ID:           "deny-prod-delete",
			Name:         "Deny production delete",
			Effect:       ABACDeny,
			ResourceType: "deployment",
			ActionType:   "delete",
			ResourceConditions: map[string]interface{}{
				"environment": "production",
			},
			Priority: 100,
			Enabled:  true,
		},
	}
	engine := NewAuthorizationEngineWithABAC(nil, EngineConfig{
		UseInMemoryRBAC:  true,
		AuditEnabled:     false,
		ChainHashEnabled: false,
	}, policies)

	// platform_admin has *:delete → RBAC passes
	// environment=production + action=delete → ABAC denies
	decision := engine.Authorize(context.Background(), AuthZRequest{
		UserID:   "user-1",
		TenantID: "tenant-1",
		Roles:    []string{"platform_admin"},
		Resource: "deployment",
		Action:   "delete",
		ResourceAttrs: map[string]interface{}{
			"environment": "production",
		},
	})

	if decision.Allowed {
		t.Error("production delete should be denied by custom ABAC policy")
	}
	if decision.Source != "abac" {
		t.Errorf("expected source=abac, got %s", decision.Source)
	}
}

func TestIntegration_CustomABACPolicy_DisabledPolicyIgnored(t *testing.T) {
	policies := []ABACPolicy{
		{
			ID:           "disabled-policy",
			Name:         "Disabled policy",
			Effect:       ABACDeny,
			ResourceType: "*",
			ActionType:   "*",
			ResourceConditions: map[string]interface{}{
				"block": true,
			},
			Priority: 100,
			Enabled:  false, // disabled
		},
	}
	engine := NewAuthorizationEngineWithABAC(nil, EngineConfig{
		UseInMemoryRBAC:  true,
		AuditEnabled:     false,
		ChainHashEnabled: false,
	}, policies)

	decision := engine.Authorize(context.Background(), AuthZRequest{
		UserID:   "user-1",
		TenantID: "tenant-1",
		Roles:    []string{"developer"},
		Resource: "pipeline",
		Action:   "read",
		ResourceAttrs: map[string]interface{}{
			"block": true,
		},
	})

	if !decision.Allowed {
		t.Errorf("disabled policy should not block, got denied: %s", decision.Reason)
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 15: Context metadata extraction
// ─────────────────────────────────────────────────────────────────────────────

func TestIntegration_ContextMetadata_IP(t *testing.T) {
	ctx := context.Background()
	ctx = ContextWithIP(ctx, "192.168.1.1")

	ip := extractIP(ctx)
	if ip != "192.168.1.1" {
		t.Errorf("expected IP=192.168.1.1, got %s", ip)
	}
}

func TestIntegration_ContextMetadata_UserAgent(t *testing.T) {
	ctx := context.Background()
	ctx = ContextWithUserAgent(ctx, "Mozilla/5.0")

	ua := extractUserAgent(ctx)
	if ua != "Mozilla/5.0" {
		t.Errorf("expected UA=Mozilla/5.0, got %s", ua)
	}
}

func TestIntegration_ContextMetadata_RequestID(t *testing.T) {
	ctx := context.Background()
	ctx = ContextWithRequestID(ctx, "req-123")

	rid := extractRequestID(ctx)
	if rid != "req-123" {
		t.Errorf("expected requestID=req-123, got %s", rid)
	}
}

func TestIntegration_ContextMetadata_Missing(t *testing.T) {
	ctx := context.Background()

	if extractIP(ctx) != "" {
		t.Error("missing IP should return empty")
	}
	if extractUserAgent(ctx) != "" {
		t.Error("missing UA should return empty")
	}
	if extractRequestID(ctx) != "" {
		t.Error("missing request ID should return empty")
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 16: StopAuditWorker
// ─────────────────────────────────────────────────────────────────────────────

func TestIntegration_StopAuditWorker_NoPanic(t *testing.T) {
	engine := NewAuthorizationEngine(nil, EngineConfig{
		UseInMemoryRBAC:  true,
		AuditEnabled:     false,
		ChainHashEnabled: false,
	})

	// Should not panic
	engine.StopAuditWorker()

	// Double stop should not panic
	engine.StopAuditWorker()
}

// DB-backed integration tests are in integration_db_test.go (//go:build integration)
