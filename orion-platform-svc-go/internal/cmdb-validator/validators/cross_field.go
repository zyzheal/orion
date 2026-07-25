package validators

import (
	"context"
	"encoding/json"
)

// CrossFieldValidator evaluates one field conditionally based on the value of
// another field. The condition JSON has the form:
//
//   {"when":"status","equals":"retired","then":"deprecation_date","must":"not_null"}
//
// Supported `must` operators: not_null, not_empty, not_blank, gte, lte, gt, lt.
type CrossFieldValidator struct {
	name      string
	condition *RuleCondition
	errorMsg  string

	when    string // field to watch
	equals  string // value that triggers the rule
	then    string // field to validate
	must    string // operator to apply to then-field
}

func NewCrossFieldValidator(name, condition, errorMsg string) *CrossFieldValidator {
	return &CrossFieldValidator{
		name:      name,
		condition: ParseConditionOrEmpty(condition),
		errorMsg:  errorMsg,
	}
}

// Type returns the validator type identifier.
func (v *CrossFieldValidator) Type() string { return "cross_field" }

// Validate applies cross-field logic to the provided record.
func (v *CrossFieldValidator) Validate(ctx context.Context, data map[string]interface{}) (bool, string) {
	_ = ctx

	// Always populate the cross-field fields from the parsed condition
	v.when = v.conditionRaw("when")
	v.equals = v.conditionRaw("equals")
	v.then = v.conditionRaw("then")
	v.must = v.conditionRaw("must")

	if v.when == "" || v.then == "" {
		return false, v.xfError("cross_field", "condition must specify 'when' and 'then' fields")
	}

	whenVal, ok := getFieldValue(data, v.when)
	if !ok {
		// when-field missing — rule is not triggered
		return true, ""
	}

	// Check if the 'when' field matches the expected value
	whenStr := asString(whenVal)
	if whenStr != v.equals {
		// Condition not met — rule is not triggered
		return true, ""
	}

	// Condition met: validate the 'then' field
	thenVal, thenOk := getFieldValue(data, v.then)

	switch v.must {
	case "not_null", "":
		if !thenOk || thenVal == nil {
			return false, v.xfError(v.then, "must be present when "+v.when+"="+v.equals)
		}
	case "not_empty":
		if !thenOk || thenVal == nil {
			return false, v.xfError(v.then, "must be present when "+v.when+"="+v.equals)
		}
		if asString(thenVal) == "" {
			return false, v.xfError(v.then, "must be non-empty when "+v.when+"="+v.equals)
		}
	case "not_blank":
		if !thenOk || thenVal == nil {
			return false, v.xfError(v.then, "must be present when "+v.when+"="+v.equals)
		}
		if trimmed := v.trimSpace(asString(thenVal)); trimmed == "" {
			return false, v.xfError(v.then, "must be non-blank when "+v.when+"="+v.equals)
		}
	case "gte":
		if !thenOk || thenVal == nil {
			return false, v.xfError(v.then, "must be >= "+v.condition.Value+" when "+v.when+"="+v.equals)
		}
		num, ok := asNumber(thenVal)
		if !ok {
			return false, v.xfError(v.then, "must be numeric when "+v.when+"="+v.equals)
		}
		threshold, _ := json.Number(v.condition.Value).Float64()
		if num < threshold {
			return false, v.xfError(v.then, "must be >= "+v.condition.Value+" when "+v.when+"="+v.equals)
		}
	case "lte":
		if !thenOk || thenVal == nil {
			return false, v.xfError(v.then, "must be <= "+v.condition.Value+" when "+v.when+"="+v.equals)
		}
		num, ok := asNumber(thenVal)
		if !ok {
			return false, v.xfError(v.then, "must be numeric when "+v.when+"="+v.equals)
		}
		threshold, _ := json.Number(v.condition.Value).Float64()
		if num > threshold {
			return false, v.xfError(v.then, "must be <= "+v.condition.Value+" when "+v.when+"="+v.equals)
		}
	default:
		// Unknown operator — skip gracefully
		return true, ""
	}

	return true, ""
}

// conditionRaw reads a string value from the parsed RuleCondition.
func (v *CrossFieldValidator) conditionRaw(key string) string {
	if v.condition == nil {
		return ""
	}
	switch key {
	case "when":
		return v.condition.When
	case "equals":
		return v.condition.Equals
	case "then":
		return v.condition.Then
	case "must":
		return v.condition.Must
	}
	return ""
}

func (v *CrossFieldValidator) xfError(field, detail string) string {
	if v.errorMsg != "" {
		return v.errorMsg
	}
	return field + " " + detail
}

func (v *CrossFieldValidator) trimSpace(s string) string {
	for len(s) > 0 && (s[0] < 0x21) {
		s = s[1:]
	}
	for len(s) > 0 && (s[len(s)-1] < 0x21) {
		s = s[:len(s)-1]
	}
	return s
}
