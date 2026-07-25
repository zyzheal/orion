package validators

import (
	"context"
	"encoding/json"
	"fmt"
)

// RangeValidator checks that a numeric field falls within a configured range.
type RangeValidator struct {
	name      string
	condition *RuleCondition
	errorMsg  string
}

func NewRangeValidator(name, condition, errorMsg string) *RangeValidator {
	return &RangeValidator{name: name, condition: ParseConditionOrEmpty(condition), errorMsg: errorMsg}
}

// Type returns the validator type identifier.
func (v *RangeValidator) Type() string { return "range" }

// Validate checks that the target field's numeric value is within [min, max].
func (v *RangeValidator) Validate(ctx context.Context, data map[string]interface{}) (bool, string) {
	_ = ctx
	if v.condition == nil {
		return true, "no condition configured"
	}

	field := v.condition.Field
	val, ok := getFieldValue(data, field)
	if !ok {
		msg := v.errorMsg
		if msg == "" {
			msg = field + " is missing"
		}
		return false, msg
	}

	num, ok := asNumber(val)
	if !ok {
		msg := v.errorMsg
		if msg == "" {
			msg = field + " is not a number"
		}
		return false, msg
	}

	// Determine bounds from condition JSON
	var minVal, maxVal float64
	hasMin, hasMax := false, false

	if v.condition.Min != "" {
		f, _ := v.condition.Min.Float64()
		minVal = f
		hasMin = true
	}
	if v.condition.Value != "" {
		if maxF, err := json.Number(v.condition.Value).Float64(); err == nil {
			maxVal = maxF
			hasMax = true
		}
	}

	switch v.condition.Operator {
	case "gte":
		threshold, _ := json.Number(v.condition.Value).Float64()
		return num >= threshold, v.rangeError(field, num, "must be >= "+v.condition.Value)
	case "gt":
		threshold, _ := json.Number(v.condition.Value).Float64()
		return num > threshold, v.rangeError(field, num, "must be > "+v.condition.Value)
	}

	if !hasMin && !hasMax {
		return false, v.rangeError(field, num, "no valid range configured")
	}

	if hasMin && num < minVal {
		return false, v.rangeError(field, num, "below minimum "+fmt.Sprintf("%v", minVal))
	}
	if hasMax && num > maxVal {
		return false, v.rangeError(field, num, "above maximum "+fmt.Sprintf("%v", maxVal))
	}
	return true, ""
}

func (v *RangeValidator) rangeError(field string, val float64, detail string) string {
	msg := v.errorMsg
	if msg == "" {
		msg = field + " value "+fmt.Sprintf("%v", val)+" "+detail
	}
	return msg
}
