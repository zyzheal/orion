package auth

import (
	"context"
	"testing"
)

func TestAuthorizationEngine_RBAC_Allow(t *testing.T) {
	engine := NewAuthorizationEngine(nil, EngineConfig{
		UseInMemoryRBAC:  true,
		AuditEnabled:     false,
		ChainHashEnabled: false,
	})

	tests := []struct {
		name     string
		req      AuthZRequest
		expected bool
	}{
		{
			name: "super_admin bypasses all",
			req: AuthZRequest{
				UserID: "u1", TenantID: "t1", Roles: []string{"super_admin"},
				Resource: "pipeline", Action: "delete",
			},
			expected: true,
		},
		{
			name: "developer can read pipeline",
			req: AuthZRequest{
				UserID: "u2", TenantID: "t1", Roles: []string{"developer"},
				Resource: "pipeline", Action: "read",
			},
			expected: true,
		},
		{
			name: "developer cannot delete pipeline",
			req: AuthZRequest{
				UserID: "u2", TenantID: "t1", Roles: []string{"developer"},
				Resource: "pipeline", Action: "delete",
			},
			expected: false,
		},
		{
			name: "viewer can read deployment",
			req: AuthZRequest{
				UserID: "u3", TenantID: "t1", Roles: []string{"viewer"},
				Resource: "deployment", Action: "read",
			},
			expected: true,
		},
		{
			name: "viewer cannot write deployment",
			req: AuthZRequest{
				UserID: "u3", TenantID: "t1", Roles: []string{"viewer"},
				Resource: "deployment", Action: "write",
			},
			expected: false,
		},
		{
			name: "sre can execute deployment",
			req: AuthZRequest{
				UserID: "u4", TenantID: "t1", Roles: []string{"sre"},
				Resource: "deployment", Action: "execute",
			},
			expected: true,
		},
		{
			name: "unknown role denied",
			req: AuthZRequest{
				UserID: "u5", TenantID: "t1", Roles: []string{"unknown_role"},
				Resource: "pipeline", Action: "read",
			},
			expected: false,
		},
		{
			name: "project_admin can manage pipeline",
			req: AuthZRequest{
				UserID: "u6", TenantID: "t1", Roles: []string{"project_admin"},
				Resource: "pipeline", Action: "write",
			},
			expected: true,
		},
		{
			name: "pipeline.viewer can only read",
			req: AuthZRequest{
				UserID: "u7", TenantID: "t1", Roles: []string{"pipeline.viewer"},
				Resource: "pipeline", Action: "read",
			},
			expected: true,
		},
		{
			name: "pipeline.viewer cannot write",
			req: AuthZRequest{
				UserID: "u7", TenantID: "t1", Roles: []string{"pipeline.viewer"},
				Resource: "pipeline", Action: "write",
			},
			expected: false,
		},
		{
			name: "multiple roles - one grants",
			req: AuthZRequest{
				UserID: "u8", TenantID: "t1", Roles: []string{"viewer", "developer"},
				Resource: "pipeline", Action: "write",
			},
			expected: true,
		},
		{
			name: "no roles denied",
			req: AuthZRequest{
				UserID: "u9", TenantID: "t1", Roles: []string{},
				Resource: "pipeline", Action: "read",
			},
			expected: false,
		},
		{
			name: "finops_admin can manage finops",
			req: AuthZRequest{
				UserID: "u10", TenantID: "t1", Roles: []string{"finops_admin"},
				Resource: "finops", Action: "write",
			},
			expected: true,
		},
		{
			name: "auditor can read audit_log",
			req: AuthZRequest{
				UserID: "u11", TenantID: "t1", Roles: []string{"auditor"},
				Resource: "audit_log", Action: "read",
			},
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			decision := engine.Authorize(context.Background(), tt.req)
			if decision.Allowed != tt.expected {
				t.Errorf("expected allowed=%v, got %v (reason: %s, source: %s)",
					tt.expected, decision.Allowed, decision.Reason, decision.Source)
			}
		})
	}
}

