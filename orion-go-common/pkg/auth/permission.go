package auth

import (
	"net/http"
	"sort"
	"strings"

	"orion/go-common/pkg/errors"

	"github.com/gin-gonic/gin"
)

// Permission format: "{resource}:{action}"
// Wildcards: "*:*" (all), "pipeline:*" (all pipeline actions), "*:read" (all read)

// SystemRolePermissions defines permissions for system-level roles (6 roles).
var SystemRolePermissions = map[string][]string{
	// Legacy alias: the frontend still issues role: "admin" (tests/mocks/handlers.ts,
	// AuthInitializer, auth/user api tests) and grants it "*:*". Without this entry
	// such a user renders every menu as unlocked while HasPermission rejects every
	// guarded request with 403 — the exact frontend/backend divergence PERM-7 fixes.
	"admin":         {"*:*"},
	"super_admin":   {"*:*"},
	"platform_admin": {"*:manage", "*:read", "*:write", "*:execute", "*:delete", "*:approve",
		"*:admin"},
	"tenant_admin":   {"*:read", "*:write", "*:manage", "*:admin", "audit_log:read"},
	"security_admin": {"audit_log:read", "config:read", "secrets:read", "user:read", "role:read",
		"project:read", "pipeline:read", "deployment:read", "alert:read",
		"security:manage", "ticket:read", "approval:approve"},
	"finops_admin": {"finops:*", "project:read", "deployment:read", "pipeline:read"},
}

// BusinessRolePermissions defines permissions for business-level roles (7 roles).
var BusinessRolePermissions = map[string][]string{
	"org_admin": {"*:read", "*:write", "*:execute", "*:manage", "*:approve"},
	"tech_lead": {"project:read", "project:write", "pipeline:read", "pipeline:write",
		"pipeline:execute", "pipeline:approve", "deployment:read",
		"deployment:execute", "alert:read", "alert:acknowledge",
		"config:read", "ticket:read", "ticket:write",
		"artifact:read", "knowledge:read", "knowledge:write"},
	"developer": {"project:read", "pipeline:read", "pipeline:write", "pipeline:execute",
		"deployment:read", "alert:read", "config:read",
		"ticket:read", "ticket:write", "artifact:read",
		"knowledge:read"},
	"sre": {"*:read", "deployment:execute", "deployment:approve",
		"environment:*", "alert:*", "config:write",
		"pipeline:read", "pipeline:execute", "iac:*",
		"ticket:read", "ticket:write", "oncall:*"},
	"dba": {"project:read", "pipeline:read", "deployment:read",
		"config:read", "alert:read", "cmdb:read",
		"environment:read", "secrets:read",
		// PERM-3: the dba role defined no dba:* permission at all, so all 34
		// RequirePermission("dba", ...) guards (read/write/execute/approve/delete)
		// rejected DBA users with 403 — only reads slipped through via *:read.
		"dba:*", "datasource:*", "database-devops:*"},
	"viewer": {"project:read", "pipeline:read", "deployment:read",
		"alert:read", "artifact:read", "knowledge:read",
		"ticket:read", "finops:read"},
	"auditor": {"audit_log:*", "*:read", "ticket:read", "approval:read"},
}

// ProjectRolePermissions defines permissions for project-level roles (4 roles).
// These are scoped to a specific project context.
var ProjectRolePermissions = map[string][]string{
	"project_admin": {"project:*", "pipeline:*", "deployment:*",
		"environment:read", "artifact:*", "alert:*",
		"ticket:*", "approval:*", "secrets:*", "oncall:*"},
	"project_lead": {"project:read", "project:write", "pipeline:*",
		"pipeline:approve", "deployment:read",
		"deployment:execute", "artifact:read", "artifact:write",
		"alert:read", "alert:acknowledge", "ticket:*",
		"approval:approve", "secrets:read", "oncall:*"},
	"project_developer": {"project:read", "pipeline:read", "pipeline:write",
		"pipeline:execute", "deployment:read",
		"artifact:read", "alert:read", "ticket:read",
		"ticket:write", "secrets:read"},
	"project_viewer": {"project:read", "pipeline:read", "deployment:read",
		"artifact:read", "alert:read", "ticket:read",
		"knowledge:read"},
}

// ModuleRolePermissions defines permissions for module-level roles (16 roles).
// These are scoped to specific resource types.
var ModuleRolePermissions = map[string][]string{
	// Pipeline module (4 roles)
	"pipeline.admin":   {"pipeline:*"},
	"pipeline.editor":  {"pipeline:read", "pipeline:write", "pipeline:execute"},
	"pipeline.viewer":  {"pipeline:read"},
	"pipeline.approver": {"pipeline:read", "pipeline:approve"},
	// Environment module (3 roles)
	"environment.admin":     {"environment:*"},
	"environment.deployer":  {"environment:read", "environment:execute"},
	"environment.viewer":    {"environment:read"},
	// Config module (3 roles)
	"config.admin":  {"config:*"},
	"config.editor": {"config:read", "config:write"},
	"config.viewer": {"config:read"},
	// Artifact module (3 roles)
	"artifact.admin":     {"artifact:*"},
	"artifact.publisher": {"artifact:read", "artifact:write"},
	"artifact.viewer":    {"artifact:read"},
	// Deployment module (3 roles)
	"deployment.admin":    {"deployment:*"},
	"deployment.approver": {"deployment:read", "deployment:approve"},
	"deployment.viewer":   {"deployment:read"},
}

