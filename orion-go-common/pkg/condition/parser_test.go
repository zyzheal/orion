package condition

import (
	"testing"
)

func TestParseDSL(t *testing.T) {
	tests := []struct {
		name    string
		dsl     string
		expect  *ConditionGroup
		wantErr bool
	}{
		{
			name: "simple equality",
			dsl: `{
				"operator": "AND",
				"conditions": [
					{"field": "status", "operator": "==", "values": ["open"]}
				]
			}`,
			expect: &ConditionGroup{
				Operator: LogicalAnd,
				Conditions: []ConditionExpr{
					{IsGroup: false, Cond: &Condition{
						Field: "status", Operator: OpEqual,
						Values: []interface{}{"open"},
					}},
				},
			},
		},
		{
			name: "in operator",
			dsl: `{
				"operator": "AND",
				"conditions": [
					{"field": "level", "operator": "in", "values": ["P0", "P1"]}
				]
			}`,
			expect: &ConditionGroup{
				Operator: LogicalAnd,
				Conditions: []ConditionExpr{
					{IsGroup: false, Cond: &Condition{
						Field: "level", Operator: OpIn,
						Values: []interface{}{"P0", "P1"},
					}},
				},
			},
		},
		{
			name: "nested OR inside AND",
			dsl: `{
				"operator": "AND",
				"conditions": [
					{"field": "a", "operator": "==", "values": [1]},
					{
						"operator": "OR",
						"conditions": [
							{"field": "b", "operator": ">", "values": [10]},
							{"field": "c", "operator": "<", "values": [5]}
						]
					}
				]
			}`,
			expect: &ConditionGroup{
				Operator: LogicalAnd,
				Conditions: []ConditionExpr{
					{IsGroup: false, Cond: &Condition{
						Field: "a", Operator: OpEqual,
						Values: []interface{}{float64(1)},
					}},
					{IsGroup: true, Group: &ConditionGroup{
						Operator: LogicalOr,
						Conditions: []ConditionExpr{
							{IsGroup: false, Cond: &Condition{
								Field: "b", Operator: OpGreater,
								Values: []interface{}{float64(10)},
							}},
							{IsGroup: false, Cond: &Condition{
								Field: "c", Operator: OpLess,
								Values: []interface{}{float64(5)},
							}},
						},
					}},
				},
			},
		},
		{
			name: "operator aliases",
			dsl: `{
				"operator": "AND",
				"conditions": [
					{"field": "x", "operator": "eq", "values": [1]}
				]
			}`,
			// Alias "eq" parses successfully; normalization happens at Validate() time
			expect: &ConditionGroup{
				Operator: LogicalAnd,
				Conditions: []ConditionExpr{
					{IsGroup: false, Cond: &Condition{
						Field: "x", Operator: "eq", // Not yet normalized
						Values: []interface{}{float64(1)},
					}},
				},
			},
		},
		{
			name: "empty DSL",
			dsl:  ``,
			wantErr: true,
		},
		{
			name: "invalid JSON",
			dsl:  `{bad json}`,
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			group, err := ParseDSL(tt.dsl)
			if (err != nil) != tt.wantErr {
				t.Errorf("ParseDSL() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if tt.wantErr {
				return
			}

			// Verify structure matches expectation
			if group == nil || tt.expect == nil {
				t.Fatal("ParseDSL() returned nil group")
				return
			}

			if group.Operator != tt.expect.Operator {
				t.Errorf("Operator = %q, want %q", group.Operator, tt.expect.Operator)
			}

			if len(group.Conditions) != len(tt.expect.Conditions) {
				t.Errorf("Conditions len = %d, want %d", len(group.Conditions), len(tt.expect.Conditions))
			}
		})
	}
}

func TestParseDSLValidation(t *testing.T) {
	dsl := `{
		"operator": "AND",
		"conditions": [
			{"field": "status", "operator": "==", "values": ["open"]},
			{"field": "level", "operator": "in", "values": ["P0", "P1"]}
		]
	}`

	group, err := ParseDSL(dsl)
	if err != nil {
		t.Fatalf("ParseDSL() error = %v", err)
		return
	}

	// Run validation
	err = Validate(group)
	if err != nil {
		t.Errorf("Validate() error = %v", err)
	}
}

func TestRoundTrip(t *testing.T) {
	group := &ConditionGroup{
		Operator: LogicalAnd,
		Conditions: []ConditionExpr{
			{IsGroup: false, Cond: &Condition{
				Field: "name", Operator: OpEqual,
				Values: []interface{}{"alice"},
			}},
		},
	}

	data, err := group.Serialize()
	if err != nil {
		t.Fatalf("Serialize() error = %v", err)
	}

	parsed, err := ParseDSLBytes(data)
	if err != nil {
		t.Fatalf("ParseDSLBytes() error = %v", err)
	}

	if parsed.Operator != group.Operator {
		t.Errorf("Round-trip operator = %q, want %q", parsed.Operator, group.Operator)
	}
	if len(parsed.Conditions) != len(group.Conditions) {
		t.Errorf("Round-trip conditions len = %d, want %d", len(parsed.Conditions), len(group.Conditions))
	}
}
