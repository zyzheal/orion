package condition

import (
	"fmt"
	"time"
)

// ConditionOperator defines supported comparison/logical operators.
type ConditionOperator string

const (
	// Comparison operators
	OpEqual     ConditionOperator = "=="
	OpNotEqual  ConditionOperator = "!="
	OpGreater   ConditionOperator = ">"
	OpLess      ConditionOperator = "<"
	OpGTE       ConditionOperator = ">="
	OpLTE       ConditionOperator = "<="

	// Aliases (canonical mapping happens in ParseDSL)
	OpEq      ConditionOperator = "eq"
	OpNeq     ConditionOperator = "neq"
	OpGt      ConditionOperator = "gt"
	OpLt      ConditionOperator = "lt"
	OpGte     ConditionOperator = "gte"
	OpLte     ConditionOperator = "lte"

	// Collection operators
	OpIn     ConditionOperator = "in"
	OpNotIn  ConditionOperator = "not_in"
	OpNin    ConditionOperator = "nin"
	OpBetween ConditionOperator = "between"

	// String operators
	OpContains      ConditionOperator = "contains"
	OpNotContains   ConditionOperator = "not_contains"
	OpStartsWith    ConditionOperator = "starts_with"
	OpEndsWith      ConditionOperator = "ends_with"
	OpRegex         ConditionOperator = "regex"

	// Null check operators
	OpIsNull    ConditionOperator = "is_null"
	OpNotNull   ConditionOperator = "is_not_null"

	// Function operator (calls registered custom function)
	OpFunc ConditionOperator = "func"

	// Logical group operators
	OpAnd ConditionOperator = "AND"
	OpOr  ConditionOperator = "OR"
)

// LogicalOperator for grouping
type LogicalOperator string

const (
	LogicalAnd LogicalOperator = "AND"
	LogicalOr  LogicalOperator = "OR"
)

// Condition represents a single atomic condition node.
type Condition struct {
	// Field path to evaluate (e.g., "alert.severity", "user.name")
	Field string `json:"field,omitempty"`

	// Operator to apply
	Operator ConditionOperator `json:"operator"`

	// Values for comparison (length depends on operator)
	Values []interface{} `json:"values"`

	// For operator "func": the function name to call
	FuncName string `json:"func_name,omitempty"`
}

// ConditionGroup represents a logical combination of conditions.
type ConditionGroup struct {
	// Logical operator for this group
	Operator LogicalOperator `json:"operator"`

	// Conditions in this group — can be Condition or nested ConditionGroup
	Conditions []ConditionExpr `json:"conditions"`
}

// ConditionExpr is the union type for AST nodes (Condition or ConditionGroup).
type ConditionExpr struct {
	IsGroup bool             `json:"is_group"`
	Group   *ConditionGroup  `json:"group,omitempty"`
	Cond    *Condition       `json:"condition,omitempty"`
}

// String returns a human-readable description of the condition.
func (c *Condition) String() string {
	if c.Operator == OpFunc {
		return fmt.Sprintf("func(%s)(%v)", c.FuncName, c.Values)
	}
	return fmt.Sprintf("%s %s %v", c.Field, c.Operator, c.Values)
}

// Validate checks that a Condition has valid fields for its operator.
func (c *Condition) Validate() error {
	if c.Operator == "" {
		return ErrMissingOperator
	}

	// Operator aliases (canonical form)
	canonical := normalizeOperator(c.Operator)
	c.Operator = canonical

	// "func" requires a function name
	if c.Operator == OpFunc {
		if c.FuncName == "" {
			return ErrMissingFuncName
		}
		if len(c.Values) == 0 {
			return ErrEmptyValues
		}
		return nil
	}

	// Null check operators require no values
	if c.Operator == OpIsNull || c.Operator == OpNotNull {
		if c.Field == "" {
			return ErrMissingField
		}
		return nil
	}

	// All other operators require field and values
	if c.Field == "" {
		return ErrMissingField
	}

	switch c.Operator {
	case OpBetween:
		if len(c.Values) != 2 {
			return fmt.Errorf("operator %s requires exactly 2 values", c.Operator)
		}
	default:
		if len(c.Values) == 0 {
			return ErrEmptyValues
		}
	}

	return nil
}

