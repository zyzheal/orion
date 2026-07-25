package service

import (
	"context"
	"testing"

	"orion/platform-svc-go/internal/condition/models"

	"go.uber.org/zap"
)

func newTestEngine() *ConditionEngine {
	logger := zap.NewNop()
	return &ConditionEngine{repo: nil, logger: logger}
}

func TestEvaluateExpression_Equals(t *testing.T) {
	e := newTestEngine()
	vars := map[string]interface{}{"name": "hello"}

	expr := &models.ConditionExpression{
		Field:    "name",
		Operator: "=",
		Value:    "hello",
	}
	result, err := e.EvaluateExpression(expr, vars)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result {
		t.Error("expected true for equal")
	}
}

func TestEvaluateExpression_NotEquals(t *testing.T) {
	e := newTestEngine()
	vars := map[string]interface{}{"name": "hello"}

	expr := &models.ConditionExpression{
		Field:    "name",
		Operator: "!=",
		Value:    "world",
	}
	result, err := e.EvaluateExpression(expr, vars)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result {
		t.Error("expected true for not equal")
	}
}

func TestEvaluateExpression_GreaterThan(t *testing.T) {
	e := newTestEngine()
	vars := map[string]interface{}{"age": float64(30)}

	expr := &models.ConditionExpression{
		Field:    "age",
		Operator: ">",
		Value:    "25",
	}
	result, err := e.EvaluateExpression(expr, vars)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result {
		t.Error("expected true for greater than")
	}
}

func TestEvaluateExpression_Contains(t *testing.T) {
	e := newTestEngine()
	vars := map[string]interface{}{"text": "hello world"}

	expr := &models.ConditionExpression{
		Field:    "text",
		Operator: "contains",
		Value:    "world",
	}
	result, err := e.EvaluateExpression(expr, vars)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result {
		t.Error("expected true for contains")
	}
}

func TestEvaluateExpression_Regex(t *testing.T) {
	e := newTestEngine()
	vars := map[string]interface{}{"email": "test@example.com"}

	expr := &models.ConditionExpression{
		Field:    "email",
		Operator: "regex",
		Value:    "^.*@.*\\..*$",
	}
	result, err := e.EvaluateExpression(expr, vars)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result {
		t.Error("expected true for regex match")
	}
}

func TestEvaluateExpression_IsNull(t *testing.T) {
	e := newTestEngine()
	vars := map[string]interface{}{"name": "hello"}

	expr := &models.ConditionExpression{
		Field:    "missing",
		Operator: "isNull",
	}
	result, err := e.EvaluateExpression(expr, vars)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result {
		t.Error("expected true for isNull")
	}
}

func TestEvaluateExpression_IsNotNull(t *testing.T) {
	e := newTestEngine()
	vars := map[string]interface{}{"name": "hello"}

	expr := &models.ConditionExpression{
		Field:    "name",
		Operator: "isNotNull",
	}
	result, err := e.EvaluateExpression(expr, vars)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result {
		t.Error("expected true for isNotNull")
	}
}

func TestEvaluateExpression_StartsWith(t *testing.T) {
	e := newTestEngine()
	vars := map[string]interface{}{"text": "hello world"}

	expr := &models.ConditionExpression{
		Field:    "text",
		Operator: "startsWith",
		Value:    "hello",
	}
	result, err := e.EvaluateExpression(expr, vars)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result {
		t.Error("expected true for startsWith")
	}
}

func TestEvaluateExpression_EndsWith(t *testing.T) {
	e := newTestEngine()
	vars := map[string]interface{}{"text": "hello world"}

	expr := &models.ConditionExpression{
		Field:    "text",
		Operator: "endsWith",
		Value:    "world",
	}
	result, err := e.EvaluateExpression(expr, vars)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result {
		t.Error("expected true for endsWith")
	}
}

func TestEvaluateExpression_InArray(t *testing.T) {
	e := newTestEngine()
	vars := map[string]interface{}{"color": "red"}

	expr := &models.ConditionExpression{
		Field:    "color",
		Operator: "in",
		Value:    `["red","green","blue"]`,
	}
	result, err := e.EvaluateExpression(expr, vars)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result {
		t.Error("expected true for in")
	}
}

