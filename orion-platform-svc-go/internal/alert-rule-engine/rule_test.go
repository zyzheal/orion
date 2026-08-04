package alertruleengine

import (
	"testing"
	"time"
)

// ========== Expression Parser Tests ==========

func TestParseSimpleComparison(t *testing.T) {
	tests := []struct {
		name      string
		expr      string
		wantOK    bool
		wantErr   bool
	}{
		{"greater than", `cpu > 80`, true, false},
		{"less than", `cpu < 10`, true, false},
		{"equal", `memory == 1024`, true, false},
		{"not equal", `disk != 0`, true, false},
		{"greater or equal", `latency >= 100`, true, false},
		{"less or equal", `latency <= 500`, true, false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			expr, err := ParseExpression(tc.expr)
			if tc.wantErr {
				if err == nil {
					t.Fatalf("expected error but got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if expr == nil {
				t.Fatal("expected non-nil expression")
			}
		})
	}
}

func TestParseLogicalAND(t *testing.T) {
	expr, err := ParseExpression(`cpu > 80 && memory > 90`)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if expr == nil {
		t.Fatal("expected non-nil expression")
	}
	inner, ok := expr.inner.(*LogicalExpr)
	if !ok {
		t.Fatalf("expected LogicalExpr, got %T", expr.inner)
	}
	if inner.Operator != "&&" {
		t.Errorf("expected operator &&, got %s", inner.Operator)
	}
}

func TestParseLogicalOR(t *testing.T) {
	expr, err := ParseExpression(`cpu > 80 || disk > 95`)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	inner, ok := expr.inner.(*LogicalExpr)
	if !ok {
		t.Fatalf("expected LogicalExpr, got %T", expr.inner)
	}
	if inner.Operator != "||" {
		t.Errorf("expected operator ||, got %s", inner.Operator)
	}
}

func TestParseMixedLogical(t *testing.T) {
	// cpu > 80 && memory > 90 || disk > 95
	// Should parse as: (cpu > 80 && memory > 90) || disk > 95
	expr, err := ParseExpression(`cpu > 80 && memory > 90 || disk > 95`)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	top, ok := expr.inner.(*LogicalExpr)
	if !ok {
		t.Fatalf("expected top-level LogicalExpr (OR), got %T", expr.inner)
	}
	if top.Operator != "||" {
		t.Errorf("expected top-level ||, got %s", top.Operator)
	}
	left, ok := top.Left.(*LogicalExpr)
	if !ok {
		t.Fatalf("expected left LogicalExpr (AND), got %T", top.Left)
	}
	if left.Operator != "&&" {
		t.Errorf("expected left &&, got %s", left.Operator)
	}
}

func TestParseAggFunctions(t *testing.T) {
	tests := []struct {
		name string
		expr string
		fn   string
	}{
		{"avg", `avg(cpu)`, "avg"},
		{"max", `max(cpu)`, "max"},
		{"min", `min(cpu)`, "min"},
		{"sum", `sum(cpu)`, "sum"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			expr, err := ParseExpression(tc.expr)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			agg, ok := expr.inner.(*AggFuncExpr)
			if !ok {
				t.Fatalf("expected AggFuncExpr, got %T", expr.inner)
			}
			if agg.FuncName != tc.fn {
				t.Errorf("expected function %s, got %s", tc.fn, agg.FuncName)
			}
		})
	}
}

func TestParseWindowFunction(t *testing.T) {
	tests := []struct {
		name     string
		expr     string
		wantName string
	}{
		{"last 5m", `cpu.last(5m)`, "cpu"},
		{"last 1h", `cpu.last(1h)`, "cpu"},
		{"last 30s", `memory.last(30s)`, "memory"},
		{"last 10", `cpu.last(10)`, "cpu"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			expr, err := ParseExpression(tc.expr)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			inner := expr.inner
			// Check if it's directly a WindowExpr or ComparisonExpr with WindowExpr
			var win *WindowExpr
			if w, ok := inner.(*WindowExpr); ok {
				win = w
			} else if comp, ok := inner.(*ComparisonExpr); ok {
				if w, ok := comp.Left.(*WindowExpr); ok {
					win = w
				}
			}
			if win == nil {
				t.Fatalf("expected WindowExpr in tree, got %T", inner)
			}
			if win.Name != tc.wantName {
				t.Errorf("expected window name %s, got %s", tc.wantName, win.Name)
			}
		})
	}
}

