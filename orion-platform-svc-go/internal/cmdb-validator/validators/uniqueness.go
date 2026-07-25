package validators

import (
	"context"
)

// UniquenessValidator checks that a field value is unique within the dataset.
// The UniquenessChecker function is injected so the validator can verify against
// persisted data (e.g., the CMDB repository).
type UniquenessValidator struct {
	name      string
	condition *RuleCondition
	errorMsg  string
	// UniquenessChecker is an external callback to verify uniqueness against
	// persisted records. When nil, the validator falls back to in-memory checks.
	UniquenessChecker func(ctx context.Context, field, value string) (bool, error)
}

func NewUniquenessValidator(name, condition, errorMsg string, checker func(ctx context.Context, field, value string) (bool, error)) *UniquenessValidator {
	return &UniquenessValidator{
		name:              name,
		condition:         ParseConditionOrEmpty(condition),
		errorMsg:          errorMsg,
		UniquenessChecker: checker,
	}
}

// Type returns the validator type identifier.
func (v *UniquenessValidator) Type() string { return "uniqueness" }

// Validate checks that the field value is unique across all records.
func (v *UniquenessValidator) Validate(ctx context.Context, data map[string]interface{}) (bool, string) {
	if v.condition == nil {
		return true, "no condition configured"
	}

	field := v.condition.Field
	if field == "" {
		return true, "no field configured for uniqueness check"
	}

	val, ok := getFieldValue(data, field)
	if !ok {
		return false, v.uniqueError(field, "field is missing")
	}

	strVal := asString(val)
	if strVal == "" {
		return false, v.uniqueError(field, "is empty")
	}

	// If an external uniqueness checker is provided, use it (e.g., DB lookup)
	if v.UniquenessChecker != nil {
		exists, err := v.UniquenessChecker(ctx, field, strVal)
		if err != nil {
			return false, v.uniqueError(field, "uniqueness check failed: "+err.Error())
		}
		if exists {
			return false, v.uniqueError(field, strVal+" already exists")
		}
		return true, ""
	}

	// Fallback: check uniqueness within the provided data set itself
	// (only meaningful when a list of records is passed via special key)
	if items, ok := data["_items"].([]map[string]interface{}); ok {
		targetID := asString(data["_target_id"])
		for _, item := range items {
			if asString(item["_id"]) == targetID {
				continue
			}
			if asString(item[field]) == strVal {
				return false, v.uniqueError(field, strVal+" already exists in another record")
			}
		}
		return true, ""
	}

	return true, ""
}

func (v *UniquenessValidator) uniqueError(field, detail string) string {
	msg := v.errorMsg
	if msg == "" {
		msg = field + " " + detail
	}
	return msg
}