// Validate checks that a ConditionGroup has valid structure.
func (g *ConditionGroup) Validate() error {
	if g.Operator != LogicalAnd && g.Operator != LogicalOr {
		return ErrInvalidLogicalOperator
	}
	if len(g.Conditions) == 0 {
		return ErrEmptyConditions
	}
	for i, expr := range g.Conditions {
		if err := expr.Validate(); err != nil {
			return fmt.Errorf("condition[%d]: %w", i, err)
		}
	}
	return nil
}

// Validate checks the condition expression.
func (e *ConditionExpr) Validate() error {
	if e.IsGroup {
		if e.Group == nil {
			return ErrMissingGroup
		}
		return e.Group.Validate()
	}
	if e.Cond == nil {
		return ErrMissingCondition
	}
	return e.Cond.Validate()
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

var (
	ErrMissingOperator         = fmt.Errorf("condition: missing operator")
	ErrMissingField            = fmt.Errorf("condition: missing field")
	ErrEmptyValues             = fmt.Errorf("condition: empty values")
	ErrInvalidLogicalOperator  = fmt.Errorf("condition: invalid logical operator")
	ErrEmptyConditions         = fmt.Errorf("condition: empty conditions list")
	ErrMissingGroup            = fmt.Errorf("condition: missing group definition")
	ErrMissingCondition        = fmt.Errorf("condition: missing condition definition")
	ErrMissingFuncName         = fmt.Errorf("condition: missing func_name for func operator")
	ErrUnsupportedOperator     = fmt.Errorf("condition: unsupported operator")
	ErrInvalidFieldPath        = fmt.Errorf("condition: invalid field path")
	ErrTypeMismatch            = fmt.Errorf("condition: type mismatch")
	ErrUnknownFunction         = fmt.Errorf("condition: unknown function")
	ErrFieldNotFound           = fmt.Errorf("condition: field not found in input data")
)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// normalizeOperator converts operator aliases to canonical form.
func normalizeOperator(op ConditionOperator) ConditionOperator {
	switch op {
	case OpEq:
		return OpEqual
	case OpNeq:
		return OpNotEqual
	case OpGt:
		return OpGreater
	case OpLt:
		return OpLess
	case OpGte:
		return OpGTE
	case OpLte:
		return OpLTE
	case OpNin:
		return OpNotIn
	}
	return op
}

// splitFieldPath splits a dotted field path into segments.
func splitFieldPath(field string) []string {
	// Simple split on dots; does not support bracket notation
	var parts []string
	start := 0
	for i, ch := range field {
		if ch == '.' {
			parts = append(parts, field[start:i])
			start = i + 1
		}
	}
	parts = append(parts, field[start:])
	return parts
}

// resolveFieldPath traverses a nested map using a dotted field path.
// Returns the value and whether it was found.
func resolveFieldPath(data map[string]interface{}, field string) (interface{}, bool) {
	parts := splitFieldPath(field)
	current := interface{}(data)

	for _, part := range parts {
		switch v := current.(type) {
		case map[string]interface{}:
			val, ok := v[part]
			if !ok {
				return nil, false
			}
			current = val
		case map[string]string:
			val, ok := v[part]
			if !ok {
				return nil, false
			}
			current = val
		case map[string]int64:
			val, ok := v[part]
			if !ok {
				return nil, false
			}
			current = val
		default:
			return nil, false
		}
	}
	return current, true
}

// isNil checks whether a value is nil or a null/empty value.
func isNil(v interface{}) bool {
	if v == nil {
		return true
	}
	// Check common "empty" types
	switch t := v.(type) {
	case string:
		return t == ""
	case int, int64, float64:
		return false // numeric zero is still a value
	case bool:
		return false // false is still a value
	case time.Time:
		return t.IsZero()
	}
	return false
}
