package validators

import (
	"context"
	"encoding/json"
)

// ReferenceValidator checks that a field value matches one of the allowed reference patterns.
type ReferenceValidator struct {
	name      string
	condition *RuleCondition
	errorMsg  string
}

func NewReferenceValidator(name, condition, errorMsg string) *ReferenceValidator {
	return &ReferenceValidator{name: name, condition: ParseConditionOrEmpty(condition), errorMsg: errorMsg}
}

// Type returns the validator type identifier.
func (v *ReferenceValidator) Type() string { return "reference" }

// Validate checks the target field against the configured reference constraints.
func (v *ReferenceValidator) Validate(ctx context.Context, data map[string]interface{}) (bool, string) {
	_ = ctx
	if v.condition == nil {
		return true, "no condition configured"
	}

	field := v.condition.Field
	val, ok := getFieldValue(data, field)
	if !ok {
		return false, v.refError(field, "field is missing")
	}

	if v.condition.Operator == "uuid" {
		strVal := asString(val)
		if strVal == "" {
			return false, v.refError(field, "is empty")
		}
		if !isValidUUID(strVal) {
			return false, v.refError(field, "is not a valid UUID reference")
		}
		return true, ""
	}

	if v.condition.Operator == "enum" {
		strVal := asString(val)
		found := false
		for _, ev := range v.condition.EnumValues {
			if strVal == ev {
				found = true
				break
			}
		}
		if !found {
			allowed, _ := json.Marshal(v.condition.EnumValues)
			return false, v.refError(field, "must be one of "+string(allowed))
		}
		return true, ""
	}

	return true, ""
}

func (v *ReferenceValidator) refError(field, detail string) string {
	msg := v.errorMsg
	if msg == "" {
		msg = field + " " + detail
	}
	return msg
}