// DataRolePermissions defines the data-platform specialist roles (PERM-4).
// Every resource name below is the exact string a backend guard passes to
// RequirePermission; cmd/server/permission_guard_audit_test.go fails the build
// if a guard resource ever stops resolving to a role, which is what caught the
// "data-mashing" typo in internal/data-masking.
var DataRolePermissions = map[string][]string{
	"data_admin":    {"data:*", "datasource:*", "database-devops:*", "dba:*",
		"data-catalog:*", "data-quality:*", "data-lineage:*", "data-masking:*",
		"data-classification:*", "data-pipeline:*", "bi-dashboard:*",
		"report-designer:*", "secrets:read"},
	"data_steward":  {"data-catalog:*", "data-classification:*", "data-lineage:*",
		"data-masking:read", "data-masking:write", "data-quality:read",
		"data-quality:write", "data-pipeline:read", "bi-dashboard:*",
		"datasource:read", "database-devops:read", "dba:read",
		"report-designer:read", "report-designer:write"},
	"bi_analyst":    {"bi-dashboard:*", "report-designer:*", "data-catalog:read",
		"data-lineage:read", "data-quality:read", "data-classification:read",
		"data-pipeline:read", "datasource:read", "project:read"},
	"data_engineer": {"data-pipeline:*", "data-quality:*", "data-lineage:*",
		"data-masking:*", "data-classification:*", "data-catalog:read",
		"data-catalog:write", "datasource:read", "datasource:write",
		"database-devops:read", "dba:read", "dba:write", "dba:execute",
		"bi-dashboard:read", "project:read"},
}

// ModuleAdminRolePermissions covers the modules whose guards use the
// non-standard "admin" action. Before this map existed, 67 guard call sites
// (chatops:admin x43, knowledge:admin x10, tracing:update x4, sprint:update x4,
// artifact-version:admin x2, sprint:create, ai:admin, event_bus:admin,
// release:deploy, release:rollback) were reachable by super_admin alone — no role
// held an "*:admin" wildcard and none of the module admin roles covered them.
var ModuleAdminRolePermissions = map[string][]string{
	"chatops.admin":          {"chatops:*"},
	"knowledge.admin":        {"knowledge:*", "pandawiki:*"},
	"artifact-version.admin": {"artifact-version:*", "artifact:*"},
	"ai.admin":               {"ai:*", "ai-security:*", "prompt-security:*"},
	"sprint.admin":           {"sprint:*", "release:*"},
	"tracing.admin":          {"tracing:*", "observability:*"},
	"event_bus.admin":        {"event_bus:*"},
}

// roleInheritance defines child → parent relationships.
// Child roles automatically inherit all permissions from parent roles.
//
// System admin chain: super_admin → platform_admin → tenant_admin
//   (shallow — stops at tenant_admin to avoid wildcard leak to business roles)
//
// Business roles: standalone (no inheritance)
//   Each business role defines its own permissions explicitly.
//   This prevents escalation: tech_lead cannot gain *:delete via inheritance chain.
//
// Project chain: project_admin → project_lead → project_developer → project_viewer
//
// Module roles: standalone (no inheritance)
var roleInheritance = map[string][]string{
	// System admin chain only (platform_admin inherits super_admin's *:*)
	"platform_admin": {"super_admin"},
	"tenant_admin":   {"platform_admin"},
	// org_admin, tech_lead, developer, sre, dba, security_admin, finops_admin,
	// viewer, auditor: all standalone — no inheritance to prevent wildcard escalation
	// Project chain
	"project_lead":      {"project_admin"},
	"project_developer": {"project_lead"},
	"project_viewer":    {"project_developer"},
}

// allRolePermissions is the computed flat map of role → permissions (with inheritance).
var allRolePermissions map[string]map[string]bool

// allRoleMaps is the ordered list of all role permission maps to merge.
// Order matters: later maps can add to existing roles but won't overwrite.
var allRoleMaps = []map[string][]string{
	SystemRolePermissions,
	BusinessRolePermissions,
	ProjectRolePermissions,
	ModuleRolePermissions,
	DataRolePermissions,
	ModuleAdminRolePermissions,
}

