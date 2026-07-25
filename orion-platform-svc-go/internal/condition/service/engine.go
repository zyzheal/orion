package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"regexp"
	"strconv"
	"strings"

	"orion/platform-svc-go/internal/condition/models"
	"orion/platform-svc-go/internal/condition/repository"

	"go.uber.org/zap"
)

// ConditionEngine provides condition group evaluation with nested condition groups.
type ConditionEngine struct {
	repo   *repository.Repository
	parser *ExpressionParser
	logger *zap.Logger
}

// NewConditionEngine creates a ConditionEngine with PostgreSQL repository.
func NewConditionEngine(repo *repository.Repository, logger *zap.Logger) *ConditionEngine {
	return &ConditionEngine{
		repo:   repo,
		parser: NewExpressionParser(logger),
		logger: logger,
	}
}

// Evaluate evaluates a condition group against given context/variables.
func (e *ConditionEngine) Evaluate(ctx context.Context, group *models.ConditionGroup, variables map[string]interface{}) (bool, error) {
	if !group.Enabled {
		return false, nil
	}

	switch strings.ToLower(group.Type) {
	case "and":
		return e.evaluateAnd(ctx, group, variables)
	case "or":
		return e.evaluateOr(ctx, group, variables)
	case "not":
		return e.evaluateNot(ctx, group, variables)
	}
	return false, fmt.Errorf("unsupported group type: %q", group.Type)
}

// EvaluateCondition evaluates a Condition (expression or group) against variables.
// This is the unified entry point that accepts both raw expressions and groups.
func (e *ConditionEngine) EvaluateCondition(cond *Condition, variables map[string]interface{}) (bool, error) {
	switch cond.Kind {
	case ConditionKindExpression:
		return e.EvaluateExpression(cond.Expr, variables)
	case ConditionKindGroup:
		return e.evaluateLogicalGroup(cond.Group, variables)
	default:
		return false, fmt.Errorf("unknown condition kind: %q", cond.Kind)
	}
}

// evaluateLogicalGroup evaluates a parsed LogicalGroup (AND/OR/NOT) AST.
func (e *ConditionEngine) evaluateLogicalGroup(g *LogicalGroup, variables map[string]interface{}) (bool, error) {
	if g == nil {
		return false, nil
	}
	switch g.Op {
	case "AND":
		l, err := e.EvaluateCondition(g.Left, variables)
		if err != nil {
			return false, err
		}
		if !l {
			return false, nil // short-circuit
		}
		r, err := e.EvaluateCondition(g.Right, variables)
		return r && l, err
	case "OR":
		l, err := e.EvaluateCondition(g.Left, variables)
		if err != nil {
			return false, err
		}
		if l {
			return true, nil // short-circuit
		}
		r, err := e.EvaluateCondition(g.Right, variables)
		return l || r, err
	case "NOT":
		result, err := e.EvaluateCondition(g.Left, variables)
		return !result, err
	}
	return false, fmt.Errorf("unsupported logical operator: %q", g.Op)
}

// ParseCondition parses a string condition expression into a Condition AST node.
// Supported syntax:
//   - Comparison:  field op value        e.g. "age > 18"
//   - Logical:     expr AND expr         e.g. "age > 18 AND name == 'admin'"
//   - Logical:     expr OR expr          e.g. "role == 'admin' OR role == 'root'"
//   - NOT:         NOT expr              e.g. "NOT active == false"
//   - Grouping:    (expr)               e.g. "(age > 18 AND role == 'admin')"
func (e *ConditionEngine) ParseCondition(input string) (*Condition, error) {
	return e.parser.Parse(input)
}

