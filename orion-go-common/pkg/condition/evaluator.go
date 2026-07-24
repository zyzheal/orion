package condition

import (
	"errors"
	"fmt"
	"regexp"
	"strconv"
)

// Engine evaluates a ConditionGroup AST against input data.
type Engine struct {
	functions map[string]Function
}

// Function is a user-defined function.
type Function func(data map[string]interface{}, args []interface{}) (interface{}, error)

// NewEngine creates a new ConditionEngine with the default function set.
func NewEngine() *Engine {
	return &Engine{
		functions: buildDefaultFunctions(),
	}
}

// RegisterFunction registers a custom function.
func (e *Engine) RegisterFunction(name string, fn Function) {
	e.functions[name] = fn
}

// Evaluate evaluates a condition group against the given data.
func (e *Engine) Evaluate(group *ConditionGroup, data map[string]interface{}) (bool, error) {
	if data == nil {
		data = make(map[string]interface{})
	}
	return e.evalExpr(&ConditionExpr{IsGroup: true, Group: group}, data)
}

// EvaluateExpr evaluates a condition expression against the given data.
func (e *Engine) EvaluateExpr(expr *ConditionExpr, data map[string]interface{}) (bool, error) {
	if data == nil {
		data = make(map[string]interface{})
	}
	return e.evalExpr(expr, data)
}

// evalExpr evaluates a ConditionExpr.
func (e *Engine) evalExpr(expr *ConditionExpr, data map[string]interface{}) (bool, error) {
	if expr == nil {
		return false, errors.New("condition: expression is nil")
	}

	if expr.IsGroup {
		return e.evalGroup(expr.Group, data)
	}
	return e.evalCondition(expr.Cond, data)
}

// evalGroup evaluates a condition group (AND/OR).
func (e *Engine) evalGroup(group *ConditionGroup, data map[string]interface{}) (bool, error) {
	if group == nil {
		return false, errors.New("condition: group is nil")
	}

	switch group.Operator {
	case LogicalAnd:
		for _, expr := range group.Conditions {
			result, err := e.evalExpr(&expr, data)
			if err != nil {
				return false, err
			}
			if !result {
				return false, nil // Short-circuit on false
			}
		}
		return true, nil

	case LogicalOr:
		for _, expr := range group.Conditions {
			// Copy the value to avoid address reuse in the loop
			eCopy := expr
			result, err := e.evalExpr(&eCopy, data)
			if err != nil {
				return false, err
			}
			if result {
				return true, nil // Short-circuit on true
			}
		}
		return false, nil

	default:
		return false, ErrInvalidLogicalOperator
	}
}

// evalCondition evaluates a single condition.
func (e *Engine) evalCondition(cond *Condition, data map[string]interface{}) (bool, error) {
	if cond == nil {
		return false, errors.New("condition: condition is nil")
	}

	// Function operator calls a registered function
	if cond.Operator == OpFunc {
		return e.evalFunc(cond, data)
	}

	// Null check operators
	if cond.Operator == OpIsNull || cond.Operator == OpNotNull {
		return e.evalNullCheck(cond, data)
	}

	// Get the field value
	fieldVal, found := resolveFieldPath(data, cond.Field)
	if !found {
		return false, ErrFieldNotFound
	}

	return e.evalOperator(cond, fieldVal)
}

