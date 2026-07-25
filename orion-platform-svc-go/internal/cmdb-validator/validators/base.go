package validators

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
)

// ParseCondition unmarshals a JSON condition string into a RuleCondition.
// Returns nil when the input cannot be parsed (the caller handles the error).
func ParseCondition(cond string) (*RuleCondition, error) {
	return parseCondition(cond)
}

func parseCondition(cond string) (*RuleCondition, error) {
	if cond == "" {
		return nil, errors.New("empty condition")
	}
	var rc RuleCondition
	if err := json.Unmarshal([]byte(cond), &rc); err != nil {
		return nil, fmt.Errorf("invalid condition JSON: %w", err)
	}
	return &rc, nil
}

// IValidator is the interface all CMDB validators must implement.
type IValidator interface {
	Type() string
	Validate(ctx context.Context, data map[string]interface{}) (bool, string)
}

// PluginValidatorFactory creates a validator from a rule's condition JSON
// and error message. Plugins register factories for custom categories so
// that the CMDBValidator can instantiate validators at validation time.
//
// Example:
//   validator.RegisterPlugin("my_rule", func(condition, msg string) IValidator {
//       return &MyCustomValidator{condition: condition, msg: msg}
//   })
type PluginValidatorFactory func(condition, errorMsg string) IValidator


// RuleCondition holds the parsed JSON condition attached to a rule.
type RuleCondition struct {
	Field        string                 `json:"field"`
	Operator     string                 `json:"operator"`
	Value        string                 `json:"value"`
	Pattern      string                 `json:"pattern"`
	Min          json.Number            `json:"min"`
	Max          json.Number            `json:"max"`
	EnumValues   []string               `json:"enum_values"`
	TargetType   string                 `json:"target_type"`
	UniqueField  string                 `json:"unique_field"`
	Script       string                 `json:"script"`
	Dependencies map[string]interface{} `json:"dependencies"`
	// Cross-field condition keys stored as dependencies
	When   string `json:"when"`
	Equals string `json:"equals"`
	Then   string `json:"then"`
	Must   string `json:"must"`
}

// ParseConditionOrEmpty unmarshals a JSON condition string, returning nil on failure.
func ParseConditionOrEmpty(cond string) *RuleCondition {
	c, _ := parseCondition(cond)
	return c
}


// getFieldValue retrieves a value from the input data by field name.
func getFieldValue(data map[string]interface{}, field string) (interface{}, bool) {
	v, ok := data[field]
	return v, ok
}

// asString safely converts a value to string.
func asString(v interface{}) string {
	if v == nil {
		return ""
	}
	if s, ok := v.(string); ok {
		return s
	}
	return fmt.Sprintf("%v", v)
}

// asNumber safely converts a value to a float64.
func asNumber(v interface{}) (float64, bool) {
	switch t := v.(type) {
	case float64:
		return t, true
	case int:
		return float64(t), true
	case int64:
		return float64(t), true
	case json.Number:
		f, err := t.Float64()
		return f, err == nil
	case string:
		var f float64
		_, err := fmt.Sscanf(t, "%f", &f)
		return f, err == nil
	default:
		return 0, false
	}
}

// isValidEmail performs basic email validation.
func isValidEmail(email string) bool {
	re := regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)
	return re.MatchString(email)
}

// isValidURL performs basic URL validation.
func isValidURL(url string) bool {
	re := regexp.MustCompile(`^https?://[^\s/$.?#].[^\s]*$`)
	return re.MatchString(url)
}

// isValidUUID performs basic UUID v4 validation.
func isValidUUID(uuid string) bool {
	re := regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)
	return re.MatchString(uuid)
}