func TestEvaluateExpression_Between(t *testing.T) {
	e := newTestEngine()
	vars := map[string]interface{}{"age": float64(25)}

	expr := &models.ConditionExpression{
		Field:    "age",
		Operator: "between",
		Value:    "20,30",
	}
	result, err := e.EvaluateExpression(expr, vars)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result {
		t.Error("expected true for between")
	}
}

func TestEvaluateExpression_Empty(t *testing.T) {
	e := newTestEngine()
	vars := map[string]interface{}{"text": ""}

	expr := &models.ConditionExpression{
		Field:    "text",
		Operator: "empty",
	}
	result, err := e.EvaluateExpression(expr, vars)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result {
		t.Error("expected true for empty")
	}
}

func TestEvaluateExpression_NotEmpty(t *testing.T) {
	e := newTestEngine()
	vars := map[string]interface{}{"text": "hello"}

	expr := &models.ConditionExpression{
		Field:    "text",
		Operator: "notEmpty",
	}
	result, err := e.EvaluateExpression(expr, vars)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result {
		t.Error("expected true for notEmpty")
	}
}

func TestEvaluateExpression_Matches(t *testing.T) {
	e := newTestEngine()
	vars := map[string]interface{}{"text": "hello123"}

	expr := &models.ConditionExpression{
		Field:    "text",
		Operator: "matches",
		Value:    "hello*",
	}
	result, err := e.EvaluateExpression(expr, vars)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result {
		t.Error("expected true for matches pattern")
	}
}

func TestEvaluateExpression_Disabled(t *testing.T) {
	e := newTestEngine()
	vars := map[string]interface{}{"name": "hello"}

	expr := &models.ConditionExpression{
		Field:    "name",
		Operator: "=",
		Value:    "world",
		Enabled:  false,
	}
	result, err := e.EvaluateExpression(expr, vars)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// Disabled expressions always return true
	if !result {
		t.Error("expected true for disabled expression")
	}
}

func TestEvaluateGroup_And(t *testing.T) {
	e := newTestEngine()
	vars := map[string]interface{}{"a": true, "b": true}

	group := &models.ConditionGroup{
		ID:      "g1",
		Name:    "and-group",
		Type:    "and",
		Enabled: true,
		Children: `[{"field":"a","operator":"=","value":"true","enabled":true},{"field":"b","operator":"=","value":"true","enabled":true}]`,
	}

	result, err := e.Evaluate(context.Background(), group, vars)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result {
		t.Error("expected true for AND group with all true")
	}
}

func TestEvaluateGroup_AndOneFalse(t *testing.T) {
	e := newTestEngine()
	vars := map[string]interface{}{"a": true, "b": false}

	group := &models.ConditionGroup{
		ID:      "g1",
		Name:    "and-group",
		Type:    "and",
		Enabled: true,
		Children: `[{"field":"a","operator":"=","value":"true","enabled":true},{"field":"b","operator":"=","value":"true","enabled":true}]`,
	}

	result, err := e.Evaluate(context.Background(), group, vars)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result {
		t.Error("expected false for AND group with one false")
	}
}

func TestEvaluateGroup_Or(t *testing.T) {
	e := newTestEngine()
	vars := map[string]interface{}{"a": false, "b": true}

	group := &models.ConditionGroup{
		ID:      "g1",
		Name:    "or-group",
		Type:    "or",
		Enabled: true,
		Children: `[{"field":"a","operator":"=","value":"true","enabled":true},{"field":"b","operator":"=","value":"true","enabled":true}]`,
	}

	result, err := e.Evaluate(context.Background(), group, vars)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result {
		t.Error("expected true for OR group with one true")
	}
}

