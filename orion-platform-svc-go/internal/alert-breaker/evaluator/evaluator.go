// Package evaluator implements the AlertBreaker evaluation logic
// (ADR-010 §3.2.3, 方案 B PG 持久化 + 行锁并发).
//
// The evaluator decides whether an incoming alert should be "broken"
// (suppressed) based on the AlertBreaker policy rule.
//
// Rule format (from AlertBreaker.Rule map[string]string):
//   - "threshold": "10"   — max alerts per window before breaking
//   - "window":    "600000" — window duration in milliseconds (default 10min)
//
// Evaluation flow:
//  1. Parse threshold + window from rule (default if missing).
//  2. Compute unique_key from (AlertID, Fingerprint) — same fingerprint
//     across alerts collapses into one counter.
//  3. Look up current state in alert_breaker_state.
//  4. If state is nil or window expired: start a new window (count=1).
//  5. Otherwise: increment existing count.
//  6. Persist via UpsertBreakerState (alertlock.WithTx Serializable).
//  7. Return Broken=true if count > threshold.
//
// The evaluator is read-mostly: the expensive path (UPSERT) is inside
// a Serializable transaction with FOR UPDATE row locks, so concurrent
// calls for the same (tenant, policy, unique_key) are serialized
// without deadlocking other policies.
package evaluator

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"orion/platform-svc-go/internal/alert-breaker/state_repository"
)

// DefaultThreshold is used when the rule has no "threshold" key.
const DefaultThreshold int64 = 5

// DefaultWindow is used when the rule has no "window" key. 10 minutes.
const DefaultWindow = 10 * time.Minute

// ErrInvalidRule is returned when the rule map cannot be parsed.
var ErrInvalidRule = errors.New("evaluator: invalid rule")

// ErrMissingThreshold is returned when the rule has a threshold that
// fails to parse as an integer.
var ErrMissingThreshold = errors.New("evaluator: missing/invalid threshold")

// ErrMissingWindow is returned when the rule has a window that fails
// to parse as an integer (milliseconds).
var ErrMissingWindow = errors.New("evaluator: missing/invalid window")

// Repository is the persistence interface the evaluator depends on.
// Implemented by *state_repository.Repository.
type Repository interface {
	GetByUniqueKey(ctx context.Context, tenantID string, policyID int64, uniqueKey string) (*state_repository.State, error)
	UpsertBreakerState(ctx context.Context, tenantID string, policyID int64, uniqueKey string, newCount int64, lastFingerprint string, newWindowStart, newWindowEnd *time.Time) (*state_repository.UpsertResult, error)
}

// Evaluator decides whether an alert is broken.
type Evaluator struct {
	repo Repository
	// now is injectable for tests. Defaults to time.Now.
	now func() time.Time
}

// NewEvaluator constructs an Evaluator. repo must not be nil.
func NewEvaluator(repo Repository) *Evaluator {
	if repo == nil {
		return nil
	}
	return &Evaluator{repo: repo, now: time.Now}
}

// WithClock overrides the clock function (for tests).
func (e *Evaluator) WithClock(fn func() time.Time) *Evaluator {
	if fn != nil {
		e.now = fn
	}
	return e
}

// EvaluationInput describes an incoming alert event.
type EvaluationInput struct {
	// TenantID scopes the breaker state (ADR-0004).
	TenantID string
	// PolicyID is the AlertBreaker rule ID (alert_breakers.id).
	PolicyID int64
	// AlertID is the source alert's identity. Used to build unique_key.
	AlertID string
	// Fingerprint is a stable hash of the alert's content. Two alerts
	// with the same fingerprint are treated as one event for counting.
	Fingerprint string
	// Rule is the AlertBreaker rule (map[string]string) from alert_breakers.
	Rule map[string]string
}

// EvaluationResult is the evaluator's decision.
type EvaluationResult struct {
	// Broken is true when the alert should be suppressed.
	Broken bool
	// Count is the current counter value after this evaluation.
	Count int64
	// WindowStart is the start of the current counting window.
	WindowStart time.Time
	// WindowEnd is the end of the current counting window.
	WindowEnd time.Time
	// Threshold is the rule's threshold.
	Threshold int64
	// Reason is a human-readable explanation (for logging/metrics).
	Reason string
}

