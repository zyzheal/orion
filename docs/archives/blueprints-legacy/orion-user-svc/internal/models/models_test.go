package models

import (
	"testing"
	"time"
)

func TestUser_Fields(t *testing.T) {
	now := time.Now()
	user := User{
		ID:          "user-123",
		TenantID:    "tenant-abc",
		Email:       "test@example.com",
		DisplayName: "Test User",
		Role:        "admin",
		Status:      "active",
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	if user.ID != "user-123" {
		t.Errorf("expected ID user-123, got %s", user.ID)
	}
	if user.TenantID != "tenant-abc" {
		t.Errorf("expected TenantID tenant-abc, got %s", user.TenantID)
	}
	if user.Email != "test@example.com" {
		t.Errorf("expected Email test@example.com, got %s", user.Email)
	}
	if user.Role != "admin" {
		t.Errorf("expected Role admin, got %s", user.Role)
	}
}

func TestRole_Fields(t *testing.T) {
	role := Role{
		ID:          "role-1",
		TenantID:    "tenant-abc",
		Name:        "admin",
		Description: "Administrator",
	}

	if role.Name != "admin" {
		t.Errorf("expected Name admin, got %s", role.Name)
	}
	if role.TenantID != "tenant-abc" {
		t.Errorf("expected TenantID tenant-abc, got %s", role.TenantID)
	}
}

func TestPermission_Fields(t *testing.T) {
	perm := Permission{
		ID:          "perm-1",
		Resource:    "pipeline",
		Action:      "create",
		Description: "Create pipelines",
	}

	if perm.Resource != "pipeline" {
		t.Errorf("expected Resource pipeline, got %s", perm.Resource)
	}
	if perm.Action != "create" {
		t.Errorf("expected Action create, got %s", perm.Action)
	}
}

func TestCreateRoleRequest(t *testing.T) {
	req := CreateRoleRequest{
		Name:        "developer",
		Description: "Developer role",
	}

	if req.Name != "developer" {
		t.Errorf("expected Name developer, got %s", req.Name)
	}
}

func TestCheckPermissionRequest(t *testing.T) {
	req := CheckPermissionRequest{
		UserID:   "user-123",
		Resource: "pipeline",
		Action:   "create",
	}

	if req.UserID != "user-123" {
		t.Errorf("expected UserID user-123, got %s", req.UserID)
	}
	if req.Resource != "pipeline" {
		t.Errorf("expected Resource pipeline, got %s", req.Resource)
	}
}

func TestCheckPermissionResponse(t *testing.T) {
	resp := CheckPermissionResponse{
		UserID:        "user-123",
		Resource:      "pipeline",
		Action:        "create",
		HasPermission: true,
	}

	if !resp.HasPermission {
		t.Error("expected HasPermission true")
	}
}

func TestUserRole_Fields(t *testing.T) {
	ur := UserRole{
		ID:     1,
		UserID: "user-123",
		RoleID: "role-1",
	}

	if ur.UserID != "user-123" {
		t.Errorf("expected UserID user-123, got %s", ur.UserID)
	}
	if ur.RoleID != "role-1" {
		t.Errorf("expected RoleID role-1, got %s", ur.RoleID)
	}
}

func TestRolePermission_Fields(t *testing.T) {
	rp := RolePermission{
		ID:           1,
		RoleID:       "role-1",
		PermissionID: "perm-1",
	}

	if rp.RoleID != "role-1" {
		t.Errorf("expected RoleID role-1, got %s", rp.RoleID)
	}
	if rp.PermissionID != "perm-1" {
		t.Errorf("expected PermissionID perm-1, got %s", rp.PermissionID)
	}
}
