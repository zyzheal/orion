package schema

import (
	"testing"
)

func TestAllSchemas(t *testing.T) {
	schemas := AllSchemas()
	if len(schemas) != 11 {
		t.Fatalf("expected 11 schemas, got %d", len(schemas))
	}
	for _, s := range schemas {
		if s.NodeType == "" {
			t.Error("schema has empty NodeType")
		}
		if s.Label == "" {
			t.Errorf("schema %s has empty Label", s.NodeType)
		}
	}
}

func TestIsValidNodeType(t *testing.T) {
	valid := []NodeType{
		NodeTypeStart, NodeTypeEnd, NodeTypeAction,
		NodeTypeCondition, NodeTypeParallel, NodeTypeLoop,
		NodeTypeDelay, NodeTypeNotify, NodeTypeHttp,
		NodeTypeWebhook, NodeTypeError,
	}
	for _, v := range valid {
		if !IsValidNodeType(v) {
			t.Errorf("expected %s to be valid", v)
		}
	}
	if IsValidNodeType("bogus") {
		t.Error("expected bogus to be invalid")
	}
}

func TestSchemaMap(t *testing.T) {
	m := SchemaMap()
	for nt := range validNodeTypes {
		s, ok := m[nt]
		if !ok {
			t.Errorf("missing schema for %s", nt)
		}
		if s.NodeType != nt {
			t.Errorf("schema for %s has wrong NodeType", nt)
		}
	}
}

func TestValidFlow(t *testing.T) {
	flow := &Flow{
		Nodes: []FlowNode{
			{ID: "s1", Type: NodeTypeStart, Name: "Start", Properties: map[string]interface{}{"name": "Start"}},
			{ID: "a1", Type: NodeTypeAction, Name: "Action", Properties: map[string]interface{}{
				"name": "Action", "action_type": "script", "payload": "echo hi",
			}},
			{ID: "e1", Type: NodeTypeEnd, Name: "End", Properties: map[string]interface{}{"name": "End"}},
		},
		Edges: []FlowEdge{
			{ID: "e_1", SourceID: "s1", SourcePort: "out", TargetID: "a1", TargetPort: "in"},
			{ID: "e_2", SourceID: "a1", SourcePort: "out", TargetID: "e1", TargetPort: "in"},
		},
	}
	v := NewValidator()
	result := v.Validate(flow)
	if !result.Valid {
		for _, e := range result.Errors {
			t.Errorf("unexpected error: %s", e.Message)
		}
	}
}

func TestCycleDetection(t *testing.T) {
	flow := &Flow{
		Nodes: []FlowNode{
			{ID: "s1", Type: NodeTypeStart, Name: "Start", Properties: map[string]interface{}{"name": "Start"}},
			{ID: "a1", Type: NodeTypeAction, Name: "A", Properties: map[string]interface{}{
				"name": "A", "action_type": "script", "payload": "x",
			}},
			{ID: "a2", Type: NodeTypeAction, Name: "B", Properties: map[string]interface{}{
				"name": "B", "action_type": "script", "payload": "y",
			}},
		},
		Edges: []FlowEdge{
			{ID: "e_1", SourceID: "s1", SourcePort: "out", TargetID: "a1", TargetPort: "in"},
			{ID: "e_2", SourceID: "a1", SourcePort: "out", TargetID: "a2", TargetPort: "in"},
			{ID: "e_3", SourceID: "a2", SourcePort: "out", TargetID: "s1", TargetPort: "out"},
		},
	}
	v := NewValidator()
	result := v.Validate(flow)
	if result.Valid {
		t.Error("expected cycle detection to fail")
	}
}

func TestMissingStartNode(t *testing.T) {
	flow := &Flow{
		Nodes: []FlowNode{
			{ID: "a1", Type: NodeTypeAction, Name: "A", Properties: map[string]interface{}{
				"name": "A", "action_type": "script", "payload": "x",
			}},
		},
	}
	result := NewValidator().Validate(flow)
	if result.Valid {
		t.Error("expected missing start node error")
	}
}

