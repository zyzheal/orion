package service

import (
	"context"
	"testing"

	"orion/platform-svc-go/internal/audit/models"
)

// TestAuditCreate_UsesCallerTenantNotRequestBody is a regression test for a
// cross-tenant write on the audit evidence chain.
//
// The handler passes the auth-context tenant to Create *and* hands over the raw
// body. The old code did `if req.TenantID == "" { req.TenantID = tenantID }`,
// so a body carrying tenantId won the write: POST /audit/logs would create the
// row in another tenant's audit chain and be hashed/linked under their
// tenant_id. That poisons the per-tenant evidence chain the whole module exists
// to provide.
func TestAuditCreate_UsesCallerTenantNotRequestBody(t *testing.T) {
	repo := &mockAuditRepo{logs: map[string]*models.AuditLog{}}
	svc := NewService(repo)

	req := models.AuditLogCreateRequest{
		Action:   "login",
		UserID:   "u1",
		TenantID: "attacker-supplied-tenant",
	}

	entry, err := svc.Create(context.Background(), "t1", req)
	if err != nil {
		t.Fatalf("Create failed: %v", err)
	}
	if entry == nil {
		t.Fatalf("Create returned nil entry")
	}
	if entry.TenantID != "t1" {
		t.Errorf("audit log tenant: got %q, want %q (caller)", entry.TenantID, "t1")
	}

	// The row must be stored under the caller tenant's chain prefix. The mock
	// keys rows as "tenantID:id", which is the same shape the real repository
	// gets its tenant from, so a wrong tenant shows up as a missing key here.
	if _, ok := repo.logs[repo.key("t1", entry.ID)]; !ok {
		t.Errorf("log stored under the wrong tenant chain")
	}
	if _, ok := repo.logs[repo.key("attacker-supplied-tenant", entry.ID)]; ok {
		t.Errorf("log was written into the body tenant's chain")
	}
}

// TestAuditCreate_EmptyCallerTenantStaysEmpty pins the other half: an empty
// caller tenant must not be backfilled from the body. Filling it would
// reintroduce the override for the anonymous-request case.
func TestAuditCreate_EmptyCallerTenantStaysEmpty(t *testing.T) {
	repo := &mockAuditRepo{logs: map[string]*models.AuditLog{}}
	svc := NewService(repo)

	entry, err := svc.Create(context.Background(), "", models.AuditLogCreateRequest{
		Action: "login", UserID: "u1", TenantID: "attacker-supplied-tenant",
	})
	if err != nil {
		t.Fatalf("Create failed: %v", err)
	}
	if entry.TenantID != "" {
		t.Errorf("empty caller tenant must not be backfilled from the body, got %q", entry.TenantID)
	}
}
