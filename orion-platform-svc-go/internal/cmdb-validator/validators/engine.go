package validators

import (
	"context"
	"fmt"
	"regexp"
	"sync"
	"time"
)

// CMDBValidator is the top-level orchestrator for CMDB record validation.
// It holds a registry of validator factories and a configurable set of
// built-in + plugin rules, and exposes a single ValidateRecord method.
type CMDBValidator struct {
	rules           []ValidationRuleEntry
	pluginFactories map[string]PluginValidatorFactory
	uniquenessChecker func(ctx context.Context, field, value string) (bool, error)
	opts            Options
	mu              sync.RWMutex
}

// Options holds configurable behaviour for the CMDBValidator.
type Options struct {
	// StopOnFirstError stops validation after the first failing rule.
	StopOnFirstError bool
	// Timeout is the maximum time allowed for a single record validation.
	Timeout time.Duration
	// MaxErrors caps the number of errors reported per record. Zero means unlimited.
	MaxErrors int
}

// ValidationRuleEntry couples a rule ID with its concrete validator.
type ValidationRuleEntry struct {
	RuleID         string
	RuleName       string
	Category       string
	TargetType     string
	Severity       string
	Condition      string
	ErrorMessage   string
	Validator      IValidator
}

// ValidationReport is the output of validating a single CMDB record.
type ValidationReport struct {
	RecordID   string          `json:"record_id"`
	TargetType string          `json:"target_type"`
	Passed     bool            `json:"passed"`
	Errors     []ValidationError `json:"errors"`
	Duration   time.Duration   `json:"duration"`
}

// ValidationError describes a single validation violation.
type ValidationError struct {
	RuleID   string `json:"rule_id"`
	RuleName string `json:"rule_name"`
	Category string `json:"category"`
	Field    string `json:"field,omitempty"`
	Message  string `json:"message"`
	Severity string `json:"severity"`
}

// RecordInput is the input format for bulk validation.
type RecordInput struct {
	ID         string                 `json:"id"`
	TargetType string                 `json:"target_type"`
	Data       map[string]interface{} `json:"data"`
}

// NewCMDBValidator creates a new validator with the given options.
func NewCMDBValidator(opts Options) *CMDBValidator {
	v := &CMDBValidator{
		rules:           make([]ValidationRuleEntry, 0),
		pluginFactories: make(map[string]PluginValidatorFactory),
		opts:            opts,
	}
	v.registerBuiltInRules()
	return v
}

// SetUniquenessChecker configures an external uniqueness checker used by the
// built-in uniqueness rule to query persisted data.
func (v *CMDBValidator) SetUniquenessChecker(f func(ctx context.Context, field, value string) (bool, error)) {
	v.mu.Lock()
	defer v.mu.Unlock()
	v.uniquenessChecker = f
}

// RegisterPlugin registers a custom validator factory for the given category.
// The factory is called whenever a record is validated against a rule in that category.
func (v *CMDBValidator) RegisterPlugin(category string, factory PluginValidatorFactory) {
	v.mu.Lock()
	defer v.mu.Unlock()
	v.pluginFactories[category] = factory
}

// AddRule registers a validation rule. The rule is matched by TargetType at validation time.
func (v *CMDBValidator) AddRule(ruleID, ruleName, category, targetType, condition, errorMessage, severity string) error {
	if severity == "" {
		severity = "error"
	}
	validator, err := v.buildValidator(category, condition, errorMessage)
	if err != nil {
		return fmt.Errorf("failed to build validator for rule %s: %w", ruleID, err)
	}
	v.mu.Lock()
	v.rules = append(v.rules, ValidationRuleEntry{
		RuleID:       ruleID,
		RuleName:     ruleName,
		Category:     category,
		TargetType:   targetType,
		Severity:     severity,
		Condition:    condition,
		ErrorMessage: errorMessage,
		Validator:    validator,
	})
	v.mu.Unlock()
	return nil
}

// RemoveRule removes a validation rule by its ID.
func (v *CMDBValidator) RemoveRule(ruleID string) {
	v.mu.Lock()
	defer v.mu.Unlock()
	for i, r := range v.rules {
		if r.RuleID == ruleID {
			v.rules = append(v.rules[:i], v.rules[i+1:]...)
			return
		}
	}
}

// ValidateRecord validates a single CMDB record against all applicable rules.
// Returns a ValidationReport with all errors if any rule fails.
func (v *CMDBValidator) ValidateRecord(ctx context.Context, recordID, targetType string, data map[string]interface{}) *ValidationReport {
	start := time.Now()
	report := &ValidationReport{
		RecordID:   recordID,
		TargetType: targetType,
		Passed:     true,
		Errors:     make([]ValidationError, 0),
	}

	if v.opts.Timeout > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, v.opts.Timeout)
		defer cancel()
	}

	v.mu.RLock()
	rules := make([]ValidationRuleEntry, len(v.rules))
	copy(rules, v.rules)
	v.mu.RUnlock()

	for _, entry := range rules {
		if entry.TargetType != targetType && entry.TargetType != "*" {
			continue
		}
		passed, msg := entry.Validator.Validate(ctx, data)
		if !passed {
			report.Passed = false
			ve := ValidationError{
				RuleID:   entry.RuleID,
				RuleName: entry.RuleName,
				Category: entry.Category,
				Message:  msg,
				Severity: entry.Severity,
			}
			ve.Field = v.extractField(msg, entry.Condition)
			report.Errors = append(report.Errors, ve)
			if v.opts.StopOnFirstError || (v.opts.MaxErrors > 0 && len(report.Errors) >= v.opts.MaxErrors) {
				break
			}
		}
	}

	report.Duration = time.Since(start)
	return report
}