// EvaluateExpression evaluates a single condition expression.
func (e *ConditionEngine) EvaluateExpression(expr *models.ConditionExpression, variables map[string]interface{}) (bool, error) {
	if !expr.Enabled {
		return true, nil
	}

	fieldValue := getFieldValue(variables, expr.Field)
	op := strings.ToLower(expr.Operator)

	switch op {
	case "=", "==":
		return e.compareEqual(fieldValue, expr.Value, expr.ValueType)
	case "!=", "!":
		return e.compareNotEqual(fieldValue, expr.Value, expr.ValueType)
	case ">":
		return e.compareGreater(fieldValue, expr.Value)
	case ">=":
		return e.compareGreaterOrEqual(fieldValue, expr.Value)
	case "<":
		return e.compareLess(fieldValue, expr.Value)
	case "<=":
		return e.compareLessOrEqual(fieldValue, expr.Value)
		case "contains":
		return e.contains(fieldValue, expr.Value), nil
		case "notcontains":
		return !e.contains(fieldValue, expr.Value), nil
	case "regex":
		return e.matchesRegex(fieldValue, expr.Value), nil
		case "in":
		return e.inArray(fieldValue, expr.Value, false), nil
	case "notin":
		return e.inArray(fieldValue, expr.Value, true), nil
	case "between":
		return e.between(fieldValue, expr.Value)
	case "isnull", "null":
		return fieldValue == nil, nil
	case "isnotnull", "notnull":
		return fieldValue != nil, nil
	case "matches":
		return e.matchesPattern(fieldValue, expr.Value), nil
	case "startswith":
		return e.startsWith(fieldValue, expr.Value), nil
	case "endswith":
		return e.endsWith(fieldValue, expr.Value), nil
	case "length":
		return e.lengthEquals(fieldValue, expr.Value)
	case "empty":
		return e.isEmpty(fieldValue), nil
	case "notempty":
		return !e.isEmpty(fieldValue), nil
	case "arraycontains":
		return e.arrayContains(fieldValue, expr.Value), nil
	case "jsonpath":
		return e.jsonPath(fieldValue, expr.Value)
	}
	return false, fmt.Errorf("unsupported operator: %q", expr.Operator)
}

// === Group Evaluation ===

func (e *ConditionEngine) evaluateAnd(ctx context.Context, group *models.ConditionGroup, variables map[string]interface{}) (bool, error) {
	return e.evaluateChildren(ctx, group, variables, func(results []bool) (bool, error) {
		for _, r := range results {
			if !r {
				return false, nil
			}
		}
		return true, nil
	})
}

func (e *ConditionEngine) evaluateOr(ctx context.Context, group *models.ConditionGroup, variables map[string]interface{}) (bool, error) {
	return e.evaluateChildren(ctx, group, variables, func(results []bool) (bool, error) {
		for _, r := range results {
			if r {
				return true, nil
			}
		}
		return false, nil
	})
}

func (e *ConditionEngine) evaluateNot(ctx context.Context, group *models.ConditionGroup, variables map[string]interface{}) (bool, error) {
	result, err := e.evaluateChildren(ctx, group, variables, func(results []bool) (bool, error) {
		for _, r := range results {
			if !r {
				return false, nil
			}
		}
		return true, nil
	})
	return !result, err
}

func (e *ConditionEngine) evaluateChildren(ctx context.Context, group *models.ConditionGroup, variables map[string]interface{}, reduce func([]bool) (bool, error)) (bool, error) {
	var children []map[string]interface{}
	if err := json.Unmarshal([]byte(group.Children), &children); err != nil {
		return false, fmt.Errorf("invalid children JSON: %w", err)
	}

	if len(children) == 0 {
		exprs, err := e.repo.ListExpressions(ctx, group.TenantID, group.ID)
		if err != nil {
			return false, err
		}
		if len(exprs) == 0 {
			return true, nil
		}
		// evaluate expressions from database
		var r bool
		res := make([]bool, 0, len(exprs))
		for i := range exprs {
			r, err = e.EvaluateExpression(&exprs[i], variables)
			if err != nil {
				return false, err
			}
			res = append(res, r)
		}
		return reduce(res)
	}

	// evaluate children
	res := make([]bool, 0, len(children))
	for _, child := range children {
		if nested, ok := child["type"]; ok && child["children"] != nil {
			// Nested group
			nestedGroup := &models.ConditionGroup{
				ID:       toString(child["id"]),
				Name:     toString(child["name"]),
				Type:     toString(nested),
				Children: toJsonStr(child["children"]),
				Enabled:  child["enabled"] == true,
			}
			r, e2 := e.Evaluate(ctx, nestedGroup, variables)
			if e2 != nil {
				return false, e2
			}
			res = append(res, r)
		} else {
			// Expression
			expr := &models.ConditionExpression{
				Field:     toString(child["field"]),
				Operator:  toString(child["operator"]),
				Value:     toString(child["value"]),
				ValueType: toString(child["value_type"]),
				Enabled:   child["enabled"] == true,
			}
			r, e2 := e.EvaluateExpression(expr, variables)
			if e2 != nil {
				return false, e2
			}
			res = append(res, r)
		}
	}

	return reduce(res)
}

