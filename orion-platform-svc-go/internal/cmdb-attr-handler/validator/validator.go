// Package validator provides runtime validation rules for CMDB attribute values.
//
// It runs in addition to per-type validation (valhandlers) and enforces business
// rules such as allowed value ranges, requiredness, regex patterns, and allowed
// sets. The rules are expressed as a simple map[string]string rule set that can
// be serialised and persisted alongside a CI attribute definition.
//
// Supported rule keys (case-insensitive):
//
//   required       — "true"/"1" means value must not be empty
//   min            — minimum string length / minimum numeric value
//   max            — maximum string length / maximum numeric value
//   min_value      — minimum numeric value (distinct from min/length)
//   max_value      — maximum numeric value (distinct from max/length)
//   regex          — required PCRE-style regular expression to match
//   pattern        — alias for regex
//   allowed        — comma-separated list of allowed values (enum-like)
//   allowed_set    — JSON array of allowed values (enum-like, superset of allowed)
//   format         — named format: email | ip | ipv4 | ipv6 | uuid | url | date
//   nullable       — "false" means zero-value / empty is rejected
//   precision      — maximum total digits for numeric (e.g. "10")
//   scale          — maximum decimal places for numeric (e.g. "2")
//   case_insensitive — "true" makes allowed/allowed_set matching case-insensitive
package validator

import (
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"regexp"
	"strconv"
	"strings"

	"github.com/google/uuid"
	"go.uber.org/zap"
)

// ErrValidationFailed wraps validation rule failures from the Validator.
var ErrValidationFailed = errors.New("attribute value validation rule failed")

// RuleKeyNormalizer normalises a rule key to its canonical lower-case form.
func RuleKeyNormalizer(key string) string {
	return strings.ToLower(strings.TrimSpace(key))
}

// Validator validates an attribute value against a set of runtime rules.
//
// Rules are keyed by name (case-insensitive) and carry a string value. The
// Validator is immutable after construction and safe for concurrent use.
type Validator struct {
	logger *zap.Logger
}

// NewValidator creates a Validator that logs via the given logger.
// If logger is nil a no-op logger is used.
func NewValidator(logger *zap.Logger) *Validator {
	if logger == nil {
		logger, _ = zap.NewProduction()
	}
	return &Validator{logger: logger.Named("cmdb-attr-validator")}
}

// Validate validates value against the given rules for the declared dataType.
// Returns nil on success or a descriptive error wrapping ErrValidationFailed.
func (v *Validator) Validate(dataType, value string, rules map[string]string) error {
	if dataType == "" {
		return fmt.Errorf("%w: data type is required", ErrValidationFailed)
	}
	if rules == nil || len(rules) == 0 {
		return nil // no runtime rules — short-circuit
	}

	// Normalise rule keys to lower case.
	normalised := make(map[string]string, len(rules))
	for k, val := range rules {
		normalised[RuleKeyNormalizer(k)] = strings.TrimSpace(val)
	}

	ci := strings.EqualFold(normalised["case_insensitive"], "true")
	// required / nullable
	required := v.isTrue(normalised["required"])
	nullable := !v.isFalse(normalised["nullable"])
	if !nullable && value == "" {
		return fmt.Errorf("%w: value is required", ErrValidationFailed)
	}
	if required && value == "" {
		return fmt.Errorf("%w: value is required for type %s", ErrValidationFailed, dataType)
	}

	// allowed sets (enum-like constraint on ANY type)
	allowed := v.parseAllowed(normalised["allowed"], normalised["allowed_set"], ci)
	if allowed != nil && !v.contains(value, allowed) {
		return fmt.Errorf("%w: value %q not in allowed set %v", ErrValidationFailed, value, allowed)
	}

	// regex / pattern
	pattern := normalised["regex"]
	if pattern == "" {
		pattern = normalised["pattern"]
	}
	if pattern != "" {
		if !v.matchesRegex(value, pattern) {
			return fmt.Errorf("%w: value %q does not match pattern %q", ErrValidationFailed, value, pattern)
		}
	}

	// named format check
	if f := normalised["format"]; f != "" {
		if err := v.checkFormat(f, value); err != nil {
			return fmt.Errorf("%w: %v", ErrValidationFailed, err)
		}
	}

	// type-specific numeric / string constraints
	switch dataType {
	case "string":
		if err := v.checkStringRules(value, normalised); err != nil {
			return fmt.Errorf("%w: %v", ErrValidationFailed, err)
		}
	case "number":
		if err := v.checkNumberRules(value, normalised); err != nil {
			return fmt.Errorf("%w: %v", ErrValidationFailed, err)
		}
	case "boolean":
		if err := v.checkBooleanRules(value); err != nil {
			return fmt.Errorf("%w: %v", ErrValidationFailed, err)
		}
	case "datetime", "date":
		if err := v.checkDateRules(value, dataType, normalised); err != nil {
			return fmt.Errorf("%w: %v", ErrValidationFailed, err)
		}
	case "enum":
		if err := v.checkEnumRules(value, allowed, rules); err != nil {
			return fmt.Errorf("%w: %v", ErrValidationFailed, err)
		}
	case "reference":
		if err := v.checkReferenceRules(value, rules); err != nil {
			return fmt.Errorf("%w: %v", ErrValidationFailed, err)
		}
	case "json":
		if err := v.checkJSONRules(value); err != nil {
			return fmt.Errorf("%w: %v", ErrValidationFailed, err)
		}
	}

	return nil
}

