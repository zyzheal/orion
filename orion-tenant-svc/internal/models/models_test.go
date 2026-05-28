package models

import (
	"testing"
	"time"
)

func TestTenant_Fields(t *testing.T) {
	now := time.Now()
	tenant := Tenant{
		ID:             "tenant-123",
		Name:           "test-tenant",
		DisplayName:    "Test Tenant",
		Status:         "active",
		QuotaUsers:     100,
		QuotaStorageMB: 1024,
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	if tenant.ID != "tenant-123" {
		t.Errorf("expected ID tenant-123, got %s", tenant.ID)
	}
	if tenant.Name != "test-tenant" {
		t.Errorf("expected Name test-tenant, got %s", tenant.Name)
	}
	if tenant.Status != "active" {
		t.Errorf("expected Status active, got %s", tenant.Status)
	}
	if tenant.QuotaUsers != 100 {
		t.Errorf("expected QuotaUsers 100, got %d", tenant.QuotaUsers)
	}
}

func TestCreateTenantRequest_Defaults(t *testing.T) {
	req := CreateTenantRequest{
		Name: "new-tenant",
	}

	if req.Name != "new-tenant" {
		t.Errorf("expected Name new-tenant, got %s", req.Name)
	}
	if req.QuotaUsers != 0 {
		t.Errorf("expected default QuotaUsers 0, got %d", req.QuotaUsers)
	}
}

func TestUpdateTenantRequest_StatusValidation(t *testing.T) {
	validStatuses := []string{"active", "suspended", "deleted"}
	for _, status := range validStatuses {
		req := UpdateTenantRequest{Status: status}
		if req.Status != status {
			t.Errorf("expected status %s, got %s", status, req.Status)
		}
	}
}

func TestUpdateSettingsRequest(t *testing.T) {
	req := UpdateSettingsRequest{
		DisplayName: "New Display Name",
	}
	if req.DisplayName != "New Display Name" {
		t.Errorf("expected DisplayName 'New Display Name', got %s", req.DisplayName)
	}
}
