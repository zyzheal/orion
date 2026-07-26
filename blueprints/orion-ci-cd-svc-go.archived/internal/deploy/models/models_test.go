package models

import (
	"testing"
	"time"
)

func TestDeployment_Fields(t *testing.T) {
	now := time.Now()
	dep := Deployment{
		ID:          "test-id",
		TenantID:    "tenant-1",
		Environment: "production",
		ServiceName: "user-svc",
		Version:     "v1.0.0",
		ImageTag:    "latest",
		Status:      "pending",
		DeployedBy:  "user-1",
		RollbackTo:  strPtr("v0.9.0"),
		DeployedAt:  &now,
		CreatedAt:   now,
	}

	if dep.ID != "test-id" {
		t.Errorf("expected ID 'test-id', got '%s'", dep.ID)
	}
	if dep.TenantID != "tenant-1" {
		t.Errorf("expected TenantID 'tenant-1', got '%s'", dep.TenantID)
	}
	if dep.Environment != "production" {
		t.Errorf("expected Environment 'production', got '%s'", dep.Environment)
	}
	if dep.ServiceName != "user-svc" {
		t.Errorf("expected ServiceName 'user-svc', got '%s'", dep.ServiceName)
	}
	if dep.Version != "v1.0.0" {
		t.Errorf("expected Version 'v1.0.0', got '%s'", dep.Version)
	}
	if dep.ImageTag != "latest" {
		t.Errorf("expected ImageTag 'latest', got '%s'", dep.ImageTag)
	}
	if dep.Status != "pending" {
		t.Errorf("expected Status 'pending', got '%s'", dep.Status)
	}
	if dep.DeployedBy != "user-1" {
		t.Errorf("expected DeployedBy 'user-1', got '%s'", dep.DeployedBy)
	}
	if *dep.RollbackTo != "v0.9.0" {
		t.Errorf("expected RollbackTo 'v0.9.0', got '%s'", *dep.RollbackTo)
	}
}

func TestPaginatedRequest_Defaults(t *testing.T) {
	p := PaginatedRequest{}

	offset := p.Offset()
	if offset != 0 {
		t.Errorf("expected offset 0, got %d", offset)
	}

	limit := p.Limit()
	if limit != 20 {
		t.Errorf("expected limit 20, got %d", limit)
	}
}

func TestPaginatedRequest_Values(t *testing.T) {
	p := PaginatedRequest{Page: 2, PageSize: 50}

	offset := p.Offset()
	if offset != 50 {
		t.Errorf("expected offset 50, got %d", offset)
	}

	limit := p.Limit()
	if limit != 50 {
		t.Errorf("expected limit 50, got %d", limit)
	}
}

func TestPaginatedRequest_MaxPageSize(t *testing.T) {
	p := PaginatedRequest{Page: 1, PageSize: 200}

	limit := p.Limit()
	if limit != 100 {
		t.Errorf("expected limit 100 (max), got %d", limit)
	}
}

func strPtr(s string) *string {
	return &s
}
