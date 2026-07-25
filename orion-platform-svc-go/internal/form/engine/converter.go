package engine

import (
	"encoding/json"
	"fmt"
	"strconv"

	formengine "orion/go-common/pkg/form"
)

// =============================================================================
// Converter — maps service-layer FormFieldModel list to engine FormField slice
// =============================================================================
// The Converter reads service-layer model interfaces and produces engine
// FormField slices with full validation rules, options, and conditionals.

// ConvertServiceFields builds engine FormField slices from service-layer FormFieldModel list.
func ConvertServiceFields(fields []FormFieldModel) []formengine.FormField {
	result := make([]formengine.FormField, 0, len(fields))

	for _, f := range fields {
		result = append(result, convertField(f))
	}

	return result
}

// convertField maps a single service-layer field to an engine FormField.
func convertField(m FormFieldModel) formengine.FormField {
	ft := mapFieldType(m.Type())

	f := formengine.FormField{
		Key:         m.FieldID(),
		Label:       m.Label(),
		Hint:        "",
		Placeholder: m.Placeholder(),
		Type:        ft,
		Required:    m.Required(),
		Disabled:    false,
		ReadOnly:    m.ReadOnly(),
		Hidden:      !m.Visible(),
		Visible:     m.Visible(),
		Default:     resolveDefault(ft, m.DefaultValue()),
	}

	// Parse validation JSON for min/max/pattern
	parseValidation(&f, m.ValidationJSON())

	// Parse options JSON for select/radio/checkbox fields
	parseOptions(&f, m.OptionsJSON())

	// Parse dependency JSON for condition expressions
	parseDependency(&f, m.DependencyJSON())

	return f
}

// mapFieldType maps service-layer type strings to engine FieldTypes.
func mapFieldType(t string) formengine.FieldType {
	switch t {
	case "text", "input":
		return formengine.FieldTypeInput
	case "textarea":
		return formengine.FieldTypeTextArea
	case "number":
		return formengine.FieldTypeNumber
	case "select":
		return formengine.FieldTypeSelect
	case "multi-select", "multiselect":
		return formengine.FieldTypeMultiSelect
	case "cascader":
		return formengine.FieldTypeCascader
	case "date":
		return formengine.FieldTypeDate
	case "datetime", "date-time":
		return formengine.FieldTypeDateTime
	case "time":
		return formengine.FieldTypeInput // FieldTypeTime not defined in engine
	case "checkbox":
		return formengine.FieldTypeCheckbox
	case "radio":
		return formengine.FieldTypeRadio
	case "switch":
		return formengine.FieldTypeSwitch
	case "dict", "dictionary":
		return formengine.FieldTypeDict
	case "upload", "file":
		return formengine.FieldTypeUpload
	case "editor", "richtext", "rich-text", "markdown":
		return formengine.FieldTypeEditor
	case "user-select", "user":
		return formengine.FieldTypeUserSelect
	case "color":
		return formengine.FieldTypeColor
	case "divider":
		return formengine.FieldTypeDivider
	case "group":
		return formengine.FieldTypeGroup
	case "table":
		return formengine.FieldTypeTable
	default:
		return formengine.FieldTypeInput
	}
}

// parseValidation extracts min/max/pattern/min_length/max_length from validation JSON.
func parseValidation(f *formengine.FormField, validationJSON string) {
	if validationJSON == "" {
		return
	}

	var raw map[string]interface{}
	if err := json.Unmarshal([]byte(validationJSON), &raw); err != nil {
		return
	}

	// Min
	if v, ok := raw["min"]; ok {
		if p := toFloat64Val(v); p != nil {
			f.Min = p
		}
	}
	// Max
	if v, ok := raw["max"]; ok {
		if p := toFloat64Val(v); p != nil {
			f.Max = p
		}
	}
	// MinLength
	if v, ok := raw["min_length"]; ok {
		if i := toIntVal(v); i != nil {
			f.MinLength = i
		}
	}
	// MaxLength
	if v, ok := raw["max_length"]; ok {
		if i := toIntVal(v); i != nil {
			// Ensure MaxLength >= MinLength when both set
			if f.MinLength != nil && *i < *f.MinLength {
				f.MaxLength = f.MinLength
			} else {
				f.MaxLength = i
			}
		}
	}
	// Length (single value → both min and max)
	if v, ok := raw["length"]; ok {
		if i := toIntVal(v); i != nil {
			f.MinLength = i
			f.MaxLength = i
		}
	}
	// Pattern
	if v, ok := raw["pattern"]; ok {
		if s, ok := v.(string); ok {
			f.Pattern = s
		}
	}
	// PatternMsg
	if v, ok := raw["pattern_msg"]; ok {
		if s, ok := v.(string); ok {
			f.PatternMsg = s
		}
	}
	// RequiredMsg
	if v, ok := raw["required_msg"]; ok {
		if s, ok := v.(string); ok {
			f.RequiredMsg = s
		}
	}
}

