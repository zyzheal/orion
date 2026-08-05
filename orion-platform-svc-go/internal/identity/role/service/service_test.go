package service

import (
	"context"
	"testing"

	"orion/platform-svc-go/internal/identity/role/models"
)

func TestNewRoleServiceNotNil(t *testing.T) {
	svc := NewRoleService()
	if svc == nil {
		t.Fatal("NewRoleService returned nil")
	}
}

func TestRoleServiceCreateRole(t *testing.T) {
	svc := NewRoleService()
	_, _ = svc.CreateRole(context.Background(), "t1", &models.CreateRoleRequest{Name: "test"})
}

func TestRoleServiceGetRole(t *testing.T) {
	svc := NewRoleService()
	_, _ = svc.GetRole(context.Background(), "t1", "r-1")
}

func TestRoleServiceListRoles(t *testing.T) {
	svc := NewRoleService()
	_, _ = svc.ListRoles(context.Background(), "t1")
}

func TestRoleServiceUpdateRole(t *testing.T) {
	svc := NewRoleService()
	_, _ = svc.UpdateRole(context.Background(), "t1", "r-1", &models.UpdateRoleRequest{Name: "updated"})
}

func TestRoleServiceDeleteRole(t *testing.T) {
	svc := NewRoleService()
	_ = svc.DeleteRole(context.Background(), "t1", "r-1")
}
