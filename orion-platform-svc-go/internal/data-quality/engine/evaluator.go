package engine

import (
	"context"
	"errors"
	"fmt"
	"log"
	"regexp"
	"strings"
	"time"

	"orion/platform-svc-go/internal/data-quality/models"
)

// Evaluator evaluates a data quality rule against target data.
type Evaluator struct {
	// OnEvaluate is called after every rule evaluation to persist results and alerts.
	// signature: func(ctx context.Context, rule *models.Rule, result *models.ScanResult, alert *models.Alert) error
	// If alert is nil no alert should be created. Called synchronously.
	OnEvaluate func(ctx context.Context, rule *models.Rule, result *models.ScanResult, alert *models.Alert) error
}

// EvaluationInput holds the data supplied to the evaluator for a single rule run.
// The Evaluator is intentionally stateless so that the caller can fetch live
// metrics / rows and hand them in as Samples.
type EvaluationInput struct {
	// Samples is an ordered set of metric values to evaluate.  For threshold/range
	// checks each sample is expected to be numeric (parsed as float64).  For
	// pattern_match each sample is compared as a string.
	Samples []interface{}

	// Value is a convenience shortcut for single-value rules.  When set it is
	// used as the only sample.
	Value interface{}

	// MetricName is an optional human-readable name for the metric being checked.
	MetricName string
}

// EvaluationResult is the evaluator's in-memory result before persistence.
type EvaluationResult struct {
	Result *models.ScanResult
	Alert  *models.Alert
}

var (
	ErrUnsupportedType   = errors.New("unsupported rule type")
	ErrMissingExpression = errors.New("rule expression is required for this rule type")
)

// Evaluate runs rule against input and returns the ScanResult (+ optional Alert).
func (e *Evaluator) Evaluate(ctx context.Context, rule *models.Rule, input *EvaluationInput) (*EvaluationResult, error) {
	if rule == nil {
		return nil, errors.New("rule is nil")
	}
	if input == nil {
		input = &EvaluationInput{}
	}

	samples := input.Samples
	if input.Value != nil && len(samples) == 0 {
		samples = []interface{}{input.Value}
	}
	total := int64(len(samples))

	var passed, failed int64
	var errMsgs []string

	switch strings.ToLower(strings.TrimSpace(rule.RuleType)) {
	case "threshold_check":
		passed, failed, errMsgs = e.evaluateThreshold(ctx, rule, samples)
	case "range_check":
		passed, failed, errMsgs = e.evaluateRange(ctx, rule, samples)
	case "_check":
		// null_check: any nil/zero-value sample fails the rule.
		// A non-nil expression overrides to a regex match (e.g. "^[^\\s]+$" to reject blanks).
		passed, failed, errMsgs = e.evaluateNull(ctx, rule, samples)
	case "pattern_match":
		passed, failed, errMsgs = e.evaluatePattern(ctx, rule, samples)
		passed, failed, errMsgs = e.evaluatePattern(ctx, rule, samples)
	default:
		return nil, fmt.Errorf("%w: %s", ErrUnsupportedType, rule.RuleType)
	}

	now := time.Now().UTC()
	scanDate := now.Format("2006-01-02")
	passRate := 0.0
	if total > 0 {
		passRate = float64(passed) / float64(total) * 100
	}

	status := "pass"
	errorsStr := ""
	if failed > 0 {
		status = "fail"
		errorsStr = strings.Join(errMsgs, "; ")
	}

	result := &models.ScanResult{
		TenantID:      rule.TenantID,
		RuleID:        rule.ID,
		ScanDate:      scanDate,
		TotalRecords:  total,
		PassedRecords: passed,
		FailedRecords: failed,
		PassRate:      &passRate,
		Status:        status,
		Errors:        &errorsStr,
		CreatedAt:     now,
	}

	var alert *models.Alert
	if failed > 0 {
		msg := fmt.Sprintf("Data quality rule %q (%s) failed: %d/%d records did not pass",
			rule.Name, rule.ID, failed, total)
		if input.MetricName != "" {
			msg = fmt.Sprintf("[%s] %s", input.MetricName, msg)
		}
		alert = &models.Alert{
			TenantID:     rule.TenantID,
			RuleID:       rule.ID,
			ScanResultID: result.ID, // filled by repository; populated after persistence
			Message:      &msg,
			Severity:     rule.Severity,
			Status:       "open",
		}
		log.Printf("[data-quality] rule %s (%s) FAILED: %d/%d samples, severity=%s",
			rule.Name, rule.ID, failed, total, rule.Severity)
	} else {
		log.Printf("[data-quality] rule %s (%s) PASSED: %d/%d samples",
			rule.Name, rule.ID, passed, total)
	}

	return &EvaluationResult{Result: result, Alert: alert}, nil
}

