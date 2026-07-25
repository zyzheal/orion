package validators

import (
	"context"
)

// RequiredValidator checks that a required field is present and non-null.
// Condition operators: "not_null", "not_empty", "not_blank".
type RequiredValidator struct {
	name      string
	condition *RuleCondition
	errorMsg  string
}

func NewRequiredValidator(name, condition, errorMsg string) *RequiredValidator {
	return &RequiredValidator{
		name:      name,
		condition: ParseConditionOrEmpty(condition),
		errorMsg:  errorMsg,
	}
}

// Type returns the validator type identifier.
func (v *RequiredValidator) Type() string { return "required" }

// Validate checks that the target field satisfies the required operator.
func (v *RequiredValidator) Validate(ctx context.Context, data map[string]interface{}) (bool, string) {
	if v.condition == nil {
		return true, "no condition configured"
	}

	field := v.condition.Field
	if field == "" {
		return false, v.reqError("field", "field not configured in condition")
	}

	val, ok := getFieldValue(data, field)
	operator := v.condition.Operator

	switch operator {
	case "not_null", "":
		// Field must be present and not nil
		if !ok || val == nil {
			return false, v.reqError(field, "field is missing or null")
		}
	case "not_empty":
		// Field must be present and non-empty string
		if !ok || val == nil {
			return false, v.reqError(field, "field is missing")
		}
		strVal := asString(val)
		if strVal == "" {
			return false, v.reqError(field, "field is empty")
		}
	case "not_blank":
		// Field must be present and non-blank (whitespace trimmed)
		if !ok || val == nil {
			return false, v.reqError(field, "field is missing")
		}
		strVal := asString(val)
		trimmed := v.trimSpace(strVal)
		if trimmed == "" {
			return false, v.reqError(field, "field is blank")
		}
	default:
		return false, v.reqError(field, "unknown operator: "+operator)
	}

	return true, ""
}

func (v *RequiredValidator) reqError(field, detail string) string {
	if v.errorMsg != "" {
		return v.errorMsg
	}
	return field + " " + detail
}

func (v *RequiredValidator) trimSpace(s string) string {
	// Simple trim of leading/trailing whitespace
	for len(s) > 0 && (s[0] < 0x21) {
		s = s[1:]
	}
	for len(s) > 0 && (s[len(s)-1] < 0x21) {
		s = s[:len(s)-1]
	}
	return s
}