func TestEvaluateGroup_OrAllFalse(t *testing.T) {
	e := newTestEngine()
	vars := map[string]interface{}{"a": false, "b": false}

	group := &models.ConditionGroup{
		ID:      "g1",
		Name:    "or-group",
		Type:    "or",
		Enabled: true,
		Children: `[{"field":"a","operator":"=","value":"true","enabled":true},{"field":"b","operator":"=","value":"true","enabled":true}]`,
	}

result, err := e.Evaluate(context.Background(), group, vars)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result {
		t.Error("expected false for OR group with all false")
	}
}

func TestEvaluateGroup_Not(t *testing.T) {
	e := newTestEngine()
	vars := map[string]interface{}{"a": true}

	group := &models.ConditionGroup{
		ID:      "g1",
		Name:    "not-group",
		Type:    "not",
		Enabled: true,
		Children: `[{"field":"a","operator":"=","value":"false","enabled":true}]`,
	}

	result, err := e.Evaluate(context.Background(), group, vars)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result {
		t.Error("expected true for NOT group (inner is false, so not = true)")
	}
}

func TestEvaluateGroup_EnabledFalse(t *testing.T) {
	e := newTestEngine()
	vars := map[string]interface{}{"a": true}

	group := &models.ConditionGroup{
		ID:      "g1",
		Name:    "disabled-group",
		Type:    "and",
		Enabled: false,
		Children: `[{"field":"a","operator":"=","value":"true","enabled":true}]`,
	}

	result, err := e.Evaluate(context.Background(), group, vars)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result {
		t.Error("expected false for disabled group")
	}
}

func TestEvaluateGroup_InvalidType(t *testing.T) {
	e := newTestEngine()
	vars := map[string]interface{}{}

	group := &models.ConditionGroup{
		ID:      "g1",
		Name:    "bad-group",
		Type:    "xor",
		Enabled: true,
		Children: `[]`,
	}

	_, err := e.Evaluate(context.Background(), group, vars)
	if err == nil {
		t.Error("expected error for unsupported group type")
	}
}

func TestEvaluateExpression_DotNotation(t *testing.T) {
	e := newTestEngine()
	vars := map[string]interface{}{
		"user": map[string]interface{}{
			"name": "Alice",
		},
	}

	expr := &models.ConditionExpression{
		Field:    "user.name",
		Operator: "=",
		Value:    "Alice",
	}
	result, err := e.EvaluateExpression(expr, vars)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result {
		t.Error("expected true for dot notation field")
	}
}

func TestEvaluateExpression_InvalidOperator(t *testing.T) {
	e := newTestEngine()
	vars := map[string]interface{}{}

	expr := &models.ConditionExpression{
		Field:    "name",
		Operator: "invalidOp",
		Value:    "test",
	}
	_, err := e.EvaluateExpression(expr, vars)
	if err == nil {
		t.Error("expected error for unsupported operator")
	}
}

func TestValidateGroupType(t *testing.T) {
	tests := []struct {
		name    string
		valid   bool
	}{
		{"and", true},
		{"or", true},
		{"not", true},
		{"xor", false},
		{"", false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := validateGroupType(tc.name)
			if tc.valid && err != nil {
				t.Errorf("expected valid group type %q but got error: %v", tc.name, err)
			}
			if !tc.valid && err == nil {
				t.Errorf("expected invalid group type %q but got no error", tc.name)
			}
		})
	}
}

func TestValidateOperator(t *testing.T) {
	validOps := []string{"=", "==", "!=", ">", ">=", "<", "<=", "contains", "regex", "in", "between", "isNull", "startsWith", "endsWith", "length", "empty", "notEmpty", "arrayContains", "jsonPath"}
	for _, op := range validOps {
		t.Run(op, func(t *testing.T) {
			err := validateOperator(op)
			if err != nil {
				t.Errorf("expected valid operator %q but got error: %v", op, err)
			}
		})
	}
}

func TestValidateField(t *testing.T) {
	err := validateField("")
	if err == nil {
		t.Error("expected error for empty field")
	}
	err = validateField("valid_field")
	if err != nil {
		t.Errorf("expected valid field but got error: %v", err)
	}
}
