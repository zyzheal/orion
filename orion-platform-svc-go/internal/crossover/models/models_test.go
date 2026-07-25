// Package models_test tests the Crossover models.
package models

import (
	"testing"
	"time"
)

func TestNewListOptions_Defaults(t *testing.T) {
	opts := NewListOptions(0, 0)
	if opts.Offset != 0 {
		t.Errorf("expected offset 0, got %d", opts.Offset)
	}
	if opts.Limit != 20 {
		t.Errorf("expected limit 20, got %d", opts.Limit)
	}
}

func TestNewListOptions_CapsPageSize(t *testing.T) {
	opts := NewListOptions(1, 200)
	if opts.Offset != 0 {
		t.Errorf("expected offset 0, got %d", opts.Offset)
	}
	if opts.Limit != 100 {
		t.Errorf("expected limit 100 (capped), got %d", opts.Limit)
	}
}

func TestCallType_ValidTypes(t *testing.T) {
	for ct := range ValidCallTypes {
		if !ValidCallTypes[ct] {
			t.Errorf("expected call type %s to be valid", ct)
		}
	}
}

func TestCrossoverCall_Creation(t *testing.T) {
	now := time.Now().UTC()
	call := &CrossoverCall{
		ID:           "call-1",
		TenantID:     "tenant-1",
		CallType:     CallTypeRequestResponse,
		SourceModule: "module-a",
		TargetModule: "module-b",
		Operation:    "process",
		Parameters:   CallParameters{"key": "value"},
		Status:       "completed",
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	if call.ID != "call-1" {
		t.Errorf("expected ID call-1, got %s", call.ID)
	}
	if call.CallType != CallTypeRequestResponse {
		t.Errorf("expected CallTypeRequestResponse, got %s", call.CallType)
	}
}

func TestCallResultObj_Creation(t *testing.T) {
	obj := &CallResultObj{
		Value:  map[string]interface{}{"result": "ok"},
		Error:  "",
		DoneAt: time.Now().UTC(),
	}
	if obj.Value["result"] != "ok" {
		t.Errorf("expected result ok, got %v", obj.Value["result"])
	}
}

func TestRegisterOperationRequest_Validation(t *testing.T) {
	req := &RegisterOperationRequest{
		Module:      "test-module",
		Name:        "test-op",
		CallType:    CallTypeAsync,
		Description: "test operation",
	}
	if req.Module != "test-module" {
		t.Errorf("expected module test-module, got %s", req.Module)
	}
	if req.CallType != CallTypeAsync {
		t.Errorf("expected async, got %s", req.CallType)
	}
}

func TestModuleRegistry_RegisterAndGet(t *testing.T) {
	reg := NewModuleRegistry()
	info := &ModuleInfo{
		Name:        "test-module",
		Domain:      "test-domain",
		Description: "test description",
		Operations:  []string{"op1", "op2"},
	}
	reg.Register(info)
	got := reg.Get("test-module")
	if got == nil {
		t.Fatal("expected module to be found")
	}
	if got.Name != "test-module" {
		t.Errorf("expected test-module, got %s", got.Name)
	}
	if len(got.Operations) != 2 {
		t.Errorf("expected 2 operations, got %d", len(got.Operations))
	}
}

func TestModuleRegistry_Unregister(t *testing.T) {
	reg := NewModuleRegistry()
	reg.Register(&ModuleInfo{Name: "test-module"})
	reg.Unregister("test-module")
	if reg.Get("test-module") != nil {
		t.Error("expected module to be nil after unregister")
	}
}

func TestModuleRegistry_Has(t *testing.T) {
	reg := NewModuleRegistry()
	reg.Register(&ModuleInfo{Name: "test-module"})
	if !reg.Has("test-module") {
		t.Error("expected module to exist")
	}
	if reg.Has("nonexistent") {
		t.Error("expected nonexistent module to not exist")
	}
}

func TestModuleRegistry_HasOperation(t *testing.T) {
	reg := NewModuleRegistry()
	reg.Register(&ModuleInfo{
		Name:       "test-module",
		Operations: []string{"op1", "op2"},
	})
	if !reg.HasOperation("test-module", "op1") {
		t.Error("expected op1 to exist")
	}
	if reg.HasOperation("test-module", "nonexistent") {
		t.Error("expected nonexistent op to not exist")
	}
	if reg.HasOperation("nonexistent-module", "op1") {
		t.Error("expected nonexistent module to not have ops")
	}
}

func TestModuleRegistry_List(t *testing.T) {
	reg := NewModuleRegistry()
	reg.Register(&ModuleInfo{Name: "module-a"})
	reg.Register(&ModuleInfo{Name: "module-b"})
	list := reg.List()
	if len(list) != 2 {
		t.Errorf("expected 2 modules, got %d", len(list))
	}
}