func TestParseLabelMatchers(t *testing.T) {
	tests := []struct {
		name   string
		expr   string
		labels map[string]string
	}{
		{
			"single label",
			`cpu{instance="host1"}`,
			map[string]string{"instance": "host1"},
		},
		{
			"multiple labels",
			`cpu{instance="host1",region="us-west"}`,
			map[string]string{"instance": "host1", "region": "us-west"},
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			expr, err := ParseExpression(tc.expr)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			inner := expr.inner
			var labels map[string]string
			if id, ok := inner.(*IdentifierExpr); ok {
				labels = id.Labels
			} else if l, ok := inner.(*LabeledExpr); ok {
				labels = l.Labels
			} else {
				t.Fatalf("expected IdentifierExpr or LabeledExpr in tree, got %T", inner)
			}
			for k, v := range tc.labels {
				if labels[k] != v {
					t.Errorf("label %s: expected %s, got %s", k, v, labels[k])
				}
			}
		})
	}
}

func TestParseParenthesizedExpr(t *testing.T) {
	expr, err := ParseExpression(`(cpu > 80) && (memory > 90)`)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if expr == nil {
		t.Fatal("expected non-nil expression")
	}
}

func TestParseInvalidExpr(t *testing.T) {
	tests := []string{
		`cpu < 80 &&`,      // trailing && without right operand
		`cpu > && 80`,      // missing operand
		`80 > cpu`,         // number as left operand before compare
	}
	for _, s := range tests {
		_, err := ParseExpression(s)
		if err == nil {
			t.Errorf("expected error for expression %q", s)
		}
	}
}

// ========== Evaluator Tests ==========

func TestEvaluatorComparison(t *testing.T) {
	snapshot := NewSnapshotBuilder().
		AddMetric("cpu", 85.0).
		AddMetric("memory", 512.0).
		AddMetric("disk", 0.0).
		Build()

	tests := []struct {
		name  string
		expr  string
		want  bool
	}{
		{"greater true", `cpu > 80`, true},
		{"greater false", `cpu > 90`, false},
		{"less true", `memory < 1024`, true},
		{"less false", `memory < 256`, false},
		{"equal true", `memory == 512`, true},
		{"equal false", `memory == 1024`, false},
		{"not equal true", `disk != 1`, true},
		{"not equal false", `disk != 0`, false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			_, ok, err := NewEvaluator(snapshot).EvaluateString(tc.expr)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if ok != tc.want {
				t.Errorf("expected %v, got %v", tc.want, ok)
			}
		})
	}
}

func TestEvaluatorLogicalAND(t *testing.T) {
	snapshot := NewSnapshotBuilder().
		AddMetric("cpu", 85.0).
		AddMetric("memory", 512.0).
		Build()

	tests := []struct {
		name string
		expr string
		want bool
	}{
		{"both true", `cpu > 80 && memory < 1024`, true},
		{"left false", `cpu > 90 && memory < 1024`, false},
		{"right false", `cpu > 80 && memory > 1024`, false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			_, ok, err := NewEvaluator(snapshot).EvaluateString(tc.expr)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if ok != tc.want {
				t.Errorf("expected %v, got %v", tc.want, ok)
			}
		})
	}
}

func TestEvaluatorLogicalOR(t *testing.T) {
	snapshot := NewSnapshotBuilder().
		AddMetric("cpu", 85.0).
		AddMetric("memory", 512.0).
		Build()

	tests := []struct {
		name string
		expr string
		want bool
	}{
		{"left true", `cpu > 80 || memory > 1024`, true},
		{"right true", `cpu > 90 || memory < 1024`, true},
		{"both false", `cpu > 90 && memory > 1024`, false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			_, ok, err := NewEvaluator(snapshot).EvaluateString(tc.expr)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if ok != tc.want {
				t.Errorf("expected %v, got %v", tc.want, ok)
			}
		})
	}
}

