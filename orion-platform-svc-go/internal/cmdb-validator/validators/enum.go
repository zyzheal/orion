package validators

import (
	"context"
	"encoding/json"
	"strings"
)

// EnumValidator checks that a field value is one of a predefined set of values.
type EnumValidator struct {
	name      string
	condition *RuleCondition
	errorMsg  string
}

func NewEnumValidator(name, condition, errorMsg string) *EnumValidator {
	return &EnumValidator{name: name, condition: ParseConditionOrEmpty(condition), errorMsg: errorMsg}
}

// Type returns the validator type identifier.
func (v *EnumValidator) Type() string { return "enum" }

// Validate checks the target field against the allowed enum values.
func (v *EnumValidator) Validate(ctx context.Context, data map[string]interface{}) (bool, string) {
	_ = ctx
	if v.condition == nil {
		return true, "no condition configured"
	}

	field := v.condition.Field
	val, ok := getFieldValue(data, field)
	if !ok {
		return false, v.enumError(field, "field is missing")
	}

	strVal := asString(val)
	found := false
	for _, ev := range v.condition.EnumValues {
		if strings.EqualFold(strVal, ev) {
			found = true
			break
		}
	}
	if !found {
		allowed, _ := json.Marshal(v.condition.EnumValues)
		return false, v.enumError(field, "must be one of "+string(allowed))
	}
	return true, ""
}

func (v *EnumValidator) enumError(field, detail string) string {
	msg := v.errorMsg
	if msg == "" {
		msg = field + " " + detail
	}
	return msg
}