// ---------------------------------------------------------------------------
// Rule parsing helpers
// ---------------------------------------------------------------------------

func (v *Validator) isTrue(val string) bool {
	return val == "true" || val == "1" || val == "yes" || val == "on"
}

func (v *Validator) isFalse(val string) bool {
	return val == "false" || val == "0" || val == "no" || val == "off"
}

func (v *Validator) parseAllowed(allowed, allowedSet string, ci bool) []string {
	if allowedSet != "" {
		var out []string
		if json.Unmarshal([]byte(allowedSet), &out) == nil {
			if ci {
				for i := range out {
					out[i] = strings.ToLower(out[i])
				}
			}
			return out
		}
	}
	if allowed != "" {
		parts := strings.Split(allowed, ",")
		out := make([]string, 0, len(parts))
		for _, p := range parts {
			p = strings.TrimSpace(p)
			// normalise whitespace inside value to single space
			p = strings.Join(strings.Fields(p), " ")
			if ci {
				p = strings.ToLower(p)
			}
			if p != "" {
				out = append(out, p)
			}
		}
		return out
	}
	return nil
}

func (v *Validator) contains(value string, allowed []string) bool {
	for _, a := range allowed {
		if value == a {
			return true
		}
	}
	return false
}

func (v *Validator) matchesRegex(value, pattern string) bool {
	matched, err := regexp.MatchString(pattern, value)
	if err != nil {
		v.logger.Warn("invalid regex pattern in validator rules",
			zap.String("pattern", pattern),
			zap.Error(err),
		)
		return false // fail closed on bad regex
	}
	return matched
}

// ---------------------------------------------------------------------------
// Named format checks
// ---------------------------------------------------------------------------

