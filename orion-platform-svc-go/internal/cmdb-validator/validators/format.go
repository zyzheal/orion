package validators

import (
	"context"
	"regexp"
)

// FormatValidator checks that a field value matches a specified pattern/format.
type FormatValidator struct {
	name       string
	condition  *RuleCondition
	errorMsg   string
	patternRe  string
}

func NewFormatValidator(name, condition, errorMsg string) *FormatValidator {
	return &FormatValidator{name: name, condition: ParseConditionOrEmpty(condition), errorMsg: errorMsg}
}

// Type returns the validator type identifier.
func (v *FormatValidator) Type() string { return "format" }

// Validate checks the target field against the configured format/pattern.
func (v *FormatValidator) Validate(ctx context.Context, data map[string]interface{}) (bool, string) {
	_ = ctx
	if v.condition == nil {
		return true, "no condition configured"
	}

	field := v.condition.Field
	val, ok := getFieldValue(data, field)
	if !ok {
		return false, v.formatError(field, "field is missing")
	}
	strVal := asString(val)
	if strVal == "" && v.condition.Operator != "optional" {
		return false, v.formatError(field, "field is empty")
	}

	operator := v.condition.Operator
	switch operator {
	case "regex":
		re := v.condition.Pattern
		matched, err := regexp.MatchString(re, strVal)
		if err != nil {
			return false, v.formatError(field, "invalid regex pattern")
		}
		if !matched {
			return false, v.formatError(field, "does not match pattern "+re)
		}
	case "email":
		if !isValidEmail(strVal) {
			return false, v.formatError(field, "is not a valid email address")
		}
	case "url":
		if !isValidURL(strVal) {
			return false, v.formatError(field, "is not a valid URL")
		}
	case "uuid":
		if !isValidUUID(strVal) {
			return false, v.formatError(field, "is not a valid UUID")
		}
	case "ip":
		ip := strVal
		ipv4Re := `^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$`
		matched, _ := regexp.MatchString(ipv4Re, ip)
		ipv6Re := `^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$`
		if !matched {
			matched, _ = regexp.MatchString(ipv6Re, ip)
		}
		if !matched {
			return false, v.formatError(field, "is not a valid IP address")
		}
	case "optional":
		return true, ""
	case "":
		// Default: just check presence
		return ok && strVal != "", v.formatError(field, "is required")
	default:
		return false, v.formatError(field, "unknown format operator: "+operator)
	}
	return true, ""
}

func (v *FormatValidator) formatError(field, detail string) string {
	msg := v.errorMsg
	if msg == "" {
		msg = field + " " + detail
	}
	return msg
}

func parseOrEmpty(cond string) *RuleCondition {
	c, _ := parseCondition(cond)
	return c
}