// evalOperator evaluates a comparison operator.
func (e *Engine) evalOperator(cond *Condition, fieldValue interface{}) (bool, error) {
	if len(cond.Values) == 0 {
		return false, ErrEmptyValues
	}

	switch cond.Operator {
	case OpEqual:
		return compareEqual(fieldValue, cond.Values[0])
	case OpNotEqual:
		return compareNotEqual(fieldValue, cond.Values[0])
	case OpGreater:
		return compareGreater(fieldValue, cond.Values[0])
	case OpLess:
		return compareLess(fieldValue, cond.Values[0])
	case OpGTE:
		return compareGreaterEqual(fieldValue, cond.Values[0])
	case OpLTE:
		return compareLessEqual(fieldValue, cond.Values[0])
	case OpIn:
		return compareIn(fieldValue, cond.Values)
	case OpNotIn:
		return compareNotIn(fieldValue, cond.Values)
	case OpBetween:
		if len(cond.Values) != 2 {
			return false, errors.New("operator 'between' requires exactly 2 values")
		}
		return compareBetween(fieldValue, cond.Values[0], cond.Values[1])
	case OpContains:
		return compareContains(fieldValue, cond.Values[0]), nil
	case OpNotContains:
		return !compareContains(fieldValue, cond.Values[0]), nil
	case OpStartsWith:
		return compareStartsWith(fieldValue, cond.Values[0]), nil
	case OpEndsWith:
		return compareEndsWith(fieldValue, cond.Values[0]), nil
	case OpRegex:
		return compareRegex(fieldValue, cond.Values[0])
	default:
		return false, ErrUnsupportedOperator
	}
}

// evalNullCheck evaluates null check operators.
func (e *Engine) evalNullCheck(cond *Condition, data map[string]interface{}) (bool, error) {
	_, found := resolveFieldPath(data, cond.Field)
	if !found {
		return cond.Operator == OpIsNull, nil
	}

	fieldVal, found := resolveFieldPath(data, cond.Field)
	if !found {
		return cond.Operator == OpIsNull, nil
	}

	if cond.Operator == OpIsNull {
		return isNil(fieldVal), nil
	}
	// is_not_null
	return !isNil(fieldVal), nil
}

// evalFunc evaluates a function call.
func (e *Engine) evalFunc(cond *Condition, data map[string]interface{}) (bool, error) {
	fn, ok := e.functions[cond.FuncName]
	if !ok {
		return false, ErrUnknownFunction
	}

	args := make([]interface{}, len(cond.Values))
	copy(args, cond.Values)

	result, err := fn(data, args)
	if err != nil {
		return false, err
	}

	if b, ok := result.(bool); ok {
		return b, nil
	}

	return !isNil(result), nil
}

// ---------------------------------------------------------------------------
// Comparison helpers
// ---------------------------------------------------------------------------

func compareEqual(a, b interface{}) (bool, error) {
	switch a.(type) {
	case string:
		return a == b, nil
	case float64, int, int64:
		return normalizeNumber(a) == normalizeNumber(b), nil
	case bool:
		return a == b, nil
	default:
		return a == b, nil
	}
}

func compareNotEqual(a, b interface{}) (bool, error) {
	eq, _ := compareEqual(a, b)
	return !eq, nil
}

func compareGreater(a, b interface{}) (bool, error) {
	av, ok := toNumber(a)
	if !ok {
		return false, ErrTypeMismatch
	}
	bv, ok := toNumber(b)
	if !ok {
		return false, ErrTypeMismatch
	}
	return av > bv, nil
}

func compareLess(a, b interface{}) (bool, error) {
	av, ok := toNumber(a)
	if !ok {
		return false, ErrTypeMismatch
	}
	bv, ok := toNumber(b)
	if !ok {
		return false, ErrTypeMismatch
	}
	return av < bv, nil
}

func compareGreaterEqual(a, b interface{}) (bool, error) {
	av, ok := toNumber(a)
	if !ok {
		return false, ErrTypeMismatch
	}
	bv, ok := toNumber(b)
	if !ok {
		return false, ErrTypeMismatch
	}
	return av >= bv, nil
}

func compareLessEqual(a, b interface{}) (bool, error) {
	av, ok := toNumber(a)
	if !ok {
		return false, ErrTypeMismatch
	}
	bv, ok := toNumber(b)
	if !ok {
		return false, ErrTypeMismatch
	}
	return av <= bv, nil
}

func compareIn(a interface{}, values []interface{}) (bool, error) {
	for _, v := range values {
		eq, _ := compareEqual(a, v)
		if eq {
			return true, nil
		}
	}
	return false, nil
}

func compareNotIn(a interface{}, values []interface{}) (bool, error) {
	for _, v := range values {
		eq, _ := compareEqual(a, v)
		if eq {
			return false, nil
		}
	}
	return true, nil
}

