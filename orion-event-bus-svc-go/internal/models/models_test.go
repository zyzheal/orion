package models

import "testing"

func TestEventSubscriptionFields(t *testing.T) {
	sub := EventSubscription{ID: "s1", TenantID: "t1", EventType: "pipeline.completed", Handler: "webhook"}
	if sub.TenantID != "t1" {
		t.Errorf("expected t1, got %s", sub.TenantID)
	}
	if sub.EventType != "pipeline.completed" {
		t.Errorf("expected pipeline.completed, got %s", sub.EventType)
	}
}

func TestEventLogFields(t *testing.T) {
	log := EventLog{ID: "e1", TenantID: "t1", EventType: "deploy.started", Payload: JSONB{"key": "val"}}
	if log.TenantID != "t1" {
		t.Errorf("expected t1, got %s", log.TenantID)
	}
	if log.Processed != false {
		t.Errorf("expected processed=false by default")
	}
}

func TestPaginatedDefaults(t *testing.T) {
	p := PaginatedRequest{}
	if p.Limit() != 20 {
		t.Errorf("expected 20, got %d", p.Limit())
	}
	if p.Offset() != 0 {
		t.Errorf("expected 0, got %d", p.Offset())
	}
}
