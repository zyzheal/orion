package models

import (
	"testing"
	"time"
)

func TestCIItem_Fields(t *testing.T) {
	now := time.Now()
	attrs := JSONB{"key": "value"}
	ci := CIItem{
		ID:         "ci-1",
		TenantID:   "tenant-1",
		Name:       "Test CI",
		CIType:     "server",
		Status:     "active",
		Owner:      "user-1",
		Attributes: attrs,
		CreatedAt:  now,
		UpdatedAt:  now,
	}

	if ci.ID != "ci-1" {
		t.Errorf("expected ID 'ci-1', got '%s'", ci.ID)
	}
	if ci.TenantID != "tenant-1" {
		t.Errorf("expected TenantID 'tenant-1', got '%s'", ci.TenantID)
	}
	if ci.Name != "Test CI" {
		t.Errorf("expected Name 'Test CI', got '%s'", ci.Name)
	}
	if ci.CIType != "server" {
		t.Errorf("expected CIType 'server', got '%s'", ci.CIType)
	}
	if ci.Status != "active" {
		t.Errorf("expected Status 'active', got '%s'", ci.Status)
	}
	if ci.Owner != "user-1" {
		t.Errorf("expected Owner 'user-1', got '%s'", ci.Owner)
	}
	if ci.Attributes["key"] != "value" {
		t.Errorf("expected Attributes['key'] = 'value', got '%v'", ci.Attributes["key"])
	}
}

func TestCIRelation_Fields(t *testing.T) {
	relation := CIRelation{
		ID:           "rel-1",
		TenantID:     "tenant-1",
		SourceCIID:   "ci-1",
		TargetCIID:   "ci-2",
		RelationType: "depends_on",
	}

	if relation.ID != "rel-1" {
		t.Errorf("expected ID 'rel-1', got '%s'", relation.ID)
	}
	if relation.TenantID != "tenant-1" {
		t.Errorf("expected TenantID 'tenant-1', got '%s'", relation.TenantID)
	}
	if relation.SourceCIID != "ci-1" {
		t.Errorf("expected SourceCIID 'ci-1', got '%s'", relation.SourceCIID)
	}
	if relation.TargetCIID != "ci-2" {
		t.Errorf("expected TargetCIID 'ci-2', got '%s'", relation.TargetCIID)
	}
	if relation.RelationType != "depends_on" {
		t.Errorf("expected RelationType 'depends_on', got '%s'", relation.RelationType)
	}
}

func TestCIAuditLog_Fields(t *testing.T) {
	now := time.Now()
	oldVal := JSONB{"status": "active"}
	newVal := JSONB{"status": "inactive"}
	log := CIAuditLog{
		ID:        "log-1",
		TenantID:  "tenant-1",
		CIID:      "ci-1",
		Action:    "update",
		Actor:     "user-1",
		OldValue:  oldVal,
		NewValue:  newVal,
		CreatedAt: now,
	}

	if log.ID != "log-1" {
		t.Errorf("expected ID 'log-1', got '%s'", log.ID)
	}
	if log.TenantID != "tenant-1" {
		t.Errorf("expected TenantID 'tenant-1', got '%s'", log.TenantID)
	}
	if log.CIID != "ci-1" {
		t.Errorf("expected CIID 'ci-1', got '%s'", log.CIID)
	}
	if log.Action != "update" {
		t.Errorf("expected Action 'update', got '%s'", log.Action)
	}
	if log.Actor != "user-1" {
		t.Errorf("expected Actor 'user-1', got '%s'", log.Actor)
	}
	if log.OldValue["status"] != "active" {
		t.Errorf("expected OldValue['status'] = 'active', got '%v'", log.OldValue["status"])
	}
	if log.NewValue["status"] != "inactive" {
		t.Errorf("expected NewValue['status'] = 'inactive', got '%v'", log.NewValue["status"])
	}
}

func TestCreateCIRequest_Fields(t *testing.T) {
	attrs := JSONB{"key": "value"}
	req := CreateCIRequest{
		Name:       "Test CI",
		CIType:     "server",
		Status:     "active",
		Owner:      "user-1",
		Attributes: attrs,
	}

	if req.Name != "Test CI" {
		t.Errorf("expected Name 'Test CI', got '%s'", req.Name)
	}
	if req.CIType != "server" {
		t.Errorf("expected CIType 'server', got '%s'", req.CIType)
	}
	if req.Status != "active" {
		t.Errorf("expected Status 'active', got '%s'", req.Status)
	}
	if req.Owner != "user-1" {
		t.Errorf("expected Owner 'user-1', got '%s'", req.Owner)
	}
	if req.Attributes["key"] != "value" {
		t.Errorf("expected Attributes['key'] = 'value', got '%v'", req.Attributes["key"])
	}
}

func TestJSONB_Value(t *testing.T) {
	j := JSONB{"key": "value"}
	val, err := j.Value()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if val == nil {
		t.Error("expected non-nil value")
	}

	var nilJ JSONB
	val, err = nilJ.Value()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if val != nil {
		t.Error("expected nil value for nil JSONB")
	}
}

func TestJSONB_Scan(t *testing.T) {
	var j JSONB
	err := j.Scan([]byte(`{"key":"value"}`))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if j["key"] != "value" {
		t.Errorf("expected key='value', got '%v'", j["key"])
	}

	var j2 JSONB
	err = j2.Scan(nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if j2 == nil {
		t.Error("expected non-nil JSONB after scanning nil")
	}
}

func TestTopologyNode_Fields(t *testing.T) {
	node := TopologyNode{
		CIItem: CIItem{
			ID:   "ci-1",
			Name: "Test CI",
		},
		Relations: []TopologyEdge{
			{ID: "edge-1", TargetCIID: "ci-2", RelationType: "depends_on"},
		},
	}

	if node.ID != "ci-1" {
		t.Errorf("expected ID 'ci-1', got '%s'", node.ID)
	}
	if len(node.Relations) != 1 {
		t.Errorf("expected 1 relation, got %d", len(node.Relations))
	}
	if node.Relations[0].TargetCIID != "ci-2" {
		t.Errorf("expected TargetCIID 'ci-2', got '%s'", node.Relations[0].TargetCIID)
	}
}