func (v *Validator) checkFormat(format, value string) error {
	switch strings.ToLower(format) {
	case "email":
		// Simple email shape check (not a full RFC 5322 parser).
		if !regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`).MatchString(value) {
			return fmt.Errorf("invalid email format: %q", value)
		}
	case "ip":
		if net.ParseIP(value) == nil {
			return fmt.Errorf("invalid IP address: %q", value)
		}
	case "ipv4":
		ip := net.ParseIP(value)
		if ip == nil || ip.To4() == nil {
			return fmt.Errorf("invalid IPv4 address: %q", value)
		}
	case "ipv6":
		ip := net.ParseIP(value)
		if ip == nil || ip.To4() != nil {
			return fmt.Errorf("invalid IPv6 address: %q", value)
		}
	case "uuid":
		if _, err := uuid.Parse(value); err != nil {
			return fmt.Errorf("invalid UUID: %q", value)
		}
	case "url":
		if !regexp.MustCompile(`^https?://[^\s]+$`).MatchString(value) {
			return fmt.Errorf("invalid URL format: %q", value)
		}
	case "date":
		if !regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`).MatchString(value) {
			return fmt.Errorf("invalid date format (expected YYYY-MM-DD): %q", value)
		}
	default:
		return fmt.Errorf("unknown format: %q", format)
	}
	return nil
}

// ---------------------------------------------------------------------------
// Type-specific rule checks
// ---------------------------------------------------------------------------

func (v *Validator) checkStringRules(value string, rules map[string]string) error {
	if min := rules["min"]; min != "" {
		n, err := strconv.Atoi(min)
		if err == nil && len(value) < n {
			return fmt.Errorf("string length %d < min %d", len(value), n)
		}
	}
	if max := rules["max"]; max != "" {
		n, err := strconv.Atoi(max)
		if err == nil && len(value) > n {
			return fmt.Errorf("string length %d > max %d", len(value), n)
		}
	}
	return nil
}

func (v *Validator) checkNumberRules(value string, rules map[string]string) error {
	n, err := strconv.ParseFloat(value, 64)
	if err != nil {
		return fmt.Errorf("invalid number: %w", err)
	}
	if min := rules["min"]; min != "" {
		mn, err := strconv.ParseFloat(min, 64)
		if err == nil && n < mn {
			return fmt.Errorf("value %.6g < min %.6g", n, mn)
		}
	}
	if max := rules["max"]; max != "" {
		mx, err := strconv.ParseFloat(max, 64)
		if err == nil && n > mx {
			return fmt.Errorf("value %.6g > max %.6g", n, mx)
		}
	}
	if minVal := rules["min_value"]; minVal != "" {
		mn, err := strconv.ParseFloat(minVal, 64)
		if err == nil && n < mn {
			return fmt.Errorf("value %.6g < min_value %.6g", n, mn)
		}
	}
	if maxVal := rules["max_value"]; maxVal != "" {
		mx, err := strconv.ParseFloat(maxVal, 64)
		if err == nil && n > mx {
			return fmt.Errorf("value %.6g > max_value %.6g", n, mx)
		}
	}
	if prec := rules["precision"]; prec != "" {
		p, err := strconv.Atoi(prec)
		if err == nil {
			intPart := fmt.Sprintf("%.0f", n)
			if len(strings.TrimPrefix(intPart, "-")) > p {
				return fmt.Errorf("value %g exceeds precision %d", n, p)
			}
		}
	}
	if scale := rules["scale"]; scale != "" {
		s, err := strconv.Atoi(scale)
		if err == nil {
			f := fmt.Sprintf("%.10g", n)
			if strings.Contains(f, ".") {
				dec := len(f[strings.Index(f, ".")+1:])
				if dec > s {
					return fmt.Errorf("value %g exceeds scale %d", n, s)
				}
			}
		}
	}
	return nil
}

func (v *Validator) checkBooleanRules(value string) error {
	if value == "" {
		return nil
	}
	switch {
	case value == "true", value == "false", value == "1", value == "0":
		return nil
	}
	return fmt.Errorf("invalid boolean value: %q", value)
}

func (v *Validator) checkDateRules(value, dataType string, rules map[string]string) error {
	if value == "" {
		return nil
	}
	// Basic ISO date / datetime shape
	re := regexp.MustCompile(`^\d{4}-\d{2}-\d{2}`)
	if !re.MatchString(value) {
		return fmt.Errorf("invalid %s format: %q", dataType, value)
	}
	// Optional min/max date bounds (YYYY-MM-DD)
	if min := rules["min"]; min != "" && value < min {
		return fmt.Errorf("value %q < min %q", value, min)
	}
	if max := rules["max"]; max != "" && value > max {
		return fmt.Errorf("value %q > max %q", value, max)
	}
	return nil
}

func (v *Validator) checkEnumRules(value string, allowed []string, rules map[string]string) error {
	// The allowed/allowed_set rules are already handled generically above.
	// This catches the case where enum options are passed via a special "options" key.
	if opt := rules["options"]; opt != "" {
		parts := strings.Split(opt, ",")
		for _, p := range parts {
			p = strings.TrimSpace(p)
			if p == value {
				return nil
			}
		}
		return fmt.Errorf("value %q not in enum options %q", value, opt)
	}
	return nil
}

func (v *Validator) checkReferenceRules(value string, rules map[string]string) error {
	if value == "" {
		return nil
	}
	if len(value) < 3 {
		return fmt.Errorf("reference value too short (min 3 chars): %q", value)
	}
	// Optionally enforce UUID shape
	if v.isTrue(rules["uuid"]) {
		if _, err := uuid.Parse(value); err != nil {
			return fmt.Errorf("reference is not a UUID: %q", value)
		}
	}
	return nil
}

func (v *Validator) checkJSONRules(value string) error {
	if value == "" {
		return nil
	}
	var out interface{}
	if err := json.Unmarshal([]byte(value), &out); err != nil {
		return fmt.Errorf("invalid JSON: %w", err)
	}
	return nil
}