func init() {
	allRolePermissions = make(map[string]map[string]bool)

	// Merge all role permission maps
	for _, roleMap := range allRoleMaps {
		for role, perms := range roleMap {
			if _, ok := allRolePermissions[role]; !ok {
				allRolePermissions[role] = make(map[string]bool)
			}
			for _, p := range perms {
				// Normalise the stored key as well, so a role map written as
				// "audit_log:read" matches a guard that says "audit-log","read".
				allRolePermissions[role][normPerm(p)] = true
			}
		}
	}

	// Apply inheritance (child gets all parent permissions)
	for child, parents := range roleInheritance {
		if _, ok := allRolePermissions[child]; !ok {
			allRolePermissions[child] = make(map[string]bool)
		}
		for _, parent := range parents {
			if parentPerms, ok := allRolePermissions[parent]; ok {
				for p := range parentPerms {
					allRolePermissions[child][p] = true
				}
			}
		}
	}
}

// GetAllRoles returns a list of all defined role IDs.
func GetAllRoles() []string {
	roles := make([]string, 0, len(allRolePermissions))
	for role := range allRolePermissions {
		roles = append(roles, role)
	}
	return roles
}

// RoleCount returns the total number of defined roles.
func RoleCount() int {
	return len(allRolePermissions)
}

// GetRolePermissionsMap returns the effective role → permissions table as strings,
// i.e. exactly what HasPermission enforces (inheritance applied, "_" already folded
// to "-"). The frontend uses this instead of hardcoding its own copy, so a guard
// added in one PR stops needing a second PR to reach the menu locks.
//
// json.Marshal sorts map keys, so role order in the payload is stable; the per-role
// lists are sorted only so diffs and test assertions are readable.
func GetRolePermissionsMap() map[string][]string {
	out := make(map[string][]string, len(allRolePermissions))
	for role, perms := range allRolePermissions {
		list := make([]string, 0, len(perms))
		for p := range perms {
			list = append(list, p)
		}
		sort.Strings(list)
		out[role] = list
	}
	return out
}

// normResource maps a resource name to its canonical form. Backend guards use
// both spellings of the same module — the audit found audit-log/audit_log,
// middleware-ops/middleware_ops (196 vs 289 call sites), oci-registry/oci_registry
// and report-designer/report_designer. A role granted "middleware-ops:*" would
// otherwise 403 on the 289 middleware_ops guards. Normalising at the boundary
// makes the two spellings equivalent.
func normResource(resource string) string {
	return strings.ReplaceAll(resource, "_", "-")
}

// normPerm normalises a whole "resource:action" string for storage and lookup.
func normPerm(perm string) string {
	parts := strings.SplitN(perm, ":", 2)
	if len(parts) == 2 {
		return normResource(parts[0]) + ":" + normResource(parts[1])
	}
	return normResource(perm)
}

// HasPermission checks if a role has the given resource:action permission.
func HasPermission(role, resource, action string) bool {
	perms, ok := allRolePermissions[role]
	if !ok {
		return false
	}
	resource = normResource(resource)

	// Check exact match
	if perms[resource+":"+action] {
		return true
	}
	// Check resource wildcard: "pipeline:*"
	if perms[resource+":*"] {
		return true
	}
	// Check action wildcard: "*:read"
	if perms["*:"+action] {
		return true
	}
	// Check full wildcard: "*:*"
	if perms["*:*"] {
		return true
	}

	return false
}

// RequirePermission returns middleware that requires the user's role to have the specified permission.
// Usage: router.Use(auth.RequirePermission("pipeline", "write"))
func RequirePermission(resource, action string) gin.HandlerFunc {
	return func(c *gin.Context) {
		role := GetRole(c)
		if role == "" {
			c.AbortWithStatusJSON(http.StatusForbidden, errors.NewErrorEnvelope(c, errors.ErrForbidden, "no role assigned", nil))
			return
		}
		if !HasPermission(role, resource, action) {
			c.AbortWithStatusJSON(http.StatusForbidden, errors.NewErrorEnvelope(c, errors.ErrForbidden, "insufficient permissions", nil))
			return
		}
		c.Next()
	}
}

// RequireAnyPermission returns middleware that requires at least one of the given permissions.
// Usage: router.Use(auth.RequireAnyPermission("pipeline:write", "pipeline:execute"))
func RequireAnyPermission(perms ...string) gin.HandlerFunc {
	type resAct struct{ resource, action string }
	parsed := make([]resAct, 0, len(perms))
	for _, p := range perms {
		parts := strings.SplitN(p, ":", 2)
		if len(parts) == 2 {
			parsed = append(parsed, resAct{parts[0], parts[1]})
		}
	}
	return func(c *gin.Context) {
		role := GetRole(c)
		if role == "" {
			c.AbortWithStatusJSON(http.StatusForbidden, errors.NewErrorEnvelope(c, errors.ErrForbidden, "no role assigned", nil))
			return
		}
		for _, pa := range parsed {
			if HasPermission(role, pa.resource, pa.action) {
				c.Next()
				return
			}
		}
		c.AbortWithStatusJSON(http.StatusForbidden, errors.NewErrorEnvelope(c, errors.ErrForbidden, "insufficient permissions", nil))
	}
}