// parseOptions extracts options from options JSON (array or object).
func parseOptions(f *formengine.FormField, optionsJSON string) {
	if optionsJSON == "" {
		return
	}

	// Try array format
	var arr []struct {
		Label    string                 `json:"label"`
		Value    string                 `json:"value"`
		Disabled bool                   `json:"disabled"`
		Meta     map[string]interface{} `json:"meta"`
		Children []struct {
			Label string `json:"label"`
			Value string `json:"value"`
		} `json:"children"`
	}
	if err := json.Unmarshal([]byte(optionsJSON), &arr); err == nil {
		opts := make([]formengine.FormFieldOption, 0, len(arr))
		for _, o := range arr {
			children := make([]formengine.FormFieldOption, 0)
			for _, ch := range o.Children {
				children = append(children, formengine.FormFieldOption{
					Key:   ch.Value,
					Label: ch.Label,
				})
			}
			opts = append(opts, formengine.FormFieldOption{
				Key:      o.Value,
				Label:    o.Label,
				Disabled: o.Disabled,
				Meta:     o.Meta,
				Children: children,
			})
		}
		// Deduplicate options by value
		seen := make(map[string]bool)
		deduped := make([]formengine.FormFieldOption, 0)
		for _, o := range opts {
			if !seen[o.Key] {
				seen[o.Key] = true
				deduped = append(deduped, o)
			}
		}
		f.Options = deduped
		return
	}

	// Try object format: {"key1": "label1", "key2": "label2"}
	var obj map[string]string
	if err := json.Unmarshal([]byte(optionsJSON), &obj); err == nil {
		opts := make([]formengine.FormFieldOption, 0, len(obj))
		for k, v := range obj {
			opts = append(opts, formengine.FormFieldOption{
				Key:   k,
				Label: v,
			})
		}
		f.Options = opts
		return
	}
}

// parseDependency extracts condition expressions from dependency JSON.
//
// Dependency format (from service layer):
// {
//   "visible_when": {"field": "type", "type": "equal", "value": "external"},
//   "required_when": {...},
//   "disabled_when": {...}
// }
// Or a single condition:
// {"field": "type", "type": "equal", "value": "external"}
func parseDependency(f *formengine.FormField, dependencyJSON string) {
	if dependencyJSON == "" {
		return
	}

	// Try nested format first
	var dep struct {
		VisibleWhen  *formengine.ConditionExpr `json:"visible_when"`
		RequiredWhen *formengine.ConditionExpr `json:"required_when"`
		DisabledWhen *formengine.ConditionExpr `json:"disabled_when"`
	}
	if err := json.Unmarshal([]byte(dependencyJSON), &dep); err == nil {
		if dep.VisibleWhen != nil {
			f.VisibleWhen = dep.VisibleWhen
		}
	if dep.RequiredWhen != nil {
			f.RequiredWhen = dep.RequiredWhen
		}
		if dep.DisabledWhen != nil {
			f.DisabledWhen = dep.DisabledWhen
		}
		return
	}

	// Try flat format (single condition → applies as visible_when)
	var cond formengine.ConditionExpr
	if err := json.Unmarshal([]byte(dependencyJSON), &cond); err == nil {
		if cond.Field != "" {
			f.VisibleWhen = &cond
		}
	}
}

// resolveDefault produces a typed default value based on field type.
func resolveDefault(ft formengine.FieldType, defaultValue string) interface{} {
	if defaultValue == "" {
		return typeDefault(string(ft))
	}

	switch ft {
	case formengine.FieldTypeNumber:
		if v, err := strconv.ParseFloat(defaultValue, 64); err == nil {
			return v
		}
	case formengine.FieldTypeCheckbox, formengine.FieldTypeSwitch:
		if defaultValue == "true" || defaultValue == "1" || defaultValue == "yes" {
			return true
		}
		return false
	case formengine.FieldTypeDate, formengine.FieldTypeDateTime:
		return defaultValue
	case formengine.FieldTypeInput, formengine.FieldTypeTextArea, formengine.FieldTypeEditor:
		return defaultValue
	case formengine.FieldTypeSelect, formengine.FieldTypeRadio, formengine.FieldTypeDict:
		return defaultValue
	case formengine.FieldTypeColor:
		return defaultValue
	case formengine.FieldTypeMultiSelect, formengine.FieldTypeCascader:
		// Try to parse as JSON array
		var arr []string
		if err := json.Unmarshal([]byte(defaultValue), &arr); err == nil {
			return arr
		}
		return defaultValue
	default:
		return defaultValue
	}

	return defaultValue
}

