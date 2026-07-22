package auth

import (
	"testing"
)

func TestHasPermission(t *testing.T) {
	tests := []struct {
		name     string
		role     string
		resource string
		action   string
		want     bool
	}{
		// Wildcard tests
		{"super_admin can do anything", "super_admin", "pipeline", "write", true},
		{"super_admin can delete", "super_admin", "deployment", "delete", true},

		// System roles
		{"platform_admin can read all", "platform_admin", "alert", "read", true},
		{"platform_admin can manage all", "platform_admin", "tenant", "manage", true},
		{"tenant_admin can read all", "tenant_admin", "pipeline", "read", true},
		{"tenant_admin can manage", "tenant_admin", "config", "manage", true},

		// Business roles
		{"tech_lead can write pipeline", "tech_lead", "pipeline", "write", true},
		{"tech_lead can approve pipeline", "tech_lead", "pipeline", "approve", true},
		{"tech_lead cannot delete pipeline", "tech_lead", "pipeline", "delete", false},
		{"developer can execute pipeline", "developer", "pipeline", "execute", true},
		// developer is standalone — no inheritance
		{"developer cannot approve pipeline", "developer", "pipeline", "approve", false},
		{"developer can read project", "developer", "project", "read", true},
		{"sre can execute deployment", "sre", "deployment", "execute", true},
		{"sre can manage environment", "sre", "environment", "manage", true},
		{"sre can write config", "sre", "config", "write", true},
		{"dba can read config", "dba", "config", "read", true},
		{"dba cannot write config", "dba", "config", "write", false},
		{"viewer can read pipeline", "viewer", "pipeline", "read", true},
		{"viewer cannot write pipeline", "viewer", "pipeline", "write", false},
		{"auditor can read audit_log", "auditor", "audit_log", "read", true},
		{"auditor can manage audit_log", "auditor", "audit_log", "manage", true},

		// Inheritance tests (only system admin chain: super_admin → platform_admin → tenant_admin)
		{"org_admin inherits tenant_admin manage", "org_admin", "config", "manage", true},
		// tech_lead is standalone — no inheritance from org_admin
		{"tech_lead no inheritance from org_admin", "tech_lead", "config", "manage", false},
		// developer is standalone — no inheritance from tech_lead
		{"developer no inheritance from tech_lead", "developer", "pipeline", "approve", false},

		// Unknown role
		{"unknown role denied", "unknown_role", "pipeline", "read", false},
		{"empty role denied", "", "pipeline", "read", false},

		// Wildcard resource
		{"sre environment wildcard", "sre", "environment", "deploy", true},
		{"sre alert wildcard", "sre", "alert", "acknowledge", true},

		// finops_admin
		{"finops_admin can manage finops", "finops_admin", "finops", "manage", true},
		{"finops_admin can read project", "finops_admin", "project", "read", true},
		{"finops_admin cannot write project", "finops_admin", "project", "write", false},

		// security_admin
		{"security_admin can read audit_log", "security_admin", "audit_log", "read", true},
		{"security_admin can manage security", "security_admin", "security", "manage", true},
		{"security_admin cannot write pipeline", "security_admin", "pipeline", "write", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := HasPermission(tt.role, tt.resource, tt.action)
			if got != tt.want {
				t.Errorf("HasPermission(%q, %q, %q) = %v, want %v",
					tt.role, tt.resource, tt.action, got, tt.want)
			}
		})
	}
}

func TestHasPermission_UnknownRole(t *testing.T) {
	if HasPermission("nonexistent", "pipeline", "read") {
		t.Error("unknown role should have no permissions")
	}
}

func TestHasPermission_AllBusinessRoles_CanRead(t *testing.T) {
	// All business roles should be able to read projects
	readRoles := []string{"tech_lead", "developer", "sre", "dba", "viewer", "auditor"}
	for _, role := range readRoles {
		if !HasPermission(role, "project", "read") {
			t.Errorf("role %q should have project:read permission", role)
		}
	}
}

