package condition

import (
	"testing"
)

func TestConditionValidate(t *testing.T) {
	tests := []struct {
		name    string
		cond    *Condition
		wantErr bool
	}{
		{
			name: "valid equality",
			cond: &Condition{
				Field:    "name",
				Operator: OpEqual,
				Values:   []interface{}{"alice"},
			},
			wantErr: false,
		},
		{
			name: "valid between",
			cond: &Condition{
				Field:    "age",
				Operator: OpBetween,
				Values:   []interface{}{18, 65},
			},
			wantErr: false,
		},
		{
			name: "missing operator",
			cond: &Condition{
				Field: "name",
			},
			wantErr: true,
		},
		{
			name: "missing field",
			cond: &Condition{
				Operator: OpEqual,
				Values:   []interface{}{"alice"},
			},
			wantErr: true,
		},
		{
			name: "empty values",
			cond: &Condition{
				Field:    "name",
				Operator: OpEqual,
			},
			wantErr: true,
		},
		{
			name: "between with 1 value",
			cond: &Condition{
				Field:    "age",
				Operator: OpBetween,
				Values:   []interface{}{18},
			},
			wantErr: true,
		},
		{
			name: "func without name",
			cond: &Condition{
				Operator: OpFunc,
				Values:   []interface{}{"arg1"},
			},
			wantErr: true,
		},
		{
			name: "null check valid",
			cond: &Condition{
				Field:    "optional_field",
				Operator: OpIsNull,
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.cond.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestConditionGroupValidate(t *testing.T) {
	tests := []struct {
		name    string
		group   *ConditionGroup
		wantErr bool
	}{
		{
			name: "valid AND group",
			group: &ConditionGroup{
				Operator: LogicalAnd,
				Conditions: []ConditionExpr{
					{IsGroup: false, Cond: &Condition{
						Field: "name", Operator: OpEqual,
						Values: []interface{}{"alice"},
					}},
				},
			},
			wantErr: false,
		},
		{
			name: "valid OR group with nested AND",
			group: &ConditionGroup{
				Operator: LogicalOr,
				Conditions: []ConditionExpr{
					{IsGroup: false, Cond: &Condition{
						Field: "age", Operator: OpGTE,
						Values: []interface{}{18},
					}},
					{IsGroup: true, Group: &ConditionGroup{
						Operator: LogicalAnd,
						Conditions: []ConditionExpr{
							{IsGroup: false, Cond: &Condition{
								Field: "vip", Operator: OpEqual,
								Values: []interface{}{true},
							}},
						},
					}},
				},
			},
			wantErr: false,
		},
		{
			name: "empty group",
			group: &ConditionGroup{
				Operator:   LogicalAnd,
				Conditions: []ConditionExpr{},
			},
			wantErr: true,
		},
		{
			name: "invalid operator",
			group: &ConditionGroup{
				Operator: LogicalOperator("XOR"),
				Conditions: []ConditionExpr{
					{IsGroup: false, Cond: &Condition{
						Field: "name", Operator: OpEqual,
						Values: []interface{}{"alice"},
					}},
				},
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.group.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestConditionString(t *testing.T) {
	cond := &Condition{
		Field:    "alert.severity",
		Operator: OpIn,
		Values:   []interface{}{"P0", "P1"},
	}
	got := cond.String()
	want := `alert.severity in [P0 P1]`
	if got != want {
		t.Errorf("String() = %q, want %q", got, want)
	}
}

func TestNormalizeOperator(t *testing.T) {
	tests := []struct {
		input ConditionOperator
		want  ConditionOperator
	}{
		{OpEq, OpEqual},
		{OpNeq, OpNotEqual},
		{OpGt, OpGreater},
		{OpLt, OpLess},
		{OpGte, OpGTE},
		{OpLte, OpLTE},
		{OpNin, OpNotIn},
		{OpEqual, OpEqual},
		{OpContains, OpContains},
	}

	for _, tt := range tests {
		got := normalizeOperator(tt.input)
		if got != tt.want {
			t.Errorf("normalizeOperator(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}
}

func TestResolveFieldPath(t *testing.T) {
	data := map[string]interface{}{
		"name": "alice",
		"nested": map[string]interface{}{
			"level1": map[string]interface{}{
				"level2": "deep",
			},
		},
	}

	tests := []struct {
		name   string
		field  string
		want   interface{}
		found  bool
	}{
		{"flat field", "name", "alice", true},
		{"nested field", "nested.level1.level2", "deep", true},
		{"missing field", "missing", nil, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, found := resolveFieldPath(data, tt.field)
			if found != tt.found {
				t.Errorf("resolveFieldPath() found = %v, want %v", found, tt.found)
			}
			if got != tt.want {
				t.Errorf("resolveFieldPath() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestSplitFieldPath(t *testing.T) {
	tests := []struct {
		input string
		want  []string
	}{
		{"name", []string{"name"}},
		{"user.name", []string{"user", "name"}},
		{"a.b.c", []string{"a", "b", "c"}},
	}

	for _, tt := range tests {
		got := splitFieldPath(tt.input)
		if len(got) != len(tt.want) {
			t.Fatalf("splitFieldPath(%q) = %v, want %v", tt.input, got, tt.want)
		}
		for i, part := range got {
			if part != tt.want[i] {
				t.Errorf("splitFieldPath(%q)[%d] = %q, want %q", tt.input, i, part, tt.want[i])
			}
		}
	}
}

func TestIsNil(t *testing.T) {
	tests := []struct {
		name string
		val  interface{}
		want bool
	}{
		{"nil", nil, true},
		{"empty string", "", true},
		{"non-empty string", "hello", false},
		{"zero int", 0, false},
		{"true", true, false},
		{"false", false, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := isNil(tt.val)
			if got != tt.want {
				t.Errorf("isNil(%v) = %v, want %v", tt.val, got, tt.want)
			}
		})
	}
}
