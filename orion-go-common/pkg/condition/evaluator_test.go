package condition

import (
	"testing"
)

func TestEngineEvaluateComparison(t *testing.T) {
	tests := []struct {
		name   string
		cond   *Condition
		data   map[string]interface{}
		expect bool
		wantErr bool
	}{
		{
			name: "equal match",
			cond: &Condition{
				Field: "status",
				Operator: OpEqual,
				Values: []interface{}{"open"},
			},
			data:  map[string]interface{}{"status": "open"},
			expect: true,
		},
		{
			name: "equal mismatch",
			cond: &Condition{
				Field: "status",
				Operator: OpEqual,
				Values: []interface{}{"closed"},
			},
			data:  map[string]interface{}{"status": "open"},
			expect: false,
		},
		{
			name: "not equal match",
			cond: &Condition{
				Field: "status",
				Operator: OpNotEqual,
				Values: []interface{}{"closed"},
			},
			data:  map[string]interface{}{"status": "open"},
			expect: true,
		},
		{
			name: "greater than",
			cond: &Condition{
				Field: "count",
				Operator: OpGreater,
				Values: []interface{}{5},
			},
			data:  map[string]interface{}{"count": 10},
			expect: true,
		},
		{
			name: "less than",
			cond: &Condition{
				Field: "count",
				Operator: OpLess,
				Values: []interface{}{5},
			},
			data:  map[string]interface{}{"count": 3},
			expect: true,
		},
		{
			name: "in match",
			cond: &Condition{
				Field: "level",
				Operator: OpIn,
				Values: []interface{}{"P0", "P1"},
			},
			data:  map[string]interface{}{"level": "P1"},
			expect: true,
		},
		{
			name: "in mismatch",
			cond: &Condition{
				Field: "level",
				Operator: OpIn,
				Values: []interface{}{"P0", "P1"},
			},
			data:  map[string]interface{}{"level": "P3"},
			expect: false,
		},
		{
			name: "not in match",
			cond: &Condition{
				Field: "level",
				Operator: OpNotIn,
				Values: []interface{}{"P0", "P1"},
			},
			data:  map[string]interface{}{"level": "P3"},
			expect: true,
		},
		{
			name: "between match",
			cond: &Condition{
				Field: "score",
				Operator: OpBetween,
				Values: []interface{}{50, 100},
			},
			// Use float64 to avoid ambiguity with int
			data:  map[string]interface{}{"score": float64(75)},
			expect: true,
		},
		{
			name: "between mismatch (below)",
			cond: &Condition{
				Field: "score",
				Operator: OpBetween,
				Values: []interface{}{50, 100},
			},
			data:  map[string]interface{}{"score": float64(30)},
			expect: false,
		},
		{
			name: "contains match",
			cond: &Condition{
				Field: "message",
				Operator: OpContains,
				Values: []interface{}{"error"},
			},
			data:  map[string]interface{}{"message": "critical error occurred"},
			expect: true,
		},
		{
			name: "contains mismatch",
			cond: &Condition{
				Field: "message",
				Operator: OpContains,
				Values: []interface{}{"success"},
			},
			data:  map[string]interface{}{"message": "failed"},
			expect: false,
		},
		{
			name: "starts with match",
			cond: &Condition{
				Field: "type",
				Operator: OpStartsWith,
				Values: []interface{}{"alert"},
			},
			data:  map[string]interface{}{"type": "alert_critical"},
			expect: true,
		},
		{
			name: "ends with match",
			cond: &Condition{
				Field: "type",
				Operator: OpEndsWith,
				Values: []interface{}{"critical"},
			},
			data:  map[string]interface{}{"type": "alert_critical"},
			expect: true,
		},
		{
			name: "is null - field missing",
			cond: &Condition{
				Field: "optional",
				Operator: OpIsNull,
			},
			data:  map[string]interface{}{"other": "value"},
			expect: true,
		},
		{
			name: "is null - field empty string",
			cond: &Condition{
				Field: "name",
				Operator: OpIsNull,
			},
			data:  map[string]interface{}{"name": ""},
			expect: true,
		},
		{
			name: "is not null - field present",
			cond: &Condition{
				Field: "name",
				Operator: OpNotNull,
			},
			data:  map[string]interface{}{"name": "alice"},
			expect: true,
		},
		{
			name: "is not null - field missing",
			cond: &Condition{
				Field: "name",
				Operator: OpNotNull,
			},
			data:  map[string]interface{}{"other": "value"},
			expect: false,
		},
		{
			name: "regex match",
			cond: &Condition{
				Field: "email",
				Operator: OpRegex,
				Values: []interface{}{`.+@.+\.com`},
			},
			data:  map[string]interface{}{"email": "test@example.com"},
			expect: true,
		},
		{
			name: "regex mismatch",
			cond: &Condition{
				Field: "email",
				Operator: OpRegex,
				Values: []interface{}{`.+@.+\.com`},
			},
			data:  map[string]interface{}{"email": "test.org"},
			expect: false,
		},
		{
			name: "nested field",
			cond: &Condition{
				Field: "user.role",
				Operator: OpEqual,
				Values: []interface{}{"admin"},
			},
			data:  map[string]interface{}{
				"user": map[string]interface{}{"role": "admin"},
			},
			expect: true,
		},
	}

	engine := NewEngine()

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Wrap condition in a group for evaluation
			group := &ConditionGroup{
				Operator: LogicalAnd,
				Conditions: []ConditionExpr{
					{IsGroup: false, Cond: tt.cond},
				},
			}
			got, err := engine.Evaluate(group, tt.data)
			if (err != nil) != tt.wantErr {
				t.Errorf("Evaluate() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if got != tt.expect {
				t.Errorf("Evaluate() = %v, want %v", got, tt.expect)
			}
		})
	}
}