// Evaluate decides whether the alert is broken.
func (e *Evaluator) Evaluate(ctx context.Context, in *EvaluationInput) (*EvaluationResult, error) {
	if e == nil {
		return nil, errors.New("evaluator: nil receiver")
	}
	if in == nil {
		return nil, errors.New("evaluator: nil input")
	}
	if in.TenantID == "" {
		return nil, errors.New("evaluator: empty tenantID")
	}
	if in.PolicyID <= 0 {
		return nil, fmt.Errorf("evaluator: invalid policyID %d", in.PolicyID)
	}

	threshold, err := parseThreshold(in.Rule)
	if err != nil {
		return nil, err
	}
	window, err := parseWindow(in.Rule)
	if err != nil {
		return nil, err
	}

	now := e.now()
	uniqueKey := BuildUniqueKey(in.AlertID, in.Fingerprint)

	state, err := e.repo.GetByUniqueKey(ctx, in.TenantID, in.PolicyID, uniqueKey)
	if err != nil && !errors.Is(err, state_repository.ErrNoState) {
		return nil, fmt.Errorf("evaluator: get state: %w", err)
	}

	var windowStart, windowEnd time.Time
	var newCount int64

	newWindow := state == nil || isWindowExpired(state, now)
	if newWindow {
		// Start a new window.
		windowStart = now
		windowEnd = now.Add(window)
		newCount = 1
	} else {
		if state.WindowStart != nil {
			windowStart = *state.WindowStart
		} else {
			windowStart = now
		}
		if state.WindowEnd != nil {
			windowEnd = *state.WindowEnd
		} else {
			windowEnd = now.Add(window)
		}
		newCount = state.Count + 1
	}

	// Persist the new state. alertlock.WithTx wraps in Serializable tx.
	_, err = e.repo.UpsertBreakerState(ctx, in.TenantID, in.PolicyID, uniqueKey,
		newCount, in.Fingerprint, &windowStart, &windowEnd)
	if err != nil {
		return nil, fmt.Errorf("evaluator: upsert state: %w", err)
	}

	broken := newCount > threshold
	reason := buildReason(broken, newCount, threshold, newWindow)

	return &EvaluationResult{
		Broken:      broken,
		Count:       newCount,
		WindowStart: windowStart,
		WindowEnd:   windowEnd,
		Threshold:   threshold,
		Reason:      reason,
	}, nil
}

// parseThreshold reads "threshold" from the rule. Returns DefaultThreshold
// if missing. Errors if the value is not a positive integer.
func parseThreshold(rule map[string]string) (int64, error) {
	if rule == nil {
		return DefaultThreshold, nil
	}
	raw, ok := rule["threshold"]
	if !ok || strings.TrimSpace(raw) == "" {
		return DefaultThreshold, nil
	}
	v, err := strconv.ParseInt(strings.TrimSpace(raw), 10, 64)
	if err != nil {
		return 0, fmt.Errorf("%w: %q: %v", ErrInvalidRule, raw, err)
	}
	if v <= 0 {
		return 0, fmt.Errorf("%w: threshold must be > 0, got %d", ErrMissingThreshold, v)
	}
	return v, nil
}

// parseWindow reads "window" from the rule. Returns DefaultWindow if missing.
// Value is in milliseconds.
func parseWindow(rule map[string]string) (time.Duration, error) {
	if rule == nil {
		return DefaultWindow, nil
	}
	raw, ok := rule["window"]
	if !ok || strings.TrimSpace(raw) == "" {
		return DefaultWindow, nil
	}
	ms, err := strconv.ParseInt(strings.TrimSpace(raw), 10, 64)
	if err != nil {
		return 0, fmt.Errorf("%w: %q: %v", ErrInvalidRule, raw, err)
	}
	if ms <= 0 {
		return 0, fmt.Errorf("%w: window must be > 0ms, got %d", ErrMissingWindow, ms)
	}
	return time.Duration(ms) * time.Millisecond, nil
}

// isWindowExpired reports whether the state's window has ended.
func isWindowExpired(state *state_repository.State, now time.Time) bool {
	if state == nil {
		return true
	}
	if state.WindowEnd == nil {
		return true
	}
	return now.After(*state.WindowEnd)
}

// BuildUniqueKey composes a stable key from AlertID + Fingerprint.
// Empty Fingerprint falls back to AlertID alone (single-key count).
func BuildUniqueKey(alertID, fingerprint string) string {
	if fingerprint == "" {
		return "alert:" + alertID
	}
	return "alert:" + alertID + ":fp:" + fingerprint
}

// buildReason produces a short human-readable explanation.
func buildReason(broken bool, count, threshold int64, newWindow bool) string {
	prefix := "count " + strconv.FormatInt(count, 10) + " vs threshold " + strconv.FormatInt(threshold, 10)
	if broken {
		return "BROKEN: " + prefix + " (suppressed)"
	}
	if newWindow {
		return "PASS: " + prefix + " (new window, first event)"
	}
	return "PASS: " + prefix
}
