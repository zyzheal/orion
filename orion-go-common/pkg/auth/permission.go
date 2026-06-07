package auth

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// Permission format: "{resource}:{action}"
// Wildcards: "*:*" (all), "pipeline:*" (all pipeline actions), "*:read" (all read)

// SystemRolePermissions defines permissions for system-level roles (5 roles).
var SystemRolePermissions = map[string][]string{
	"super_admin":    {"*:*"},
	"platform_admin": {"*:manage", "*:read", "*:write", "*:execute", "*:delete", "*:approve"},
	"tenant_admin":   {"*:read", "*:write", "*:manage", "audit_log:read"},
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
		"environment:read", "secrets:read"},
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
				allRolePermissions[role][p] = true
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

// HasPermission checks if a role has the given resource:action permission.
func HasPermission(role, resource, action string) bool {
	perms, ok := allRolePermissions[role]
	if !ok {
		return false
	}

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
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"code": 403, "message": "no role assigned",
			})
			return
		}
		if !HasPermission(role, resource, action) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"code":    403,
				"message": "insufficient permissions",
				"detail":  resource + ":" + action,
			})
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
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"code": 403, "message": "no role assigned",
			})
			return
		}
		for _, pa := range parsed {
			if HasPermission(role, pa.resource, pa.action) {
				c.Next()
				return
			}
		}
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
			"code": 403, "message": "insufficient permissions",
		})
	}
}