func TestEngineEvaluateGroup(t *testing.T) {
	engine := NewEngine()

	tests := []struct {
		name   string
		group  *ConditionGroup
		data   map[string]interface{}
		expect bool
		wantErr bool
	}{
		{
			name: "AND all true",
			group: &ConditionGroup{
				Operator: LogicalAnd,
				Conditions: []ConditionExpr{
					{IsGroup: false, Cond: &Condition{
						Field: "a", Operator: OpEqual,
						Values: []interface{}{1},
					}},
					{IsGroup: false, Cond: &Condition{
						Field: "b", Operator: OpEqual,
						Values: []interface{}{2},
					}},
				},
			},
			data:   map[string]interface{}{"a": 1, "b": 2},
			expect: true,
		},
		{
			name: "AND one false",
			group: &ConditionGroup{
				Operator: LogicalAnd,
				Conditions: []ConditionExpr{
					{IsGroup: false, Cond: &Condition{
						Field: "a", Operator: OpEqual,
						Values: []interface{}{1},
					}},
					{IsGroup: false, Cond: &Condition{
						Field: "b", Operator: OpEqual,
						Values: []interface{}{9},
					}},
				},
			},
			data:   map[string]interface{}{"a": 1, "b": 2},
			expect: false,
		},
		{
			name: "OR one true",
			group: &ConditionGroup{
				Operator: LogicalOr,
				Conditions: []ConditionExpr{
					{IsGroup: false, Cond: &Condition{
						Field: "a", Operator: OpEqual,
						Values: []interface{}{9},
					}},
					{IsGroup: false, Cond: &Condition{
						Field: "b", Operator: OpEqual,
						Values: []interface{}{2},
					}},
				},
			},
			data:   map[string]interface{}{"a": 1, "b": 2},
			expect: true,
		},
		{
			name: "OR all false",
			group: &ConditionGroup{
				Operator: LogicalOr,
				Conditions: []ConditionExpr{
					{IsGroup: false, Cond: &Condition{
						Field: "a", Operator: OpEqual,
						Values: []interface{}{9},
					}},
					{IsGroup: false, Cond: &Condition{
						Field: "b", Operator: OpEqual,
						Values: []interface{}{9},
					}},
				},
			},
			data:   map[string]interface{}{"a": 1, "b": 2},
			expect: false,
		},
		{
			name: "nested OR inside AND",
			group: &ConditionGroup{
				Operator: LogicalAnd,
				Conditions: []ConditionExpr{
					{IsGroup: false, Cond: &Condition{
						Field: "a", Operator: OpEqual,
						Values: []interface{}{1},
					}},
					{IsGroup: true, Group: &ConditionGroup{
						Operator: LogicalOr,
						Conditions: []ConditionExpr{
							{IsGroup: false, Cond: &Condition{
								Field: "b", Operator: OpEqual,
								Values: []interface{}{2},
							}},
							{IsGroup: false, Cond: &Condition{
								Field: "c", Operator: OpEqual,
								Values: []interface{}{3},
							}},
						},
					}},
				},
			},
			data:   map[string]interface{}{"a": 1, "b": 2, "c": 9},
			expect: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := engine.Evaluate(tt.group, tt.data)
			if (err != nil) != tt.wantErr {
				t.Errorf("Evaluate() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if got != tt.expect {
				t.Errorf("Evaluate() = %v, want %v", got, tt.expect)
			}
		})
	}
}

func TestEngineCustomFunction(t *testing.T) {
	engine := NewEngine()

	// Register a custom function: is_even
	engine.RegisterFunction("is_even", func(data map[string]interface{}, args []interface{}) (interface{}, error) {
		if len(args) == 0 {
			return false, nil
		}
		num, ok := toNumber(args[0])
		if !ok {
			return false, nil
		}
		return int(num)%2 == 0, nil
	})

	cond := &Condition{
		Field:    "",
		Operator: OpFunc,
		FuncName: "is_even",
		Values:   []interface{}{4},
	}

	group := &ConditionGroup{
		Operator: LogicalAnd,
		Conditions: []ConditionExpr{
			{IsGroup: false, Cond: cond},
		},
	}

	got, err := engine.Evaluate(group, map[string]interface{}{})
	if err != nil {
		t.Errorf("Evaluate() error = %v", err)
		return
	}
	if got != true {
		t.Errorf("Evaluate() = %v, want true", got)
	}

	// Test with odd number
	cond.Values = []interface{}{3}
	got, err = engine.Evaluate(group, map[string]interface{}{})
	if err != nil {
		t.Errorf("Evaluate() error = %v", err)
		return
	}
	if got != false {
		t.Errorf("Evaluate() = %v, want false", got)
	}
}

func TestEngineDefaultFunctions(t *testing.T) {
	engine := NewEngine()

	tests := []struct {
		name   string
		fn     string
		args   []interface{}
		expect interface{}
	}{
		{"length string", "length", []interface{}{"hello"}, float64(5)},
		{"length array", "length", []interface{}{[]interface{}{"a", "b", "c"}}, float64(3)},
		{"true", "true", []interface{}{}, true},
		{"false", "false", []interface{}{}, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fn := engine.functions[tt.fn]
			if fn == nil {
				t.Fatalf("function %q not registered", tt.fn)
				return
			}
			result, err := fn(map[string]interface{}{}, tt.args)
			if err != nil {
				t.Errorf("function() error = %v", err)
				return
			}
			if result != tt.expect {
				t.Errorf("function() = %v, want %v", result, tt.expect)
			}
		})
	}
}
