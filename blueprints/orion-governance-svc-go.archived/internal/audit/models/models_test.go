package models

import "testing"

func TestAuditLogFields(t *testing.T) {
	a := AuditLog{ID: "a1", TenantID: "t1", Action: "create", ResourceType: "pipeline", ActorID: "u1"}
	if a.Action != "create" { t.Errorf("expected create, got %s", a.Action) }
}

func TestPaginatedDefaults(t *testing.T) {
	p := PaginatedRequest{}
	if p.Limit() != 20 { t.Errorf("expected 20, got %d", p.Limit()) }
}
