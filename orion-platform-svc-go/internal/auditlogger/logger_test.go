package auditlogger

import (
	"context"
	"testing"
)

func TestNoopLogger_Log(t *testing.T) {
	l := NoopLogger{}
	err := l.Log(context.Background(), AuditEntry{
		Action:       "create",
		TenantID:     "t1",
		ResourceType: "test",
		ResourceID:   "r1",
	})
	if err != nil {
		t.Errorf("expected nil error, got %v", err)
	}
}

func TestAuditEntry_Fields(t *testing.T) {
	e := AuditEntry{
		Action:       "update",
		TenantID:     "t1",
		UserID:       "u1",
		ResourceType: "alert.sla",
		ResourceID:   "sla1",
		Details:      map[string]any{"field": "name", "before": "old", "after": "new"},
	}
	if e.Action != "update" {
		t.Errorf("expected action 'update', got %s", e.Action)
	}
	if e.ResourceType != "alert.sla" {
		t.Errorf("expected resource type 'alert.sla', got %s", e.ResourceType)
	}
	if e.Details["field"] != "name" {
		t.Errorf("expected details.field 'name', got %v", e.Details["field"])
	}
}