func compareBetween(a, min, max interface{}) (bool, error) {
	av, ok := toNumber(a)
	if !ok {
		return false, ErrTypeMismatch
	}
	mnv, ok := toNumber(min)
	if !ok {
		return false, ErrTypeMismatch
	}
	maxv, ok := toNumber(max)
	if !ok {
		return false, ErrTypeMismatch
	}
	return av >= mnv && av <= maxv, nil
}

func compareContains(a, b interface{}) bool {
	as, ok1 := toString(a)
	bs, ok2 := toString(b)
	if !ok1 || !ok2 {
		return false
	}
	return containsStr(as, bs)
}

func compareStartsWith(a, b interface{}) bool {
	as, ok1 := toString(a)
	bs, ok2 := toString(b)
	if !ok1 || !ok2 {
		return false
	}
	return startsWithStr(as, bs)
}

func compareEndsWith(a, b interface{}) bool {
	as, ok1 := toString(a)
	bs, ok2 := toString(b)
	if !ok1 || !ok2 {
		return false
	}
	return endsWithStr(as, bs)
}

func compareRegex(a, b interface{}) (bool, error) {
	pattern, ok := b.(string)
	if !ok {
		return false, ErrTypeMismatch
	}
	s, ok := toString(a)
	if !ok {
		return false, ErrTypeMismatch
	}
	re, err := regexp.Compile(pattern)
	if err != nil {
		return false, err
	}
	return re.MatchString(s), nil
}

// ---------------------------------------------------------------------------
// Type coercion helpers
// ---------------------------------------------------------------------------

func toNumber(v interface{}) (float64, bool) {
	switch t := v.(type) {
	case float64:
		return t, true
	case int:
		return float64(t), true
	case int64:
		return float64(t), true
	case string:
		f, err := strconv.ParseFloat(t, 64)
		if err != nil {
			return 0, false
		}
		return f, true
	default:
		return 0, false
	}
}

func normalizeNumber(v interface{}) float64 {
	switch t := v.(type) {
	case float64:
		return t
	case int:
		return float64(t)
	case int64:
		return float64(t)
	default:
		return 0
	}
}

func toString(v interface{}) (string, bool) {
	switch t := v.(type) {
	case string:
		return t, true
	case []byte:
		return string(t), true
	default:
		return fmt.Sprintf("%v", t), true
	}
}

// ---------------------------------------------------------------------------
// String helpers
// ---------------------------------------------------------------------------

func containsStr(s, substr string) bool {
	if substr == "" {
		return true
	}
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

func startsWithStr(s, prefix string) bool {
	if prefix == "" {
		return true
	}
	if len(s) < len(prefix) {
		return false
	}
	return s[:len(prefix)] == prefix
}

func endsWithStr(s, suffix string) bool {
	if suffix == "" {
		return true
	}
	if len(s) < len(suffix) {
		return false
	}
	return s[len(s)-len(suffix):] == suffix
}

// ---------------------------------------------------------------------------
// Default functions
// ---------------------------------------------------------------------------

func buildDefaultFunctions() map[string]Function {
	return map[string]Function{
		"length": func(_ map[string]interface{}, args []interface{}) (interface{}, error) {
			if len(args) == 0 {
				return 0, errors.New("length requires 1 argument")
			}
			switch t := args[0].(type) {
			case string:
				return float64(len(t)), nil
			case []interface{}:
				return float64(len(t)), nil
			case map[string]interface{}:
				return float64(len(t)), nil
			default:
				return 0, errors.New("length requires string, list, or map")
			}
		},
		"exists": func(data map[string]interface{}, args []interface{}) (interface{}, error) {
			if len(args) == 0 {
				return false, errors.New("exists requires 1 argument (field name)")
			}
			field, ok := args[0].(string)
			if !ok {
				return false, errors.New("exists requires field name as string")
			}
			_, found := resolveFieldPath(data, field)
			return found, nil
		},
		"true": func(_ map[string]interface{}, _ []interface{}) (interface{}, error) {
			return true, nil
		},
		"false": func(_ map[string]interface{}, _ []interface{}) (interface{}, error) {
			return false, nil
		},
	}
}
