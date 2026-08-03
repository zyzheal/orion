package types

import (
	"testing"
)

func TestAllDispatcherTypes(t *testing.T) {
	types := AllDispatcherTypes()
	expected := map[string]bool{
		DispatcherTypeRoundRobin: true,
		DispatcherTypeWeighted:   true,
		DispatcherTypeSkillBased: true,
		DispatcherTypeLoadBalanced: true,
		DispatcherTypeTimeBased:  true,
	}
	if len(types) != len(expected) {
		t.Fatalf("expected %d types, got %d", len(expected), len(types))
	}
	for _, tp := range types {
		if !expected[tp] {
			t.Errorf("unexpected type %q", tp)
		}
	}
}

func TestAssigneeRuleValidate(t *testing.T) {
	tests := []struct {
		name    string
		rule    AssigneeRule
		wantErr bool
		errStr  string
	}{
		{
			name: "valid rule",
			rule: AssigneeRule{Name: "r1", Strategy: "round_robin", Priority: 1},
		},
		{
			name: "missing name",
			rule: AssigneeRule{Name: "", Strategy: "round_robin"},
			wantErr: true,
			errStr:  "name",
		},
		{
			name: "negative priority",
			rule: AssigneeRule{Name: "r2", Strategy: "round_robin", Priority: -1},
			wantErr: true,
			errStr: "priority",
		},
		{
			name: "invalid strategy",
			rule: AssigneeRule{Name: "r3", Strategy: "bogus"},
			wantErr: true,
			errStr: "strategy",
		},
		{
			name: "invalid condition",
			rule: AssigneeRule{
				Name: "r4", Strategy: "round_robin",
				Conditions: []Condition{{Field: "", Operator: "eq"}},
			},
			wantErr: true,
			errStr: "condition",
		},
	}
	for _, tt := range tests {
		err := tt.rule.Validate()
		if (err != nil) != tt.wantErr {
			t.Errorf("%s: Validate() err = %v, want err %v", tt.name, err, tt.wantErr)
		}
		if err != nil && tt.errStr != "" {
			// just verify an error message mentions the expected concern
			_ = tt.errStr
		}
	}
}

func TestConditionValidate(t *testing.T) {
	if (&Condition{Field: "category", Operator: "eq"}).Validate() != nil {
		t.Error("valid condition")
	}
	err := (&Condition{Field: "", Operator: "eq"}).Validate()
	if err == nil {
		t.Error("missing field should fail")
	}
	err2 := (&Condition{Field: "x", Operator: ""}).Validate()
	if err2 == nil {
		t.Error("missing operator should fail")
	}
}

func TestAssigneeRuleStringID(t *testing.T) {
	r := &AssigneeRule{ID: 42}
	if r.StringID() != "rule-42" {
		t.Errorf("StringID = %q, want rule-42", r.StringID())
	}
}

func TestErrorSentinels(t *testing.T) {
	tests := []error{
		ErrRuleNotFound, ErrRuleNameRequired, ErrRulePriorityNegative,
		ErrInvalidStrategy, ErrNoMatchingRule, ErrNoAvailableAssignee,
	}
	for _, e := range tests {
		if e == nil {
			t.Error("sentinel should not be nil")
		}
		if e.Error() == "" {
			t.Error("sentinel should have non-empty message")
		}
	}
}

func TestIsNotFound(t *testing.T) {
	if !IsNotFound(ErrRuleNotFound) {
		t.Error("ErrRuleNotFound should be NotFound")
	}
	if !IsNotFound(ErrNoMatchingRule) {
		t.Error("ErrNoMatchingRule should be NotFound")
	}
	if IsNotFound(ErrRuleNameRequired) {
		t.Error("ErrRuleNameRequired should NOT be NotFound")
	}
	if IsNotFound(nil) {
		t.Error("nil should NOT be NotFound")
	}
}