// toFloat64Val converts an interface{} to *float64.
func toFloat64Val(v interface{}) *float64 {
	switch n := v.(type) {
	case float64:
		return &n
	case float32:
		f := float64(n)
		return &f
	case int:
		f := float64(n)
		return &f
	case int64:
		f := float64(n)
		return &f
	case string:
		if f, err := strconv.ParseFloat(n, 64); err == nil {
			return &f
		}
	}
	return nil
}

// toIntVal converts an interface{} to *int.
func toIntVal(v interface{}) *int {
	switch n := v.(type) {
	case float64:
		i := int(n)
		return &i
	// int64:
	case int:
		return &n
	case int64:
		i := int(n)
		return &i
	case string:
		if i, err := strconv.Atoi(n); err == nil {
			return &i
		}
	}
	return nil
}

// jsonUnmarshal is a package-level helper for engine.go.
func jsonUnmarshal(data []byte, target interface{}) error {
	return json.Unmarshal(data, target)
}

// parseInterFieldRules parses cross-field rules from the raw fields JSON.
func parseInterFieldRules(form *formengine.Form, fieldsJSON string) {
	var fieldsRaw []map[string]interface{}
	if err := json.Unmarshal([]byte(fieldsJSON), &fieldsRaw); err != nil {
		return
	}

	var interRules []formengine.InterFieldRule

	for _, raw := range fieldsRaw {
		// Check for cross_field_rules
		if cfr, ok := raw["cross_field_rules"]; ok {
			var rules []formengine.InterFieldRule
			jsonData, _ := json.Marshal(cfr)
			if err := json.Unmarshal(jsonData, &rules); err == nil {
				interRules = append(interRules, rules...)
			}
		}
	}

	if len(interRules) > 0 {
		form.Rules = &formengine.FormRules{
			InterFieldRules: interRules,
		}
	}
}

// =============================================================================
// Condition evaluation helpers
// =============================================================================

// evaluateCondition evaluates a ConditionExpr against the form data.
func evaluateCondition(expr *formengine.ConditionExpr, data map[string]interface{}) bool {
	if expr == nil {
		return true
	}

	// Logic composition with nested groups
	if expr.Logic != "" && len(expr.Groups) > 0 {
		for _, g := range expr.Groups {
			result := evaluateCondition(&g, data)
			if expr.Logic == "or" && result {
				return true
			}
			if expr.Logic == "and" && !result {
				return false
			}
		}
		return expr.Logic == "or"
	}

	// Single condition evaluation
	return compareValues(data[expr.Field], expr.Value, expr.Type)
}

// compareValues compares actual value against expected using an operator.
func compareValues(actual, expected interface{}, op formengine.Operator) bool {
	actualStr := valToString(actual)
	expectedStr := valToString(expected)
	expectedNum := valToFloat64(expected)
	actualNum := valToFloat64(actual)

	switch op {
	case formengine.OpEqual:
		return actualStr == expectedStr
	case formengine.OpNotEqual:
		return actualStr != expectedStr
	case formengine.OpIn:
		if arr, ok := expected.([]interface{}); ok {
			for _, item := range arr {
				if valToString(item) == actualStr {
					return true
				}
			}
		}
		return false
	case formengine.OpNotIn:
		if arr, ok := expected.([]interface{}); ok {
			for _, item := range arr {
				if valToString(item) == actualStr {
					return false
				}
			}
			return true
		}
		return true
	case formengine.OpContains:
		return strContains(actualStr, expectedStr)
	case formengine.OpNotContains:
		return !strContains(actualStr, expectedStr)
	case formengine.OpGreater:
		if actualNum != nil && expectedNum != nil {
			return *actualNum > *expectedNum
		}
		return false
	default:
		return true
	}
}

// strContains is a safe substring check.
func strContains(s, substr string) bool {
	if len(substr) == 0 || len(s) < len(substr) {
		return substr == ""
	}
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

// valToString converts a value to string for comparison.
func valToString(val interface{}) string {
	if val == nil {
		return ""
	}
	if str, ok := val.(string); ok {
		return str
	}
	if num, ok := val.(float64); ok {
		return fmt.Sprintf("%g", num)
	}
	raw, err := json.Marshal(val)
	if err != nil {
		return fmt.Sprintf("%v", val)
	}
	return string(raw)
}

// valToFloat64 converts a value to *float64 for numeric comparison.
func valToFloat64(val interface{}) *float64 {
	if val == nil {
		return nil
	}
	switch v := val.(type) {
	case float64:
		return &v
	case int:
		f := float64(v)
		return &f
	case int64:
		// int64:
		f := float64(v)
		return &f
	}
	return nil
}