func TestMissingRequiredAttribute(t *testing.T) {
	flow := &Flow{
		Nodes: []FlowNode{
			{ID: "s1", Type: NodeTypeStart, Name: "Start", Properties: map[string]interface{}{}},
		},
	}
	result := NewValidator().Validate(flow)
	if result.Valid {
		t.Error("expected missing required attribute error")
	}
}

func TestUnknownNodeType(t *testing.T) {
	flow := &Flow{
		Nodes: []FlowNode{
			{ID: "s1", Type: NodeType("unknown"), Name: "X", Properties: map[string]interface{}{}},
		},
	}
	result := NewValidator().Validate(flow)
	if result.Valid {
		t.Error("expected unknown node type error")
	}
}

func TestBoundaryNodes(t *testing.T) {
	// Start node with 2 parents
	flow := &Flow{
		Nodes: []FlowNode{
			{ID: "s1", Type: NodeTypeStart, Name: "Start", Properties: map[string]interface{}{"name": "S"}},
			{ID: "a1", Type: NodeTypeAction, Name: "A", Properties: map[string]interface{}{
				"name": "A", "action_type": "script", "payload": "x",
			}},
			{ID: "a2", Type: NodeTypeAction, Name: "B", Properties: map[string]interface{}{
				"name": "B", "action_type": "script", "payload": "y",
			}},
		},
		Edges: []FlowEdge{
			{ID: "e_1", SourceID: "a1", SourcePort: "out", TargetID: "s1", TargetPort: "in"},
			{ID: "e_2", SourceID: "a2", SourcePort: "out", TargetID: "s1", TargetPort: "in"},
		},
	}
	result := NewValidator().Validate(flow)
	if result.Valid {
		t.Error("expected start node max_parents violation")
	}
}

func TestPortTypeCompatibility(t *testing.T) {
	if !portsCompatible(PortTypeAny, PortTypeString) {
		t.Error("any should be compatible with any")
	}
	if !portsCompatible(PortTypeTrigger, PortTypeTrigger) {
		t.Error("same types should be compatible")
	}
	if !portsCompatible(PortTypeJSON, PortTypeString) {
		t.Error("json should be compatible with anything")
	}
	if !portsCompatible(PortTypeEvent, PortTypeAny) {
		t.Error("any should accept event")
	}
}

func TestSchemaJSONSerialization(t *testing.T) {
	s := AllSchemas()[0]
	data, err := s.MarshalToJSON()
	if err != nil {
		t.Fatalf("MarshalToJSON error: %v", err)
	}
	var s2 NodeSchema
	if err := s2.UnmarshalFromJSON(data); err != nil {
		t.Fatalf("UnmarshalFromJSON error: %v", err)
	}
	if s2.NodeType != s.NodeType {
		t.Fatalf("expected %s, got %s", s.NodeType, s2.NodeType)
	}
}

func TestValidateSingleNode(t *testing.T) {
	v := NewValidator()
	errs := v.ValidateSingleNode("n1", NodeTypeAction, map[string]interface{}{})
	if len(errs) == 0 {
		t.Error("expected attribute errors")
	}

	errs2 := v.ValidateSingleNode("n2", NodeType("bogus"), map[string]interface{}{})
	if len(errs2) == 0 {
		t.Error("expected unknown node type error")
	}
}

func TestIsDAG(t *testing.T) {
	v := NewValidator()
	acyclic := &Flow{
		Nodes: []FlowNode{
			{ID: "s1", Type: NodeTypeStart, Name: "S", Properties: map[string]interface{}{"name": "S"}},
		},
	}
	if !v.IsDAG(acyclic) {
		t.Error("single node should be DAG")
	}

	cyclic := &Flow{
		Nodes: []FlowNode{
			{ID: "a1", Type: NodeTypeAction, Name: "A", Properties: map[string]interface{}{
				"name": "A", "action_type": "script", "payload": "x",
			}},
			{ID: "a2", Type: NodeTypeAction, Name: "B", Properties: map[string]interface{}{
				"name": "B", "action_type": "script", "payload": "y",
			}},
		},
		Edges: []FlowEdge{
			{ID: "e1", SourceID: "a1", TargetID: "a2"},
			{ID: "e2", SourceID: "a2", TargetID: "a1"},
		},
	}
	if v.IsDAG(cyclic) {
		t.Error("cycle should not be DAG")
	}
}
