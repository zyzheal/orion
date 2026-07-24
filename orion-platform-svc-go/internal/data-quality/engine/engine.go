package engine

import (
	"context"
	"errors"
	"log"
	"time"

	"orion/platform-svc-go/internal/data-quality/models"
	"orion/platform-svc-go/internal/data-quality/repository"
)

// Engine orchestrates data quality rule execution. It fetches active rules,
// evaluates them against live data (supplied by a DataProvider), persists
// scan results, auto-creates alerts on failure, and dispatches notifications.
type Engine struct {
	repo repository.RepositoryInterface
	svc  ServiceInterface
	eval *Evaluator
	opts EngineOptions
}

// ServiceInterface is the minimal service surface the Engine needs to interact
// with the business layer (auto-alert generation via service.CreateAlert).
type ServiceInterface interface {
	GetRule(ctx context.Context, tenantID, id string) (*models.Rule, error)
	CreateAlert(ctx context.Context, tenantID string, req *models.CreateAlertRequest) (*models.Alert, error)
}

// AlertNotifier dispatches a notification when a quality alert is raised.
type AlertNotifier interface {
	Notify(ctx context.Context, alert *models.Alert) error
}

// DataProvider returns the evaluation input for a given rule. It is the caller's
// responsibility to pull live metrics / row counts from the target table.
type DataProvider func(ctx context.Context, rule *models.Rule) (*EvaluationInput, error)

// ResultHandler is invoked after each rule evaluation to allow callers to observe
// or aggregate results. Optional - nil is safe.
type ResultHandler func(ctx context.Context, rule *models.Rule, result *models.ScanResult, alert *models.Alert)

// EngineResult summarises one engine invocation.
type EngineResult struct {
	RuleID        string
	ScanResult    *models.ScanResult
	Alert         *models.Alert
	EvaluationErr error
	PersistErr    error
}

// EngineOptions holds optional engine configuration.
type EngineOptions struct {
	// MaxConcurrent limits parallel rule execution (0 = default 1).
	MaxConcurrent int

	// AlertOnFail disables auto-alert creation when false (default true).
	AlertOnFail bool

	// NotifyOnFail skips notification dispatch when false (default true).
	NotifyOnFail bool

	// OnResult is called after each rule finishes (success or error).
	OnResult ResultHandler
}

// NewEngine builds a fully wired Engine. The Evaluator.OnEvaluate callback
// persists scan results, creates alerts on failure, and notifies the AlertNotifier.
func NewEngine(repo repository.RepositoryInterface, svc ServiceInterface, notifier AlertNotifier, opts ...EngineOptions) *Engine {
	options := EngineOptions{
		AlertOnFail:  true,
		NotifyOnFail: true,
		MaxConcurrent: 1,
	}
	if len(opts) > 0 {
		options = opts[0]
	}
	if options.MaxConcurrent <= 0 {
		options.MaxConcurrent = 1
	}

	eval := &Evaluator{
		OnEvaluate: func(ctx context.Context, rule *models.Rule, result *models.ScanResult, alert *models.Alert) error {
			// 1. Persist scan result (ID assigned by repository)
			if err := repo.CreateScanResult(ctx, result); err != nil {
				return err
			}
			// 2. Auto-create alert on failure
			if alert != nil && options.AlertOnFail {
				if alert.ScanResultID == "" {
					alert.ScanResultID = result.ID
				}
				_, err := svc.CreateAlert(ctx, rule.TenantID, &models.CreateAlertRequest{
					RuleID:       alert.RuleID,
					ScanResultID: alert.ScanResultID,
					Message:      alert.Message,
					Severity:     alert.Severity,
				})
				if err != nil {
					log.Printf("[data-quality] failed to auto-create alert for rule %s: %v", rule.ID, err)
				} else if options.NotifyOnFail && notifier != nil {
					if notifyErr := notifier.Notify(ctx, alert); notifyErr != nil {
						log.Printf("[data-quality] failed to notify alert %s: %v", alert.ID, notifyErr)
					}
				}
			}
			return nil
		},
	}

	return &Engine{
		repo: repo,
		svc:  svc,
		eval: eval,
		opts: options,
	}
}