// === Comparison Operators ===

func (e *ConditionEngine) compareEqual(fieldValue interface{}, expected, valueType string) (bool, error) {
	if fieldValue == nil {
		return expected == "", nil
	}
	actual := normalizeValue(fieldValue, valueType)
	return fmt.Sprintf("%v", actual) == expected, nil
}

func (e *ConditionEngine) compareNotEqual(fieldValue interface{}, expected, valueType string) (bool, error) {
	if fieldValue == nil {
		return expected != "", nil
	}
	actual := normalizeValue(fieldValue, valueType)
	return fmt.Sprintf("%v", actual) != expected, nil
}

func (e *ConditionEngine) compareGreater(fieldValue interface{}, expected string) (bool, error) {
	actual, err := toNumber(fieldValue)
	if err != nil {
		// Fallback to string comparison
		return fmt.Sprintf("%v", fieldValue) > expected, nil
	}
	exp, _ := strconv.ParseFloat(expected, 64)
	return actual > exp, nil
}

func (e *ConditionEngine) compareGreaterOrEqual(fieldValue interface{}, expected string) (bool, error) {
	actual, err := toNumber(fieldValue)
	if err != nil {
		s := fmt.Sprintf("%v", fieldValue)
		return s >= expected, nil
	}
	exp, _ := strconv.ParseFloat(expected, 64)
	return actual >= exp, nil
}

func (e *ConditionEngine) compareLess(fieldValue interface{}, expected string) (bool, error) {
actual, err := toNumber(fieldValue)
	if err != nil {
		return fmt.Sprintf("%v", fieldValue) < expected, nil
	}
	exp, _ := strconv.ParseFloat(expected, 64)
	return actual < exp, nil
}

func (e *ConditionEngine) compareLessOrEqual(fieldValue interface{}, expected string) (bool, error) {
	actual, err := toNumber(fieldValue)
	if err != nil {
		s := fmt.Sprintf("%v", fieldValue)
		return s <= expected, nil
	}
	exp, _ := strconv.ParseFloat(expected, 64)
	return actual <= exp, nil
}

// === String Operators ===

func (e *ConditionEngine) contains(fieldValue interface{}, expected string) bool {
	return strings.Contains(fmt.Sprintf("%v", fieldValue), expected)
}

func (e *ConditionEngine) matchesRegex(fieldValue interface{}, pattern string) bool {
	re, err := regexp.Compile(pattern)
	if err != nil {
		return false
	}
	return re.MatchString(fmt.Sprintf("%v", fieldValue))
}

func (e *ConditionEngine) matchesPattern(fieldValue interface{}, pattern string) bool {
	pattern = strings.ReplaceAll(pattern, "*", ".*")
	return e.matchesRegex(fieldValue, "^"+pattern+"$")
}

func (e *ConditionEngine) startsWith(fieldValue interface{}, expected string) bool {
	return strings.HasPrefix(fmt.Sprintf("%v", fieldValue), expected)
}

func (e *ConditionEngine) endsWith(fieldValue interface{}, expected string) bool {
	return strings.HasSuffix(fmt.Sprintf("%v", fieldValue), expected)
}

