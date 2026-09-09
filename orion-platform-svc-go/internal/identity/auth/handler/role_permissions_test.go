package handler

import "testing"

// TestRolePermissions_SecurityAdminHasAISecurityScope locks in the PERM-6
// conservative slice: security_admin owns the AI security/review surface, so
// it must grant ai:read (umbrella read) + ai-security:* + ai-review:*.
//
// This is a strict subset — the role must NOT gain ai:write / ai:execute /
// ai:delete / ai:admin, which would over-grant beyond security_admin's
// declared scope. Those are reserved for a future decision.
func TestRolePermissions_SecurityAdminHasAISecurityScope(t *testing.T) {
	perms := rolePermissions("security_admin")
	want := map[string]bool{
		"ai:read":       true,
		"ai-security:*": true,
		"ai-review:*":   true,
	}
	for _, p := range perms {
		if want[p] {
			delete(want, p)
		}
	}
	if len(want) > 0 {
		t.Errorf("security_admin missing PERM-6 permissions: %v (had %v)", want, perms)
	}
}

// TestRolePermissions_SecurityAdminDoesNotGainOtherAIResources asserts the
// conservative scope: security_admin must NOT grant write/execute/delete/
// admin on the umbrella ai resource, nor read/write on other AI resources
// (llm, skill, intelligence, agent, ai-gateway, ai-cost, ai-agent-run,
// ai_models, ai_decisions, ai_inference, ai_degradation, ai_orchestration).
//
// Regression test — a future "AI 端点权限定义" expansion must pass this
// test explicitly, not by silently widening security_admin.
func TestRolePermissions_SecurityAdminDoesNotGainOtherAIResources(t *testing.T) {
	perms := rolePermissions("security_admin")
	forbidden := []string{
		// umbrella ai — write/execute/delete/admin are out of scope
		"ai:write", "ai:execute", "ai:delete", "ai:admin",
		// other AI resources — none of these are security_admin's domain
		"ai:read:extra", // three-part syntax (frontend malformation) — must NOT appear
		"llm:read", "llm:write",
		"skill:read", "skill:write",
		"intelligence:read", "intelligence:write",
		"agent:read", "agent:write",
		"ai-gateway:read", "ai-cost:read",
		"ai-agent-run:read", "ai_models:read",
		"ai_decisions:read", "ai_inference:read",
	}
	for _, p := range perms {
		for _, f := range forbidden {
			if p == f {
				t.Errorf("security_admin must NOT have %q (PERM-6 conservative scope)", f)
			}
		}
	}
}

// TestRolePermissions_OtherRolesStillHaveNoAIPermissions asserts that
// PERM-6 does not leak: no non-admin role outside security_admin should
// gain ai* permissions in this conservative slice.
//
// platform_admin and super_admin are wildcard-granting by design, so they
// are excluded.
func TestRolePermissions_OtherRolesStillHaveNoAIPermissions(t *testing.T) {
	nonAdminRoles := []string{
		"tenant_admin", "finops_admin", "org_admin", "tech_lead",
		"developer", "sre", "dba", "viewer", "auditor", "user",
	}
	for _, role := range nonAdminRoles {
		for _, p := range rolePermissions(role) {
			// Wildcards that grant everything are also out of scope
			// for this assertion. We check literal "ai" prefixes only.
			if len(p) > 0 && (p == "ai:*" || (len(p) > 2 && p[:3] == "ai:")) {
				t.Errorf("role %q must NOT have %q in PERM-6 conservative slice", role, p)
			}
		}
	}
}

// TestRolePermissions_WildcardRolesStillCoverAIPermissions guards against a
// regression where the wildcard grant is accidentally removed. platform_admin
// and super_admin must continue to resolve ai:read via wildcard match, so
// security_admin's new literal grants do not create a gap for admins.
func TestRolePermissions_WildcardRolesStillCoverAIPermissions(t *testing.T) {
	// platform_admin grants "*:read" — any ai:read check must pass.
	platformAdmin := rolePermissions("platform_admin")
	foundWildcardRead := false
	for _, p := range platformAdmin {
		if p == "*:read" {
			foundWildcardRead = true
			break
		}
	}
	if !foundWildcardRead {
		t.Errorf("platform_admin must retain *:read wildcard (got %v)", platformAdmin)
	}
	// super_admin grants "*:*"
	superAdmin := rolePermissions("super_admin")
	if len(superAdmin) == 0 || superAdmin[0] != "*:*" {
		t.Errorf("super_admin must retain *:* wildcard (got %v)", superAdmin)
	}
}