func TestEvaluatorAggFunctions(t *testing.T) {
	snapshot := NewSnapshotBuilder().
		AddMetric("cpu_server1", 80.0).
		AddMetric("cpu_server2", 60.0).
		AddMetric("cpu_server3", 40.0).
		Build()

	tests := []struct {
		name     string
		expr     string
		wantVal  float64
		wantOk   bool
	}{
		{"sum", `sum(cpu)`, 180.0, true},
		{"avg", `avg(cpu)`, 60.0, true},
		{"max", `max(cpu)`, 80.0, true},
		{"min", `min(cpu)`, 40.0, true},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			expr, err := ParseExpression(tc.expr)
			if err != nil {
				t.Fatalf("unexpected parse error: %v", err)
			}
			val, ok, err := NewEvaluator(snapshot).Evaluate(expr)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if ok != tc.wantOk {
				t.Errorf("expected ok=%v, got %v", tc.wantOk, ok)
			}
			if val != tc.wantVal {
				t.Errorf("expected value %v, got %v", tc.wantVal, val)
			}
		})
	}
}

func TestEvaluatorTimeWindow(t *testing.T) {
	snapshot := NewSnapshotBuilder().
		AddMetric("cpu", 95.0).
		AddSeries("cpu", []float64{10, 20, 30, 40, 50}).
		Build()

	tests := []struct {
		name    string
		expr    string
		wantVal float64
		wantOk  bool
	}{
		{"last 3 points", `cpu.last(3)`, 40.0, true}, // avg of [30, 40, 50]
		{"last 2 points", `cpu.last(2)`, 45.0, true}, // avg of [40, 50]
		{"last 5m (300s)", `cpu.last(5m)`, 30.0, true}, // avg of all 5 points (300 seconds = 300 points, takes all 5)
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			expr, err := ParseExpression(tc.expr)
			if err != nil {
				t.Fatalf("unexpected parse error: %v", err)
			}
			val, ok, err := NewEvaluator(snapshot).Evaluate(expr)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if ok != tc.wantOk {
				t.Errorf("expected ok=%v, got %v", tc.wantOk, ok)
			}
			if val != tc.wantVal {
				t.Errorf("expected value %v, got %v", tc.wantVal, val)
			}
		})
	}
}

func TestEvaluatorLabelMatchers(t *testing.T) {
	snapshot := NewSnapshotBuilder().
		AddMetric("cpu_host1", 85.0).
		AddMetric("cpu_host2", 30.0).
		AddLabels("cpu_host1", map[string]string{"instance": "host1"}).
		AddLabels("cpu_host2", map[string]string{"instance": "host2"}).
		Build()

	tests := []struct {
		name string
		expr string
		want bool
	}{
		{"matching label", `cpu_host1{instance="host1"} > 50`, true},
		{"non-matching label", `cpu_host1{instance="host2"} > 50`, false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			_, ok, err := NewEvaluator(snapshot).EvaluateString(tc.expr)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if ok != tc.want {
				t.Errorf("expected %v, got %v", tc.want, ok)
			}
		})
	}
}

func TestEvaluatorComplexExpr(t *testing.T) {
	snapshot := NewSnapshotBuilder().
		AddMetric("cpu", 85.0).
		AddMetric("memory", 512.0).
		AddMetric("disk", 90.0).
		Build()

	tests := []struct {
		name string
		expr string
		want bool
	}{
		{
			"complex AND/OR",
			`(cpu > 80 && memory < 1024) || disk < 50`,
			true, // left true: cpu>80 && memory<1024
		},
		{
			"complex false",
			`(cpu > 90 && memory < 1024) || disk < 50`,
			false,
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			_, ok, err := NewEvaluator(snapshot).EvaluateString(tc.expr)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if ok != tc.want {
				t.Errorf("expected %v, got %v", tc.want, ok)
			}
		})
	}
}

