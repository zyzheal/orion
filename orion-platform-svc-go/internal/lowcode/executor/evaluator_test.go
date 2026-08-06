package executor

import (
	"testing"
)

func TestEvalExpression(t *testing.T) {
	tests := []struct {
		name    string
		expr    string
		vars    map[string]interface{}
		want    bool
		wantErr bool
	}{
		{"bare true", "true", nil, true, false},
		{"bare false", "false", nil, false, false},
		{"bare 1", "1", nil, true, false},
		{"bare 0", "0", nil, false, false},
		{"empty string", "", nil, false, false},
		{"string equals true", "var1 == \"passed\"", map[string]interface{}{"var1": "passed"}, true, false},
		{"string equals false", "var1 == \"passed\"", map[string]interface{}{"var1": "failed"}, false, false},
		{"string not equals", "var1 != \"failed\"", map[string]interface{}{"var1": "passed"}, true, false},
		{"numeric greater than", "count > 3", map[string]interface{}{"count": 5}, true, false},
		{"numeric greater than false", "count > 10", map[string]interface{}{"count": 3}, false, false},
		{"numeric less than", "count < 10", map[string]interface{}{"count": 3}, true, false},
		{"numeric lte", "count <= 5", map[string]interface{}{"count": 5}, true, false},
		{"numeric lte false", "count <= 4", map[string]interface{}{"count": 5}, false, false},
		{"numeric gte", "count >= 5", map[string]interface{}{"count": 5}, true, false},
		{"logical and true", "a > 1 && b < 10", map[string]interface{}{"a": 5, "b": 3}, true, false},
		{"logical and false", "a > 1 && b > 10", map[string]interface{}{"a": 5, "b": 3}, false, false},
		{"logical or true", "a > 1 || b > 10", map[string]interface{}{"a": 5, "b": 3}, true, false},
		{"logical or false", "a > 1 || b < 0", map[string]interface{}{"a": 0, "b": 3}, false, false},
		{"negation true", "!failed", map[string]interface{}{"failed": false}, true, false},
		{"negation false", "!ok", map[string]interface{}{"ok": true}, false, false},
		{"parentheses", "(a > 1) && (b < 10)", map[string]interface{}{"a": 5, "b": 3}, true, false},
		{"var with $", "$status == \"done\"", map[string]interface{}{"status": "done"}, true, false},
		{"var not found", "$missing", nil, false, true},
		{"unterminated string", "\"hello", nil, false, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := NewExecutionCtx("test")
			if tt.vars != nil {
				ctx.SetVars(tt.vars)
			}
			got, err := evalExpression(tt.expr, ctx)
			if (err != nil) != tt.wantErr {
				t.Errorf("evalExpression() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if got != tt.want {
				t.Errorf("evalExpression() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestToBool(t *testing.T) {
	tests := []struct {
		name string
		v    interface{}
		want bool
	}{
		{"bool true", true, true},
		{"bool false", false, false},
		{"string true", "true", true},
		{"string 1", "1", true},
		{"string other", "hello", false},
		{"float nonzero", float64(1.5), true},
		{"float zero", float64(0), false},
		{"int nonzero", 5, true},
		{"int zero", 0, false},
		{"nil", nil, false},
		{"object", map[string]string{}, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := toBool(tt.v); got != tt.want {
				t.Errorf("toBool() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestResolveIdent(t *testing.T) {
	ctx := NewExecutionCtx("test")
	ctx.SetVar("x", 42.0)

	val, err := resolveIdent("$x", ctx)
	if err != nil {
		t.Fatal(err)
	}
	if val != float64(42) {
		t.Errorf("resolveIdent() = %v, want 42", val)
	}

	val, err = resolveIdent("3.14", ctx)
	if err != nil {
		t.Fatal(err)
	}
	if val != 3.14 {
		t.Errorf("resolveIdent() = %v, want 3.14", val)
	}

	// bare name → context lookup
	val, err = resolveIdent("x", ctx)
	if err != nil {
		t.Fatal(err)
	}
	if val != 42.0 {
		t.Errorf("resolveIdent() = %v, want 42", val)
	}

	_, err = resolveIdent("$missing", ctx)
	if err == nil {
		t.Error("expected error for missing variable")
	}
}