// ValidateRecords validates multiple CMDB records and returns a list of reports.
func (v *CMDBValidator) ValidateRecords(ctx context.Context, records []RecordInput) []ValidationReport {
	reports := make([]ValidationReport, 0, len(records))
	for _, rec := range records {
		rpt := v.ValidateRecord(ctx, rec.ID, rec.TargetType, rec.Data)
		reports = append(reports, *rpt)
	}
	return reports
}

// buildValidator constructs a validator from a category, condition JSON, and error message.
// Built-in categories use concrete types; unknown categories delegate to plugins.
func (v *CMDBValidator) buildValidator(category, condition, errorMsg string) (IValidator, error) {
	switch category {
	case "format":
		return NewFormatValidator(category, condition, errorMsg), nil
	case "range":
		return NewRangeValidator(category, condition, errorMsg), nil
	case "reference":
		return NewReferenceValidator(category, condition, errorMsg), nil
	case "enum":
		return NewEnumValidator(category, condition, errorMsg), nil
	case "custom":
		return NewCustomValidator(category, condition, errorMsg), nil
	case "relationship":
		return NewRelationshipValidator(category, condition, errorMsg), nil
	case "uniqueness":
		return NewUniquenessValidator(category, condition, errorMsg, v.uniquenessChecker), nil
	case "required":
		return NewRequiredValidator(category, condition, errorMsg), nil
	case "cross_field":
		return NewCrossFieldValidator(category, condition, errorMsg), nil
	case "length":
		return NewLengthValidator(category, condition, errorMsg), nil
	default:
		v.mu.RLock()
		factory := v.pluginFactories[category]
		v.mu.RUnlock()
		if factory != nil {
			return factory(condition, errorMsg), nil
		}
		return nil, fmt.Errorf("no validator factory registered for category: %s", category)
	}
}

// extractField attempts to extract the field name from an error message or condition.
func (v *CMDBValidator) extractField(msg, condition string) string {
	if cond := ParseConditionOrEmpty(condition); cond != nil && cond.Field != "" {
		return cond.Field
	}
	m := regexp.MustCompile(`^[a-zA-Z_][a-zA-Z0-9_]*`)
	if idx := m.FindStringIndex(msg); idx != nil {
		return msg[idx[0]:idx[1]]
	}
	return ""
}

// ===========================================================================
// Built-in rule registration
// ===========================================================================

// registerBuiltInRules adds a set of sensible default validation rules.
func (v *CMDBValidator) registerBuiltInRules() {
	builtIns := []struct {
		ID           string
		Name         string
		Category     string
		TargetType   string
		Condition    string
		ErrorMessage string
		Severity     string
	}{
		// --- CI record required fields ---
		{"builtin-ci-name", "CI name is required", "required", "CI",
			`{"field":"name","operator":"not_null"}`, "CI name is required", "error"},
		{"builtin-ci-type", "CI type is required", "required", "CI",
			`{"field":"ci_type","operator":"not_null"}`, "CI type is required", "error"},
		// --- CI format rules ---
		{"builtin-ci-id-uuid", "CI id must be a valid UUID", "format", "CI",
			`{"field":"id","operator":"uuid"}`, "CI id must be a valid UUID", "error"},
		{"builtin-ci-email", "CI owner email format", "format", "CI",
			`{"field":"owner_email","operator":"email"}`, "owner_email must be a valid email address", "warning"},
		{"builtin-ci-url", "CI external URL format", "format", "CI",
			`{"field":"external_url","operator":"url"}`, "external_url must be a valid URL", "warning"},
		// --- CI range rules ---
		{"builtin-ci-version", "CI version must be positive", "range", "CI",
			`{"field":"version","operator":"gt","value":"0"}`, "version must be greater than 0", "warning"},
		// --- CI enum rules ---
		{"builtin-ci-status", "CI status must be valid", "enum", "CI",
			`{"field":"status","operator":"enum","enum_values":["active","retired","maintenance","planned"]}`,
			"status must be one of: active, retired, maintenance, planned", "error"},
		{"builtin-ci-lifecycle", "CI lifecycle state must be valid", "enum", "CI",
			`{"field":"lifecycle_state","operator":"enum","enum_values":["created","in_service","retired"]}`,
			"lifecycle_state must be one of: created, in_service, retired", "warning"},
		// --- Relationship rules ---
		{"builtin-rel-required", "Relationship required fields", "relationship", "relation",
			`{"field":"source_id","operator":"enum","enum_values":["depends_on","hosted_on","connected_to","uses","part_of"]}`,
			"relationship required fields missing", "error"},
		// --- Cross-field validation ---
		{"builtin-ci-deprecation", "CI deprecation consistency", "cross_field", "CI",
			`{"when":"status","equals":"retired","then":"deprecation_date","must":"not_null"}`,
			"retired CIs must have a deprecation_date", "warning"},
	}
	for _, bi := range builtIns {
		_ = v.AddRule(bi.ID, bi.Name, bi.Category, bi.TargetType, bi.Condition, bi.ErrorMessage, bi.Severity)
	}
}