func TestEvaluatorMissingMetric(t *testing.T) {
	snapshot := NewSnapshotBuilder().
		AddMetric("cpu", 85.0).
		Build()

	_, ok, err := NewEvaluator(snapshot).EvaluateString(`missing_metric > 50`)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ok {
		t.Error("expected missing metric to not trigger")
	}
}

// ========== Engine Tests ==========

func TestEngineRegisterUnregister(t *testing.T) {
	e := NewEngine()

	raw := &Rule{
		ID:         "r1",
		Name:       "High CPU",
		Expression: `cpu > 80`,
		Severity:   SeverityCritical,
		Cooldown:   5 * time.Second,
		Enabled:    true,
	}
	err := e.Register(raw)
	if err != nil {
		t.Fatalf("register failed: %v", err)
	}

	rule, err := e.GetRule("r1")
	if err != nil {
		t.Fatalf("get rule failed: %v", err)
	}
	if rule.Name != "High CPU" {
		t.Errorf("expected name 'High CPU', got %s", rule.Name)
	}

	// Duplicate registration
	err = e.Register(&Rule{ID: "r1", Name: "Dup", Expression: `cpu > 90`, Enabled: true})
	if err != ErrRuleExists {
		t.Errorf("expected ErrRuleExists, got %v", err)
	}

	// Unregister
	err = e.Unregister("r1")
	if err != nil {
		t.Fatalf("unregister failed: %v", err)
	}

	_, err = e.GetRule("r1")
	if err != ErrRuleNotFound {
		t.Errorf("expected ErrRuleNotFound, got %v", err)
	}
}

func TestEngineEvaluate(t *testing.T) {
	e := NewEngine()

	e.Register(&Rule{
		ID:         "r1",
		Name:       "High CPU",
		Expression: `cpu > 80`,
		Severity:   SeverityCritical,
		Enabled:    true,
	})

	e.Register(&Rule{
		ID:         "r2",
		Name:       "High Memory",
		Expression: `memory > 1024`,
		Severity:   SeverityWarning,
		Enabled:    true,
	})

	snapshot := NewSnapshotBuilder().
		AddMetric("cpu", 85.0).
		AddMetric("memory", 512.0).
		Build()

	results := e.Evaluate(snapshot)

	if len(results) != 1 {
		t.Fatalf("expected 1 triggered rule, got %d", len(results))
	}
	if results[0].RuleID != "r1" {
		t.Errorf("expected r1 triggered, got %s", results[0].RuleID)
	}
	if !results[0].Triggered {
		t.Error("expected rule to be triggered")
	}
}

func TestEngineCooldown(t *testing.T) {
	e := NewEngine()

	e.Register(&Rule{
		ID:         "r1",
		Name:       "High CPU",
		Expression: `cpu > 80`,
		Severity:   SeverityWarning,
		Cooldown:   10 * time.Second,
		Enabled:    true,
	})

	snapshot := NewSnapshotBuilder().
		AddMetric("cpu", 85.0).
		Build()

	// First evaluation should trigger
	results := e.Evaluate(snapshot)
	if len(results) != 1 {
		t.Fatalf("expected 1 triggered on first eval, got %d", len(results))
	}

	// Second evaluation should NOT trigger (within cooldown)
	results = e.Evaluate(snapshot)
	if len(results) != 0 {
		t.Fatalf("expected 0 triggered during cooldown, got %d", len(results))
	}

	// Reset cooldown and re-evaluate
	e.ResetCooldown("r1")
	results = e.Evaluate(snapshot)
	if len(results) != 1 {
		t.Fatalf("expected 1 triggered after cooldown reset, got %d", len(results))
	}
}