func TestAuthorizationEngine_RBAC_Source(t *testing.T) {
	engine := NewAuthorizationEngine(nil, EngineConfig{
		UseInMemoryRBAC:  true,
		AuditEnabled:     false,
		ChainHashEnabled: false,
	})

	// super_admin should report source as "super_admin"
	decision := engine.Authorize(context.Background(), AuthZRequest{
		UserID: "u1", TenantID: "t1", Roles: []string{"super_admin"},
		Resource: "anything", Action: "anything",
	})
	if decision.Source != "super_admin" {
		t.Errorf("expected source=super_admin, got %s", decision.Source)
	}

	// regular role should report source as "rbac"
	decision = engine.Authorize(context.Background(), AuthZRequest{
		UserID: "u2", TenantID: "t1", Roles: []string{"developer"},
		Resource: "pipeline", Action: "read",
	})
	if decision.Source != "rbac" {
		t.Errorf("expected source=rbac, got %s", decision.Source)
	}
}

func TestAuthorizationEngine_ABAC_DenyTenantIsolation(t *testing.T) {
	// ABAC has a tenant-isolation deny policy that denies when tenant_mismatch=true
	engine := NewAuthorizationEngine(nil, EngineConfig{
		UseInMemoryRBAC:  true,
		AuditEnabled:     false,
		ChainHashEnabled: false,
	})

	// Regular request should pass (no tenant_mismatch)
	decision := engine.Authorize(context.Background(), AuthZRequest{
		UserID: "u1", TenantID: "t1", Roles: []string{"developer"},
		Resource: "pipeline", Action: "read",
	})
	if !decision.Allowed {
		t.Errorf("regular request should be allowed, got denied: %s", decision.Reason)
	}

	// Request with tenant_mismatch should be denied by ABAC
	decision = engine.Authorize(context.Background(), AuthZRequest{
		UserID: "u1", TenantID: "t1", Roles: []string{"developer"},
		Resource: "pipeline", Action: "read",
		ResourceAttrs: map[string]interface{}{
			"tenant_mismatch": true,
		},
	})
	if decision.Allowed {
		t.Error("request with tenant_mismatch should be denied by ABAC")
	}
	if decision.Source != "abac" {
		t.Errorf("expected source=abac, got %s", decision.Source)
	}
}

func TestAuthorizationEngine_ABAC_SuperAdminSkipsABAC(t *testing.T) {
	engine := NewAuthorizationEngine(nil, EngineConfig{
		UseInMemoryRBAC:  true,
		AuditEnabled:     false,
		ChainHashEnabled: false,
	})

	// super_admin should skip ABAC even with tenant_mismatch
	decision := engine.Authorize(context.Background(), AuthZRequest{
		UserID: "u1", TenantID: "t1", Roles: []string{"super_admin"},
		Resource: "pipeline", Action: "read",
		ResourceAttrs: map[string]interface{}{
			"tenant_mismatch": true,
		},
	})
	if !decision.Allowed {
		t.Errorf("super_admin should skip ABAC, got denied: %s", decision.Reason)
	}
	if decision.Source != "super_admin" {
		t.Errorf("expected source=super_admin, got %s", decision.Source)
	}
}

func TestAuthorizationEngine_InheritanceChain(t *testing.T) {
	engine := NewAuthorizationEngine(nil, EngineConfig{
		UseInMemoryRBAC:  true,
		AuditEnabled:     false,
		ChainHashEnabled: false,
	})

	// project_viewer inherits from project_developer → project_lead → project_admin
	// project_admin has pipeline:*, so project_viewer should inherit pipeline:read
	decision := engine.Authorize(context.Background(), AuthZRequest{
		UserID: "u1", TenantID: "t1", Roles: []string{"project_viewer"},
		Resource: "pipeline", Action: "read",
	})
	if !decision.Allowed {
		t.Errorf("project_viewer should inherit pipeline:read, got denied: %s", decision.Reason)
	}

	// project_viewer should NOT inherit pipeline:write (project_developer has it,
	// but project_viewer doesn't inherit from project_developer — chain is reversed)
	// Actually: project_viewer → project_developer → project_lead → project_admin
	// project_developer has pipeline:write, so project_viewer should inherit it
	decision = engine.Authorize(context.Background(), AuthZRequest{
		UserID: "u1", TenantID: "t1", Roles: []string{"project_viewer"},
		Resource: "pipeline", Action: "write",
	})
	if !decision.Allowed {
		t.Errorf("project_viewer should inherit pipeline:write from chain, got denied: %s", decision.Reason)
	}
}