// RunSingleRule executes one rule against live data and persists results.
func (e *Engine) RunSingleRule(ctx context.Context, tenantID, ruleID string, provider DataProvider) (*EngineResult, error) {
	result := &EngineResult{RuleID: ruleID}

	rule, err := e.svc.GetRule(ctx, tenantID, ruleID)
	if err != nil {
		return result, errors.New("rule not found: " + err.Error())
	}
	if rule.Status != "active" {
		return result, errors.New("rule is not active")
	}

	input, err := provider(ctx, rule)
	if err != nil {
		result.EvaluationErr = err
		return result, err
	}

	ev, err := e.eval.Evaluate(ctx, rule, input)
	if err != nil {
		result.EvaluationErr = err
		return result, err
	}
	result.ScanResult = ev.Result
	result.Alert = ev.Alert

	if perr := e.eval.Persist(ctx, rule, ev); perr != nil {
		// If evaluation succeeded but persistence failed, still return the scan result
		// so the caller can retry. Only surface as an error for the top-level caller.
		result.PersistErr = perr
		return result, perr
	}

	if e.opts.OnResult != nil {
		e.opts.OnResult(ctx, rule, ev.Result, ev.Alert)
	}

	return result, nil
}

// RunAllActiveRules executes all active rules for a tenant. When
// MaxConcurrent > 1 it runs via a worker pool. Per-rule errors are collected
// into the result slice; a non-empty aggregate error is returned when at
// least one rule failed.
func (e *Engine) RunAllActiveRules(ctx context.Context, tenantID string, provider DataProvider) ([]*EngineResult, error) {
	status := "active"
	rules, err := e.repo.ListRules(ctx, tenantID, &models.RuleFilter{Status: &status})
	if err != nil {
		return nil, err
	}

	if len(rules) == 0 {
		return nil, nil
	}

	results := make([]*EngineResult, len(rules))

	concurrency := e.opts.MaxConcurrent
	if concurrency <= 0 {
		concurrency = 1
	}

	type job struct {
		idx  int
		rule *models.Rule
	}
	type resultOut struct {
		idx    int
		result *EngineResult
	}

	jobs := make(chan job, len(rules))
	outCh := make(chan resultOut, len(rules))

	// Start workers
	for w := 0; w < concurrency; w++ {
		go func() {
			for j := range jobs {
				r := e.runOne(ctx, j.rule, provider)
				outCh <- resultOut{idx: j.idx, result: r}
			}
		}()
	}

	// Dispatch jobs
	for i, rule := range rules {
		jobs <- job{idx: i, rule: &rule}
	}
	close(jobs)

	// Collect results
	for range rules {
		o := <-outCh
		results[o.idx] = o.result
	}

	var firstErr error
	for _, r := range results {
		if r.EvaluationErr != nil {
			if firstErr == nil {
				firstErr = r.EvaluationErr
			}
		}
	}

	return results, firstErr
}

func (e *Engine) runOne(ctx context.Context, rule *models.Rule, provider DataProvider) *EngineResult {
	r := &EngineResult{RuleID: rule.ID}
	input, perr := provider(ctx, rule)
	if perr != nil {
		r.EvaluationErr = perr
		return r
	}
	ev, err := e.eval.Evaluate(ctx, rule, input)
	if err != nil {
		r.EvaluationErr = err
		return r
	}
	r.ScanResult = ev.Result
	r.Alert = ev.Alert
	r.PersistErr = e.eval.Persist(ctx, rule, ev)
	if e.opts.OnResult != nil {
		e.opts.OnResult(ctx, rule, ev.Result, ev.Alert)
	}
	return r
}

// CountResultStatus returns (passed, failed, errored) counts from a slice of EngineResults.
func CountResultStatus(results []*EngineResult) (passed, failed, errored int) {
	for _, r := range results {
		if r.ScanResult == nil {
			errored++
			continue
		}
		if r.ScanResult.Status == "pass" {
			passed++
		} else {
			failed++
		}
	}
	return
}

// TimestampFromResult returns the UTC timestamp of a scan result, or zero.
func TimestampFromResult(r *EngineResult) time.Time {
	if r == nil || r.ScanResult == nil {
		return time.Time{}
	}
	return r.ScanResult.CreatedAt
}

// DefaultDataProvider is a no-op provider that always returns empty input.
// Use it for quick smoke tests.
func DefaultDataProvider(_ context.Context, _ *models.Rule) (*EvaluationInput, error) {
	return &EvaluationInput{}, nil
}