func TestEngineGroupingAndPriority(t *testing.T) {
	e := NewEngine()

	e.Register(&Rule{
		ID:         "r1",
		Name:       "Rule B",
		Expression: `cpu > 80`,
		Severity:   SeverityWarning,
		Group:      "infra",
		Priority:   10,
		Enabled:    true,
	})
	e.Register(&Rule{
		ID:         "r2",
		Name:       "Rule A",
		Expression: `cpu > 50`,
		Severity:   SeverityCritical,
		Group:      "infra",
		Priority:   5,
		Enabled:    true,
	})

	ids := e.ListRulesByGroup("infra")
	if len(ids) != 2 {
		t.Fatalf("expected 2 rules in group, got %d", len(ids))
	}
	if ids[0] != "r2" {
		t.Errorf("expected r2 (priority 5) first, got %s", ids[0])
	}
	if ids[1] != "r1" {
		t.Errorf("expected r1 (priority 10) second, got %s", ids[1])
	}
}

func TestEngineStats(t *testing.T) {
	e := NewEngine()
	e.Register(&Rule{ID: "r1", Expression: `cpu > 80`, Severity: SeverityCritical, Enabled: true})
	e.Register(&Rule{ID: "r2", Expression: `mem > 90`, Severity: SeverityWarning, Enabled: true})
	e.Register(&Rule{ID: "r3", Expression: `cpu > 50`, Severity: SeverityCritical, Enabled: false})

	stats := e.Stats()
	if stats["total"] != 3 {
		t.Errorf("expected total 3, got %v", stats["total"])
	}
	if stats["enabled"] != 2 {
		t.Errorf("expected enabled 2, got %v", stats["enabled"])
	}
}

func TestEngineDisabledRule(t *testing.T) {
	e := NewEngine()
	e.Register(&Rule{
		ID:         "r1",
		Expression: `cpu > 0`,
		Severity:   SeverityCritical,
		Enabled:    false,
	})

	snapshot := NewSnapshotBuilder().AddMetric("cpu", 85.0).Build()
	results := e.Evaluate(snapshot)
	if len(results) != 0 {
		t.Errorf("expected 0 results for disabled rule, got %d", len(results))
	}
}

func TestEngineListRulesSorted(t *testing.T) {
	e := NewEngine()
	e.Register(&Rule{ID: "r2", Expression: `cpu > 80`, Priority: 10, Group: "a", Enabled: true})
	e.Register(&Rule{ID: "r1", Expression: `cpu > 50`, Priority: 5, Group: "a", Enabled: true})

	rules := e.ListRules()
	if len(rules) != 2 {
		t.Fatalf("expected 2 rules, got %d", len(rules))
	}
	if rules[0].ID != "r1" {
		t.Errorf("expected r1 first (priority 5), got %s", rules[0].ID)
	}
}

func TestEngineEvaluateExpressionResult(t *testing.T) {
	e := NewEngine()

	// Register a rule with AND/OR combination
	e.Register(&Rule{
		ID:         "r1",
		Name:       "Complex Rule",
		Expression: `(cpu > 80 && memory < 1024) || disk > 90`,
		Severity:   SeverityCritical,
		Enabled:    true,
	})

	snapshot := NewSnapshotBuilder().
		AddMetric("cpu", 85.0).
		AddMetric("memory", 512.0).
		AddMetric("disk", 30.0).
		Build()

	results := e.Evaluate(snapshot)
	if len(results) != 1 {
		t.Fatalf("expected 1 triggered, got %d", len(results))
	}
	if !results[0].Triggered {
		t.Error("expected rule to trigger on cpu AND memory condition")
	}
}

func TestCompileRuleValidation(t *testing.T) {
	// nil rule
	_, err := CompileRule(nil)
	if err == nil {
		t.Error("expected error for nil rule")
	}

	// empty ID
	_, err = CompileRule(&Rule{ID: "", Expression: `cpu > 80`})
	if err == nil {
		t.Error("expected error for empty ID")
	}

	// invalid expression
	_, err = CompileRule(&Rule{ID: "r1", Expression: `cpu <>`})
	if err == nil {
		t.Error("expected error for invalid expression")
	}
}