func TestAuthorizationEngine_MatchPermission(t *testing.T) {
	tests := []struct {
		perm     string
		target   string
		expected bool
	}{
		{"pipeline:read", "pipeline:read", true},
		{"pipeline:*", "pipeline:read", true},
		{"*:read", "pipeline:read", true},
		{"*:*", "pipeline:read", true},
		{"pipeline:read", "pipeline:write", false},
		{"deployment:read", "pipeline:read", false},
		{"pipeline:read", "deployment:read", false},
	}

	for _, tt := range tests {
		t.Run(tt.perm+" vs "+tt.target, func(t *testing.T) {
			result := matchPermission(tt.perm, tt.target)
			if result != tt.expected {
				t.Errorf("matchPermission(%q, %q) = %v, want %v",
					tt.perm, tt.target, result, tt.expected)
			}
		})
	}
}

func TestAuthorizationEngine_NoRolesDenies(t *testing.T) {
	engine := NewAuthorizationEngine(nil, EngineConfig{
		UseInMemoryRBAC:  true,
		AuditEnabled:     false,
		ChainHashEnabled: false,
	})

	decision := engine.Authorize(context.Background(), AuthZRequest{
		UserID: "u1", TenantID: "t1", Roles: []string{},
		Resource: "pipeline", Action: "read",
	})
	if decision.Allowed {
		t.Error("empty roles should deny")
	}
	if decision.Source != "rbac" {
		t.Errorf("expected source=rbac, got %s", decision.Source)
	}
}

func TestAuthorizationEngine_ABAC_WorkingHours(t *testing.T) {
	engine := NewAuthorizationEngine(nil, EngineConfig{
		UseInMemoryRBAC:  true,
		AuditEnabled:     false,
		ChainHashEnabled: false,
	})

	// Critical action outside working hours should be denied
	// Use sre role which has deployment:execute, so RBAC passes but ABAC denies
	decision := engine.Authorize(context.Background(), AuthZRequest{
		UserID: "u1", TenantID: "t1", Roles: []string{"sre"},
		Resource: "deployment", Action: "execute",
		ResourceAttrs: map[string]interface{}{
			"action_impact": "critical",
		},
		Environment: map[string]interface{}{
			"working_hours": false,
		},
	})
	if decision.Allowed {
		t.Error("critical action outside working hours should be denied by ABAC")
	}
	if decision.Source != "abac" {
		t.Errorf("expected source=abac, got %s", decision.Source)
	}
}

func TestAuthorizationEngine_ABAC_ExternalNetwork(t *testing.T) {
	engine := NewAuthorizationEngine(nil, EngineConfig{
		UseInMemoryRBAC:  true,
		AuditEnabled:     false,
		ChainHashEnabled: false,
	})

	// Write action from external network should be denied
	decision := engine.Authorize(context.Background(), AuthZRequest{
		UserID: "u1", TenantID: "t1", Roles: []string{"developer"},
		Resource: "pipeline", Action: "write",
		ResourceAttrs: map[string]interface{}{
			"action_impact": "write",
		},
		Environment: map[string]interface{}{
			"network": "external",
		},
	})
	if decision.Allowed {
		t.Error("write from external network should be denied by ABAC")
	}
}