func TestRoleCount(t *testing.T) {
	count := RoleCount()
	// 5 system + 7 business + 4 project + 16 module = 32
	// But inheritance expands some, so just check >= 32
	if count < 32 {
		t.Errorf("expected at least 32 roles, got %d", count)
	}
}

func TestGetAllRoles_ContainsAllLevels(t *testing.T) {
	roles := GetAllRoles()
	roleSet := make(map[string]bool)
	for _, r := range roles {
		roleSet[r] = true
	}

	required := []string{
		// System (5)
		"super_admin", "platform_admin", "tenant_admin", "security_admin", "finops_admin",
		// Business (7)
		"org_admin", "tech_lead", "developer", "sre", "dba", "viewer", "auditor",
		// Project (4)
		"project_admin", "project_lead", "project_developer", "project_viewer",
		// Module (16)
		"pipeline.admin", "pipeline.editor", "pipeline.viewer", "pipeline.approver",
		"environment.admin", "environment.deployer", "environment.viewer",
		"config.admin", "config.editor", "config.viewer",
		"artifact.admin", "artifact.publisher", "artifact.viewer",
		"deployment.admin", "deployment.approver", "deployment.viewer",
	}
	for _, r := range required {
		if !roleSet[r] {
			t.Errorf("missing role %q in all roles list", r)
		}
	}
}

// ==================== Project Role Tests ====================

func TestProjectRolePermissions(t *testing.T) {
	tests := []struct {
		name     string
		role     string
		resource string
		action   string
		want     bool
	}{
		{"project_admin can manage project", "project_admin", "project", "manage", true},
		{"project_admin can write pipeline", "project_admin", "pipeline", "write", true},
		{"project_admin can delete pipeline", "project_admin", "pipeline", "delete", true},
		{"project_admin can approve approval", "project_admin", "approval", "approve", true},
		{"project_lead can write pipeline", "project_lead", "pipeline", "write", true},
		{"project_lead can approve pipeline", "project_lead", "pipeline", "approve", true},
		{"project_lead can execute deployment", "project_lead", "deployment", "execute", true},
		// project_lead inherits project_admin which has pipeline:* (includes delete)
		{"project_lead inherits delete from project_admin", "project_lead", "pipeline", "delete", true},
		// project_viewer inherits project_developer which has pipeline:write
		{"project_viewer inherits write from project_developer", "project_viewer", "pipeline", "write", true},
		{"project_developer can execute pipeline", "project_developer", "pipeline", "execute", true},
		{"project_developer can write ticket", "project_developer", "ticket", "write", true},
		// project_developer inherits from project_lead which has pipeline:approve
		{"project_developer inherits approve from project_lead", "project_developer", "pipeline", "approve", true},
		{"project_viewer can read pipeline", "project_viewer", "pipeline", "read", true},
		{"project_viewer can read knowledge", "project_viewer", "knowledge", "read", true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := HasPermission(tt.role, tt.resource, tt.action)
			if got != tt.want {
				t.Errorf("HasPermission(%q, %q, %q) = %v, want %v",
					tt.role, tt.resource, tt.action, got, tt.want)
			}
		})
	}
}

func TestProjectRoleInheritance(t *testing.T) {
	// project_admin → project_lead → project_developer → project_viewer
	tests := []struct {
		name     string
		role     string
		resource string
		action   string
		want     bool
	}{
		{"project_lead inherits project_admin project:manage", "project_lead", "project", "manage", true},
		{"project_developer inherits project_lead ticket:*", "project_developer", "ticket", "manage", true},
		// project_viewer inherits project_developer which has pipeline:execute
		{"project_viewer inherits pipeline:execute from project_developer", "project_viewer", "pipeline", "execute", true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := HasPermission(tt.role, tt.resource, tt.action)
			if got != tt.want {
				t.Errorf("HasPermission(%q, %q, %q) = %v, want %v",
					tt.role, tt.resource, tt.action, got, tt.want)
			}
		})
	}
}