// Persist hands the evaluation result to OnEvaluate (backed by the service/repo).
func (e *Evaluator) Persist(ctx context.Context, rule *models.Rule, ev *EvaluationResult) error {
	if e.OnEvaluate == nil {
		return nil
	}
	return e.OnEvaluate(ctx, rule, ev.Result, ev.Alert)
}

// --- rule type implementations ------------------------------------------------

func (e *Evaluator) evaluateThreshold(ctx context.Context, rule *models.Rule, samples []interface{}) (int64, int64, []string) {
	var passed, failed int64
	var errMsgs []string

	if rule.Expression == nil {
		return 0, int64(len(samples)), []string{ErrMissingExpression.Error()}
	}
	// Expected expression format: "above|below <threshold>".
	// If rule.Expression is absent but rule.Threshold is set, infer "below" (anomalously high threshold = fail).
	op := "below"
	threshold := *rule.Threshold
	ex := strings.TrimSpace(strings.ToLower(*rule.Expression))
	if strings.HasPrefix(ex, "above") {
		op = "above"
	} else if strings.HasPrefix(ex, "below") {
		op = "below"
	}

	for _, s := range samples {
		v, ok := toFloat64(s)
		if !ok {
			failed++
			errMsgs = append(errMsgs, fmt.Sprintf("non-numeric sample %v", s))
			continue
		}
		fail := (op == "above" && v > threshold) || (op == "below" && v < threshold)
		if fail {
			failed++
			errMsgs = append(errMsgs, fmt.Sprintf("value %g %s threshold %g", v, op, threshold))
		} else {
			passed++
		}
	}
	return passed, failed, errMsgs
}

func (e *Evaluator) evaluateRange(ctx context.Context, rule *models.Rule, samples []interface{}) (int64, int64, []string) {
	var passed, failed int64
	var errMsgs []string

	if rule.Expression == nil {
		// No range expression → use rule.Threshold as a symmetric bound around 0
		// (degenerate case; caller should normally set Expression "min,max").
		if rule.Threshold == nil {
			return 0, int64(len(samples)), []string{ErrMissingExpression.Error()}
		}
		low, high := -(*rule.Threshold), *rule.Threshold
		for _, s := range samples {
			p := checkRange(low, high, s)
			if p {
				passed++
			} else {
				failed++
				errMsgs = append(errMsgs, fmt.Sprintf("value %v outside range [%.4g, %.4g]", s, low, high))
			}
		}
		return passed, failed, errMsgs
	}

	// Parse expression "low,high".
	low, high, err := parseRange(*rule.Expression)
	if err != nil {
		return 0, int64(len(samples)), []string{fmt.Sprintf("invalid range expression: %v", err)}
	}
	for _, s := range samples {
		if checkRange(low, high, s) {
			passed++
		} else {
			failed++
			errMsgs = append(errMsgs, fmt.Sprintf("value %v outside range [%.4g, %.4g]", s, low, high))
		}
	}
	return passed, failed, errMsgs
}