func (e *ConditionEngine) lengthEquals(fieldValue interface{}, expected string) (bool, error) {
	s := fmt.Sprintf("%v", fieldValue)
	exp, err := strconv.Atoi(expected)
	if err != nil {
		return false, fmt.Errorf("invalid length value: %q", expected)
	}
	return len(s) == exp, nil
}

func (e *ConditionEngine) isEmpty(fieldValue interface{}) bool {
	switch v := fieldValue.(type) {
	case nil:
		return true
	case string:
		return v == ""
	case []interface{}:
		return len(v) == 0
	case []byte:
		return len(v) == 0
	}
	return false
}

// === Array Operators ===

func (e *ConditionEngine) inArray(fieldValue interface{}, valuesStr string, negate bool) bool {
	arr := parseArray(valuesStr)
	for _, v := range arr {
		if fmt.Sprintf("%v", fieldValue) == v {
			return !negate
		}
	}
	return negate
}

func (e *ConditionEngine) between(fieldValue interface{}, valueStr string) (bool, error) {
	parts := strings.Split(valueStr, ",")
	if len(parts) != 2 {
		return false, fmt.Errorf("between requires 'min,max' format, got %q", valueStr)
	}
	actual, err := toNumber(fieldValue)
	if err != nil {
		return false, fmt.Errorf("between requires numeric field, got %T", fieldValue)
	}
	minVal, err := strconv.ParseFloat(strings.TrimSpace(parts[0]), 64)
	if err != nil {
		return false, err
	}
	maxVal, err := strconv.ParseFloat(strings.TrimSpace(parts[1]), 64)
	if err != nil {
		return false, err
	}
	return actual >= minVal && actual <= maxVal, nil
}

func (e *ConditionEngine) arrayContains(fieldValue interface{}, expected string) bool {
	arr, ok := fieldValue.([]interface{})
	if !ok {
		return false
	}
	for _, v := range arr {
		if fmt.Sprintf("%v", v) == expected {
			return true
		}
	}
	return false
}

// === JSON Operators ===

func (e *ConditionEngine) jsonPath(fieldValue interface{}, valueStr string) (bool, error) {
	parts := strings.SplitN(valueStr, ":", 2)
	if len(parts) != 2 {
		return false, fmt.Errorf("jsonPath requires '$.path:expected' format, got %q", valueStr)
	}
	path := strings.TrimSpace(parts[0])
	expected := strings.TrimSpace(parts[1])

	obj, ok := fieldValue.(map[string]interface{})
	if !ok {
		return false, nil
	}

	actual, err := resolveJSONPath(obj, path)
	if err != nil {
		return false, nil
	}

	return fmt.Sprintf("%v", actual) == expected, nil
}

// === CRUD ===

// CreateGroup creates a new condition group.
func (e *ConditionEngine) CreateGroup(ctx context.Context, tenantID, name, groupType string, children []map[string]interface{}) (*models.ConditionGroup, error) {
	if err := validateGroupType(groupType); err != nil {
		return nil, err
	}
	return e.repo.CreateGroup(ctx, tenantID, name, groupType, children, nil, "")
}

// CreateExpression adds a condition expression to a group.
func (e *ConditionEngine) CreateExpression(ctx context.Context, tenantID, groupID string, field, operator, value string) (*models.ConditionExpression, error) {
	if err := validateOperator(operator); err != nil {
		return nil, err
	}
	if err := validateField(field); err != nil {
		return nil, err
	}
	return e.repo.CreateExpression(ctx, tenantID, groupID, field, operator, value, "string", nil)
}

// ListGroups lists condition groups for a tenant.
func (e *ConditionEngine) ListGroups(ctx context.Context, tenantID string) ([]models.ConditionGroup, error) {
	return e.repo.ListGroups(ctx, tenantID, "")
}

// GetGroup retrieves a group by ID.
func (e *ConditionEngine) GetGroup(ctx context.Context, tenantID, id string) (*models.ConditionGroup, error) {
	return e.repo.GetGroup(ctx, tenantID, id)
}

// DeleteGroup deletes a group.
func (e *ConditionEngine) DeleteGroup(ctx context.Context, tenantID, id string) error {
	return e.repo.DeleteGroup(ctx, tenantID, id)
}

