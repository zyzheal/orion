package validators

import (
	"context"
	"encoding/json"
)

// LengthValidator checks that a string field's length falls within a configured range.
// Condition operators: "length_min", "length_max", "length_between".
type LengthValidator struct {
	name      string
	condition *RuleCondition
	errorMsg  string
}

func NewLengthValidator(name, condition, errorMsg string) *LengthValidator {
	return &LengthValidator{
		name:      name,
		condition: ParseConditionOrEmpty(condition),
		errorMsg:  errorMsg,
	}
}

// Type returns the validator type identifier.
func (v *LengthValidator) Type() string { return "length" }

// Validate checks the string length against the configured bounds.
func (v *LengthValidator) Validate(ctx context.Context, data map[string]interface{}) (bool, string) {
	if v.condition == nil {
		return true, "no condition configured"
	}

	field := v.condition.Field
	if field == "" {
		return false, v.lenError("field", "field not configured in condition")
	}

	val, ok := getFieldValue(data, field)
	if !ok || val == nil {
		// Only error if the operator requires presence
		if v.condition.Operator != "optional" {
			return false, v.lenError(field, "field is missing")
		}
		return true, ""
	}

	strVal := asString(val)
	length := len(strVal)

	operator := v.condition.Operator

	switch operator {
	case "length_min", "":
		minVal, _ := json.Number(v.condition.Value).Int64()
		if length < int(minVal) {
			return false, v.lenError(field, "length must be at least "+v.condition.Value)
		}
	case "length_max":
		maxVal, _ := json.Number(v.condition.Value).Int64()
		if length > int(maxVal) {
			return false, v.lenError(field, "length must be at most "+v.condition.Value)
		}
	case "length_between":
		minVal, _ := json.Number(v.condition.Value).Int64()
		// Max is stored in the Min field for JSON compatibility (Min holds min bound)
		maxVal, _ := json.Number(v.condition.Min).Int64()
		if length < int(minVal) {
			return false, v.lenError(field, "length must be at least "+v.condition.Value)
		}
		if length > int(maxVal) {
			return false, v.lenError(field, "length must be at most "+string(v.condition.Min))
		}
	case "equal":
		equalVal, _ := json.Number(v.condition.Value).Int64()
		if length != int(equalVal) {
			return false, v.lenError(field, "length must be exactly "+v.condition.Value)
		}
	case "optional":
		return true, ""
	default:
		return false, v.lenError(field, "unknown length operator: "+operator)
	}

	return true, ""
}

func (v *LengthValidator) lenError(field, detail string) string {
	if v.errorMsg != "" {
		return v.errorMsg
	}
	return field + " " + detail
}
