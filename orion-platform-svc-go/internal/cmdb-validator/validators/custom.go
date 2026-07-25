package validators

import (
	"context"
	"encoding/json"
	"reflect"
	"strings"
)

// CustomValidator allows arbitrary custom validation logic via script or custom operator.
type CustomValidator struct {
	name      string
	condition *RuleCondition
	errorMsg  string
}

func NewCustomValidator(name, condition, errorMsg string) *CustomValidator {
	return &CustomValidator{name: name, condition: ParseConditionOrEmpty(condition), errorMsg: errorMsg}
}

// Type returns the validator type identifier.
func (v *CustomValidator) Type() string { return "custom" }

// Validate runs custom validation based on the condition operator.
func (v *CustomValidator) Validate(ctx context.Context, data map[string]interface{}) (bool, string) {
	_ = ctx
	if v.condition == nil {
		return true, "no condition configured"
	}

	field := v.condition.Field
	val, ok := getFieldValue(data, field)

	switch v.condition.Operator {
	case "non_empty":
		if !ok {
			return false, v.customError(field, "field is missing")
		}
		strVal := asString(val)
		if strVal == "" {
			return false, v.customError(field, "is empty")
		}
		return true, ""

	case "not_null":
		if !ok {
			return false, v.customError(field, "field is null")
		}
		return true, ""

	case "has_prefix":
		if !ok {
			return false, v.customError(field, "field is missing")
		}
		strVal := asString(val)
		prefix := v.condition.Value
		if !strings.HasPrefix(strVal, prefix) {
			return false, v.customError(field, "does not have prefix "+prefix)
		}
		return true, ""

	case "has_suffix":
		if !ok {
			return false, v.customError(field, "field is missing")
		}
		strVal := asString(val)
		suffix := v.condition.Value
		if !strings.HasSuffix(strVal, suffix) {
			return false, v.customError(field, "does not have suffix "+suffix)
		}
		return true, ""

	case "length_min":
		if !ok {
			return false, v.customError(field, "field is missing")
		}
		strVal := asString(val)
		minLen, err := json.Number(v.condition.Value).Int64()
		if err != nil {
			return false, v.customError(field, "invalid min length value")
		}
		if int64(len(strVal)) < minLen {
			return false, v.customError(field, "length is less than minimum "+v.condition.Value)
		}
		return true, ""

	case "length_max":
		if !ok {
			return false, v.customError(field, "field is missing")
		}
		strVal := asString(val)
		maxLen, err := json.Number(v.condition.Value).Int64()
		if err != nil {
			return false, v.customError(field, "invalid max length value")
		}
		if int64(len(strVal)) > maxLen {
			return false, v.customError(field, "length exceeds maximum "+v.condition.Value)
		}
		return true, ""

	case "contains":
		if !ok {
			return false, v.customError(field, "field is missing")
		}
		strVal := asString(val)
		contains := v.condition.Value
		if !strings.Contains(strVal, contains) {
			return false, v.customError(field, "does not contain "+contains)
		}
		return true, ""

	case "not_blank":
		if !ok {
			return false, v.customError(field, "field is blank")
		}
		strVal := asString(val)
		if strings.TrimSpace(strVal) == "" {
			return false, v.customError(field, "is blank")
		}
		return true, ""

	case "type_check":
		if !ok {
			return false, v.customError(field, "field is missing")
		}
		expected := v.condition.Value
		actual := reflect.TypeOf(val).Kind().String()
		if actual != expected {
			return false, v.customError(field, "expected type "+expected+" but got "+actual)
		}
		return true, ""

	default:
		// Unknown operator — pass through as informational
		return true, ""
	}
}

func (v *CustomValidator) customError(field, detail string) string {
	msg := v.errorMsg
	if msg == "" {
		msg = field + " " + detail
	}
	return msg
}