// ListExpressions lists expressions for a group.
func (e *ConditionEngine) ListExpressions(ctx context.Context, tenantID, groupID string) ([]models.ConditionExpression, error) {
	return e.repo.ListExpressions(ctx, tenantID, groupID)
}

// === Helpers ===

func validateGroupType(t string) error {
	valid := map[string]bool{"and": true, "or": true, "not": true}
	if !valid[strings.ToLower(t)] {
		return fmt.Errorf("%w: %q. Must be 'and', 'or', or 'not'", ErrInvalidGroupType, t)
	}
	return nil
}

func validateOperator(op string) error {
	valid := map[string]bool{
		"=": true, "==": true, "!=": true, "!": true,
		">": true, ">=": true, "<": true, "<=": true,
		"contains": true, "notcontains": true, "regex": true,
		"in": true, "notin": true, "between": true,
		"isnull": true, "isnotnull": true, "matches": true,
		"startswith": true, "endswith": true, "length": true,
		"empty": true, "notempty": true, "arraycontains": true, "jsonpath": true,
	}
	if !valid[strings.ToLower(op)] {
		return fmt.Errorf("%w: %q", ErrInvalidOperator, op)
	}
	return nil
}

func validateField(field string) error {
	if field == "" {
		return fmt.Errorf("%w: field cannot be empty", ErrInvalidField)
	}
	if len(field) > 255 {
		return fmt.Errorf("%w: field too long (max 255)", ErrInvalidField)
	}
	return nil
}

func getFieldValue(variables map[string]interface{}, field string) interface{} {
	if val, ok := variables[field]; ok {
		return val
	}
	parts := strings.Split(field, ".")
	if len(parts) > 1 {
		return resolveNested(variables, parts)
	}
	return nil
}

func resolveNested(obj interface{}, path []string) interface{} {
	for _, p := range path {
		m, ok := obj.(map[string]interface{})
		if !ok {
			return nil
		}
		obj = m[p]
	}
	return obj
}

func resolveJSONPath(obj map[string]interface{}, path string) (interface{}, error) {
	path = strings.TrimPrefix(path, "$")
	parts := strings.Split(path, ".")
	for i, p := range parts {
		if i == len(parts)-1 {
			return obj[p], nil
		}
		next, ok := obj[p].(map[string]interface{})
		if !ok {
			return nil, fmt.Errorf("path segment %q not found", p)
		}
		obj = next
	}
	return nil, fmt.Errorf("invalid path")
}

func normalizeValue(v interface{}, valueType string) interface{} {
	switch valueType {
	case "number":
		if f, ok := v.(float64); ok {
			if f == math.Trunc(f) {
				return int64(f)
			}
			return f
		}
	case "boolean":
		if b, ok := v.(bool); ok {
			return b
		}
	}
	return v
}

func toNumber(v interface{}) (float64, error) {
	switch val := v.(type) {
	case float64:
		return val, nil
		case int64:
		return float64(val), nil
	case int:
		return float64(val), nil
	case string:
		return strconv.ParseFloat(val, 64)
	}
	return 0, fmt.Errorf("cannot convert %T to number", v)
}

func parseArray(s string) []string {
	var arr []string
	if err := json.Unmarshal([]byte(s), &arr); err == nil {
		return arr
	}
	if s == "" {
		return nil
	}
	return strings.Split(s, ",")
}

func toString(v interface{}) string {
	if v == nil {
		return ""
	}
	return fmt.Sprintf("%v", v)
}

func toJsonStr(v interface{}) string {
	if v == nil {
		return "[]"
	}
	if b, err := json.Marshal(v); err == nil {
		return string(b)
	}
	return "[]"
}

// Errors
var (
	ErrGroupNotFound         = errors.New("condition group not found")
	ErrExpressionNotFound    = errors.New("condition expression not found")
	ErrInvalidGroupType      = errors.New("invalid group type")
	ErrInvalidOperator       = errors.New("invalid operator")
	ErrInvalidField          = errors.New("invalid field")
)