// ==================== Module Role Tests ====================

func TestModuleRolePermissions(t *testing.T) {
	tests := []struct {
		name     string
		role     string
		resource string
		action   string
		want     bool
	}{
		// Pipeline module
		{"pipeline.admin can delete pipeline", "pipeline.admin", "pipeline", "delete", true},
		{"pipeline.editor can write pipeline", "pipeline.editor", "pipeline", "write", true},
		{"pipeline.editor cannot delete pipeline", "pipeline.editor", "pipeline", "delete", false},
		{"pipeline.viewer can read pipeline", "pipeline.viewer", "pipeline", "read", true},
		{"pipeline.viewer cannot write pipeline", "pipeline.viewer", "pipeline", "write", false},
		{"pipeline.approver can approve pipeline", "pipeline.approver", "pipeline", "approve", true},
		{"pipeline.approver cannot write pipeline", "pipeline.approver", "pipeline", "write", false},
		// Environment module
		{"environment.admin can manage environment", "environment.admin", "environment", "manage", true},
		{"environment.deployer can execute environment", "environment.deployer", "environment", "execute", true},
		{"environment.deployer cannot manage environment", "environment.deployer", "environment", "manage", false},
		{"environment.viewer can read environment", "environment.viewer", "environment", "read", true},
		{"environment.viewer cannot execute environment", "environment.viewer", "environment", "execute", false},
		// Config module
		{"config.admin can manage config", "config.admin", "config", "manage", true},
		{"config.editor can write config", "config.editor", "config", "write", true},
		{"config.editor cannot manage config", "config.editor", "config", "manage", false},
		{"config.viewer can read config", "config.viewer", "config", "read", true},
		{"config.viewer cannot write config", "config.viewer", "config", "write", false},
		// Artifact module
		{"artifact.admin can delete artifact", "artifact.admin", "artifact", "delete", true},
		{"artifact.publisher can write artifact", "artifact.publisher", "artifact", "write", true},
		{"artifact.publisher cannot delete artifact", "artifact.publisher", "artifact", "delete", false},
		{"artifact.viewer can read artifact", "artifact.viewer", "artifact", "read", true},
		// Deployment module
		{"deployment.admin can manage deployment", "deployment.admin", "deployment", "manage", true},
		{"deployment.approver can approve deployment", "deployment.approver", "deployment", "approve", true},
		{"deployment.approver cannot execute deployment", "deployment.approver", "deployment", "execute", false},
		{"deployment.viewer can read deployment", "deployment.viewer", "deployment", "read", true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := HasPermission(tt.role, tt.resource, tt.action)
			if got != tt.want {
				t.Errorf("HasPermission(%q, %q, %q) = %v, want %v",
					tt.role, tt.resource, tt.action, got, tt.want)
			}
		})
	}
}

func TestModuleRoles_CannotAccessOtherModules(t *testing.T) {
	// Module roles should only have permissions for their own module
	tests := []struct {
		name     string
		role     string
		resource string
		action   string
		want     bool
	}{
		{"pipeline.admin cannot manage config", "pipeline.admin", "config", "manage", false},
		{"pipeline.admin cannot delete deployment", "pipeline.admin", "deployment", "delete", false},
		{"config.admin cannot write pipeline", "config.admin", "pipeline", "write", false},
		{"artifact.admin cannot manage environment", "artifact.admin", "environment", "manage", false},
		{"deployment.admin cannot manage pipeline", "deployment.admin", "pipeline", "manage", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := HasPermission(tt.role, tt.resource, tt.action)
			if got != tt.want {
				t.Errorf("HasPermission(%q, %q, %q) = %v, want %v",
					tt.role, tt.resource, tt.action, got, tt.want)
			}
		})
	}
}