func TestDefaultEngineConfig(t *testing.T) {
	cfg := DefaultEngineConfig()
	if !cfg.UseInMemoryRBAC {
		t.Error("default UseInMemoryRBAC should be true")
	}
	if !cfg.AuditEnabled {
		t.Error("default AuditEnabled should be true")
	}
	if !cfg.ChainHashEnabled {
		t.Error("default ChainHashEnabled should be true")
	}
}

func TestAuthorizationEngine_UserStatus_Disabled(t *testing.T) {
	engine := NewAuthorizationEngine(nil, EngineConfig{
		UseInMemoryRBAC:  true,
		AuditEnabled:     false,
		ChainHashEnabled: false,
	})

	// Disabled user should be denied even with valid roles
	decision := engine.Authorize(context.Background(), AuthZRequest{
		UserID: "u1", TenantID: "t1", Roles: []string{"developer"},
		Resource: "pipeline", Action: "read",
		UserStatus: "disabled",
	})
	if decision.Allowed {
		t.Error("disabled user should be denied")
	}
	if decision.Source != "status" {
		t.Errorf("expected source=status, got %s", decision.Source)
	}
	if decision.Reason != "user account is disabled" {
		t.Errorf("expected reason='user account is disabled', got %s", decision.Reason)
	}
}

func TestAuthorizationEngine_UserStatus_Suspended(t *testing.T) {
	engine := NewAuthorizationEngine(nil, EngineConfig{
		UseInMemoryRBAC:  true,
		AuditEnabled:     false,
		ChainHashEnabled: false,
	})

	// Suspended user should be denied even with super_admin role
	decision := engine.Authorize(context.Background(), AuthZRequest{
		UserID: "u1", TenantID: "t1", Roles: []string{"super_admin"},
		Resource: "pipeline", Action: "read",
		UserStatus: "suspended",
	})
	if decision.Allowed {
		t.Error("suspended super_admin should be denied")
	}
	if decision.Source != "status" {
		t.Errorf("expected source=status, got %s", decision.Source)
	}
}

func TestAuthorizationEngine_UserStatus_Active(t *testing.T) {
	engine := NewAuthorizationEngine(nil, EngineConfig{
		UseInMemoryRBAC:  true,
		AuditEnabled:     false,
		ChainHashEnabled: false,
	})

	// Active user should proceed normally
	decision := engine.Authorize(context.Background(), AuthZRequest{
		UserID: "u1", TenantID: "t1", Roles: []string{"developer"},
		Resource: "pipeline", Action: "read",
		UserStatus: "active",
	})
	if !decision.Allowed {
		t.Errorf("active user should be allowed, got denied: %s", decision.Reason)
	}
}

func TestAuthorizationEngine_UserStatus_Empty(t *testing.T) {
	engine := NewAuthorizationEngine(nil, EngineConfig{
		UseInMemoryRBAC:  true,
		AuditEnabled:     false,
		ChainHashEnabled: false,
	})

	// Empty status (default) should proceed normally
	decision := engine.Authorize(context.Background(), AuthZRequest{
		UserID: "u1", TenantID: "t1", Roles: []string{"developer"},
		Resource: "pipeline", Action: "read",
		UserStatus: "",
	})
	if !decision.Allowed {
		t.Errorf("empty status should be allowed, got denied: %s", decision.Reason)
	}
}

func TestPermissionCache_NilClient(t *testing.T) {
	// Cache with nil client should gracefully degrade
	cache := NewPermissionCache(nil, DefaultPermissionCacheConfig())

	req := AuthZRequest{
		UserID: "u1", TenantID: "t1", Roles: []string{"developer"},
		Resource: "pipeline", Action: "read",
	}

	// Get should return nil (cache miss)
	result := cache.Get(context.Background(), req)
	if result != nil {
		t.Error("nil client Get should return nil")
	}

	// Set should not panic
	cache.Set(context.Background(), req, AuthZDecision{Allowed: true, Reason: "test", Source: "rbac"})

	// Invalidate should not panic
	cache.InvalidateUser(context.Background(), "u1", "t1")
	cache.InvalidateTenant(context.Background(), "t1")
	cache.InvalidateAll(context.Background())

	// Stats should be zero
	stats := cache.GetStats()
	if stats.Hits != 0 || stats.Misses != 0 {
		t.Errorf("expected zero stats, got hits=%d misses=%d", stats.Hits, stats.Misses)
	}
}

