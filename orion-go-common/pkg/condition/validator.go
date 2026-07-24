package condition

import "fmt"

// Validate validates a ConditionGroup's structure.
func Validate(group *ConditionGroup) error {
	if group == nil {
		return fmt.Errorf("condition: group is nil")
	}
	return group.Validate()
}

// ValidateExpr validates a condition expression.
func ValidateExpr(expr *ConditionExpr) error {
	if expr == nil {
		return fmt.Errorf("condition: expression is nil")
	}
	return expr.Validate()
}

// ValidateCondition validates a single condition.
func ValidateCondition(cond *Condition) error {
	if cond == nil {
		return fmt.Errorf("condition: condition is nil")
	}
	return cond.Validate()
}

// CheckFieldPaths checks that all field paths in a group exist in the provided schema.
// schema is a map of valid field paths to their types (used for documentation/validation).
func CheckFieldPaths(group *ConditionGroup, schema map[string]string) error {
	return checkFieldPathsRecursive(group.Conditions, schema)
}

func checkFieldPathsRecursive(exprs []ConditionExpr, schema map[string]string) error {
	for i, expr := range exprs {
		if err := checkFieldPathsExpr(&expr, schema); err != nil {
			return fmt.Errorf("conditions[%d]: %w", i, err)
		}
	}
	return nil
}

func checkFieldPathsExpr(expr *ConditionExpr, schema map[string]string) error {
	if expr.IsGroup {
		return checkFieldPathsRecursive(expr.Group.Conditions, schema)
	}
	if expr.Cond == nil {
		return fmt.Errorf("condition is nil")
	}

	cond := expr.Cond

	// Function and null operators don't need field lookup
	if cond.Operator == OpFunc {
		return nil
	}
	if cond.Operator == OpIsNull || cond.Operator == OpNotNull {
		if cond.Field == "" {
			return fmt.Errorf("null check requires a field")
		}
		// Even null checks should validate the field exists in schema
		// (optional — comment out if you want null fields to always pass)
		_, ok := schema[cond.Field]
		if !ok {
			return fmt.Errorf("field %q not in schema", cond.Field)
		}
		return nil
	}

	if cond.Field == "" {
		return fmt.Errorf("condition requires a field")
	}

	_, ok := schema[cond.Field]
	if !ok {
		return fmt.Errorf("field %q not in schema", cond.Field)
	}

	return nil
}