func checkRange(low, high float64, s interface{}) bool {
	v, ok := toFloat64(s)
	if !ok {
		return false
	}
	return v >= low && v <= high
}

func parseRange(expr string) (float64, float64, error) {
	parts := strings.Split(expr, ",")
	if len(parts) != 2 {
		return 0, 0, fmt.Errorf("expected 'low,high', got %q", expr)
	}
	low, err := toFloat64Strict(strings.TrimSpace(parts[0]))
	if err != nil {
		return 0, 0, err
	}
	high, err := toFloat64Strict(strings.TrimSpace(parts[1]))
	if err != nil {
		return 0, 0, err
	}
	return low, high, nil
}

func (e *Evaluator) evaluatePattern(ctx context.Context, rule *models.Rule, samples []interface{}) (int64, int64, []string) {
	var passed, failed int64
	var errMsgs []string

	if rule.Expression == nil {
		return 0, int64(len(samples)), []string{ErrMissingExpression.Error()}
	}
	re, err := regexp.Compile(*rule.Expression)
	if err != nil {
		return 0, int64(len(samples)), []string{fmt.Sprintf("invalid regex %q: %v", *rule.Expression, err)}
	}

	// Severity "inverse" semantics: when the optional Threshold is 1.0 the regex is
	// treated as a denial pattern (match = fail).  Default (nil / 0) = allow pattern.
	deny := rule.Threshold != nil && *rule.Threshold == 1.0

	for _, s := range samples {
		str := fmt.Sprintf("%v", s)
		match := re.MatchString(str)
		fail := deny && match
		if !fail {
			// For allow-pattern, a non-match fails.
			if !deny && !match {
				fail = true
			}
		}
		if fail {
			failed++
			errMsgs = append(errMsgs, fmt.Sprintf("sample %q did not satisfy pattern %q", str, re.String()))
		} else {
			passed++
		}
	}
	return passed, failed, errMsgs
}

// --- null_check -------------------------------------------------------------------

func (e *Evaluator) evaluateNull(ctx context.Context, rule *models.Rule, samples []interface{}) (int64, int64, []string) {
	var passed, failed int64
	var errMsgs []string

	// Optional regex override: when an expression is set, treat it as a
	// "blank/dirty" regex that samples must NOT match (i.e. pattern must not appear).
	var blankRe *regexp.Regexp
	if rule.Expression != nil && *rule.Expression != "" {
		re, err := regexp.Compile(*rule.Expression)
		if err != nil {
			return 0, int64(len(samples)), []string{fmt.Sprintf("invalid null-check regex %q: %v", *rule.Expression, err)}
		}
		blankRe = re
	}

	for _, s := range samples {
		if s == nil {
			failed++
			errMsgs = append(errMsgs, fmt.Sprintf("null value in column %q", rule.TargetColumn))
			continue
		}
		if blankRe != nil {
			str := fmt.Sprintf("%v", s)
			if blankRe.MatchString(str) {
				failed++
				errMsgs = append(errMsgs, fmt.Sprintf("value %q matched blank pattern %q", str, blankRe.String()))
				continue
			}
		}
		passed++
	}
	return passed, failed, errMsgs
}

// --- helpers -------------------------------------------------------------------

func toFloat64(s interface{}) (float64, bool) {
	if f, ok := s.(float64); ok {
		return f, true
	}
	if f, ok := s.(float32); ok {
		return float64(f), true
	}
	if i, ok := s.(int); ok {
		return float64(i), true
	}
	if i, ok := s.(int64); ok {
		return float64(i), true
	}
	v, err := toFloat64Strict(fmt.Sprintf("%v", s))
	return v, err == nil
}

func toFloat64Strict(s string) (float64, error) {
	var v float64
	_, err := fmt.Sscanf(s, "%f", &v)
	if err != nil {
		return 0, err
	}
	return v, nil
}