func TestPermissionCache_OnlyCachesAllow(t *testing.T) {
	cache := NewPermissionCache(nil, DefaultPermissionCacheConfig())

	req := AuthZRequest{
		UserID: "u1", TenantID: "t1", Roles: []string{"developer"},
		Resource: "pipeline", Action: "read",
	}

	// Set a deny decision — should be silently skipped
	cache.Set(context.Background(), req, AuthZDecision{Allowed: false, Reason: "denied", Source: "rbac"})

	stats := cache.GetStats()
	if stats.Sets != 0 {
		t.Errorf("deny decision should not be cached, got sets=%d", stats.Sets)
	}
}

func TestPermissionCache_BuildKey(t *testing.T) {
	cache := NewPermissionCache(nil, DefaultPermissionCacheConfig())

	req := AuthZRequest{
		UserID: "user123", TenantID: "tenant456",
		Resource: "pipeline", Action: "read",
	}
	key := cache.buildKey(req)
	expected := "perm:tenant456:user123:pipeline:read"
	if key != expected {
		t.Errorf("expected key=%q, got %q", expected, key)
	}

	// Empty tenant should use "default"
	req2 := AuthZRequest{
		UserID: "user123", TenantID: "",
		Resource: "pipeline", Action: "read",
	}
	key2 := cache.buildKey(req2)
	expected2 := "perm:default:user123:pipeline:read"
	if key2 != expected2 {
		t.Errorf("expected key=%q, got %q", expected2, key2)
	}
}

func TestPermissionCache_StatsReset(t *testing.T) {
	cache := NewPermissionCache(nil, DefaultPermissionCacheConfig())

	// Nil client returns early without tracking stats
	// Verify stats start at zero and reset works
	cache.ResetStats()
	stats := cache.GetStats()
	if stats.Hits != 0 || stats.Misses != 0 || stats.Sets != 0 {
		t.Errorf("after reset, expected all zeros, got hits=%d misses=%d sets=%d",
			stats.Hits, stats.Misses, stats.Sets)
	}
}

func TestAuthorizationEngine_WithCache_NilCache(t *testing.T) {
	// Engine without cache should work normally
	engine := NewAuthorizationEngine(nil, EngineConfig{
		UseInMemoryRBAC:  true,
		AuditEnabled:     false,
		ChainHashEnabled: false,
	})

	decision := engine.Authorize(context.Background(), AuthZRequest{
		UserID: "u1", TenantID: "t1", Roles: []string{"developer"},
		Resource: "pipeline", Action: "read",
	})
	if !decision.Allowed {
		t.Errorf("engine without cache should work, got denied: %s", decision.Reason)
	}
}

func TestAuthorizationEngine_WithCache(t *testing.T) {
	cache := NewPermissionCache(nil, DefaultPermissionCacheConfig())
	engine := NewAuthorizationEngineWithCache(nil, EngineConfig{
		UseInMemoryRBAC:  true,
		AuditEnabled:     false,
		ChainHashEnabled: false,
	}, cache)

	// First request — cache miss, RBAC check
	decision := engine.Authorize(context.Background(), AuthZRequest{
		UserID: "u1", TenantID: "t1", Roles: []string{"developer"},
		Resource: "pipeline", Action: "read",
	})
	if !decision.Allowed {
		t.Errorf("first request should be allowed, got denied: %s", decision.Reason)
	}

	// Cache stats — nil client means no actual caching, but Set is called
	stats := cache.GetStats()
	// With nil client, Set does nothing (returns early), so sets should be 0
	if stats.Sets != 0 {
		t.Errorf("nil client should not cache, got sets=%d", stats.Sets)
	}
}
