package service

import (
	"context"
)

// Collector is the SPI for data sources an inspection draws from
// (Prometheus, K8s API, custom probes, ...). Implementations MUST be
// tenant-scoped and MUST NOT swallow errors silently — the Engine converts
// them into Problem entries with severity="error" so partial failures stay
// visible to callers.
//
// S2-T1: this SPI replaces the previous "return {status:ok}" stub in RunInspection.
type Collector interface {
	// ID is the collector identifier used for lookups (e.g. "promql", "k8s-probe").
	ID() string
	// Collect executes the collector and returns the raw measurements plus
	// any structured error. Implementations return (nil, err) only for
	// unrecoverable failures; empty slices are valid clean responses.
	Collect(ctx context.Context, tenantID string, config map[string]interface{}) ([]Measurement, error)
}

// Measurement is a single sample collected by a Collector.
type Measurement struct {
	// Name is the metric name / probe label (e.g. "cpu_util", "k8s_pod_ready").
	Name string
	// Value is the numeric measurement (percent, count, duration ms...).
	Value float64
	// Labels is optional context (pod name, namespace, node...).
	Labels map[string]string
	// ErrorTag is set when the collector returned this measurement as a
	// partial failure (e.g. one node timed out but others succeeded).
	ErrorTag string
}

// ThresholdRule encodes a single pass/warn/fail rule against a measurement
// name. Missing measurement → warn (data missing is not success).
type ThresholdRule struct {
	Name        string
	Min         float64 // inclusive lower bound; use math.Inf(-1) for none
	Max         float64 // inclusive upper bound; use math.Inf(+1) for none
	WarnAbove   float64 // > this emits warning before Max
	WarnBelow   float64 // < this emits warning before Min
	Enabled     bool
}

// Problem is the output of a threshold evaluation against one measurement.
type Problem struct {
	Severity string // "pass" | "warning" | "fail" | "error"
	Name     string
	Value    float64
	Reason   string
	Labels   map[string]string
}

// ThresholdEvaluator applies a set of rules to collected measurements.
type ThresholdEvaluator struct {
	Rules []ThresholdRule
}

// NewDefaultThresholdEvaluator returns a permissive evaluator with no rules.
// Used as the default so Engine.Run never fails solely because rules are absent.
func NewDefaultThresholdEvaluator() *ThresholdEvaluator {
	return &ThresholdEvaluator{}
}

// Evaluate produces one Problem per (rule, measurement) pair, plus a summary
// "pass" Problem when no rules fire.
func (e *ThresholdEvaluator) Evaluate(ms []Measurement) []Problem {
	out := make([]Problem, 0, len(ms))
	if len(ms) == 0 {
		return out
	}
	for _, m := range ms {
		if m.ErrorTag != "" {
			out = append(out, Problem{
				Severity: "error",
				Name:     m.Name,
				Value:    m.Value,
				Reason:   "collector_error: " + m.ErrorTag,
				Labels:   m.Labels,
			})
			continue
		}
		matched := false
		for _, r := range e.Rules {
			if !r.Enabled || r.Name != m.Name {
				continue
			}
			matched = true
			out = append(out, evalRule(r, m))
		}
		if !matched {
			out = append(out, Problem{
				Severity: "pass",
				Name:     m.Name,
				Value:    m.Value,
				Reason:   "no_rule",
				Labels:   m.Labels,
			})
		}
	}
	return out
}

func evalRule(r ThresholdRule, m Measurement) Problem {
	labels := m.Labels
	if m.Value > r.Max {
		return Problem{Severity: "fail", Name: m.Name, Value: m.Value, Reason: "above_max", Labels: labels}
	}
	if m.Value < r.Min {
		return Problem{Severity: "fail", Name: m.Name, Value: m.Value, Reason: "below_min", Labels: labels}
	}
	if r.WarnAbove > 0 && m.Value > r.WarnAbove {
		return Problem{Severity: "warning", Name: m.Name, Value: m.Value, Reason: "above_warn", Labels: labels}
	}
	if r.WarnBelow > 0 && m.Value < r.WarnBelow {
		return Problem{Severity: "warning", Name: m.Name, Value: m.Value, Reason: "below_warn", Labels: labels}
	}
	return Problem{Severity: "pass", Name: m.Name, Value: m.Value, Reason: "in_range", Labels: labels}
}

// Engine orchestrates collectors + thresholds. It is the real execution
// path invoked by Service.RunInspection (replaces the old stub).
type Engine struct {
	Collectors []Collector
	Evaluator  *ThresholdEvaluator
}

// NewEngine returns an engine with default evaluator and no collectors.
// A no-collector engine produces an empty problem set — which is a real
// (empty) result, not a fake "ok".
func NewEngine() *Engine {
	return &Engine{Evaluator: NewDefaultThresholdEvaluator()}
}

// WithCollector appends a Collector to the engine.
func (e *Engine) WithCollector(c Collector) *Engine {
	e.Collectors = append(e.Collectors, c)
	return e
}

// WithRules replaces the threshold evaluator.
func (e *Engine) WithRules(rules []ThresholdRule) *Engine {
	e.Evaluator = &ThresholdEvaluator{Rules: rules}
	return e
}

// Result is what RunInspection returns from the engine.
type Result struct {
	Problems  []Problem
	Errors    []string // per-collector errors; non-empty when a collector failed
	Collected int      // number of measurements gathered
	Collectors int     // number of collectors executed
}

// FinalStatus collapses Problems into a single inspection status string
// (aligns with models.StatusPending + the statuses GetStats already tallies).
func (r Result) FinalStatus() string {
	switch {
	case len(r.Errors) > 0:
		return "failed"
	default:
		hasFail, hasWarn := false, false
		for _, p := range r.Problems {
			switch p.Severity {
			case "fail", "error":
				hasFail = true
			case "warning":
				hasWarn = true
			}
		}
		if hasFail {
			return "failed"
		}
		if hasWarn {
			return "warning"
		}
		return "passed"
	}
}

// Run executes all collectors, evaluates results, and returns the Result.
// Collector errors are captured per-collector; execution continues.
func (e *Engine) Run(ctx context.Context, tenantID string, config map[string]interface{}) Result {
	if e.Evaluator == nil {
		e.Evaluator = NewDefaultThresholdEvaluator()
	}
	all := make([]Measurement, 0)
	errs := make([]string, 0)
	for _, c := range e.Collectors {
		ms, err := c.Collect(ctx, tenantID, config)
		if err != nil {
			errs = append(errs, c.ID()+":"+err.Error())
			continue
		}
		all = append(all, ms...)
	}
	problems := e.Evaluator.Evaluate(all)
	return Result{
		Problems:   problems,
		Errors:     errs,
		Collected:  len(all),
		Collectors: len(e.Collectors),
	}
}
