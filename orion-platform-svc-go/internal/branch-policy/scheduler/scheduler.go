// Package scheduler runs the periodic sync-policy execution loop.
//
// The design doc (docs/multi-branch-strategy-design-v2-impl-2026-09-08.md
// §3.5) specifies a 5-minute ticker that scans enabled policies, matches
// their CronExpr (or falls back to frequency-based MinInterval), and
// triggers RunNow for any that are due. This package wires that loop and
// exposes a testable Scheduler type so tests can inject a fake clock.
package scheduler

import (
	"context"
	"time"

	"go.uber.org/zap"
	"orion/platform-svc-go/internal/branch-policy/models"
	"orion/platform-svc-go/internal/branch-policy/service"
)

// DefaultTick is the interval between scheduler scans. 5 minutes matches
// the design doc §3.5 specification.
const DefaultTick = 5 * time.Minute

// SyncPolicyService is the minimal interface the Scheduler needs from
// the branch-policy service. ServiceInterface satisfies this.
type SyncPolicyService interface {
	GetEnabledPolicies(ctx context.Context, tenantID string, cronMatch func(string) bool) ([]models.SyncPolicy, error)
	RunNow(ctx context.Context, tenantID, id, actor, sourceCommit string) (*models.SyncRunLog, error)
}

// Compile-time check that *service.Service satisfies SyncPolicyService.
var _ SyncPolicyService = (*service.Service)(nil)

// Scheduler runs the periodic sync-policy execution loop. All fields
// are optional; zero values are filled in with sensible defaults.
type Scheduler struct {
	// Tick is the interval between scans. Defaults to 5 * time.Minute.
	Tick time.Duration
	// Now is the clock function. Defaults to time.Now.
	Now func() time.Time
	// Logger is optional; when nil, a No-op logger is used.
	Logger *zap.Logger
}

// Start launches the scheduler loop in a goroutine and returns a cancel
// function that must be called (typically by the caller) to stop it.
func (s *Scheduler) Start(ctx context.Context, svc SyncPolicyService) (cancel func()) {
	if s.Tick <= 0 {
		s.Tick = DefaultTick
	}
	if s.Now == nil {
		s.Now = time.Now
	}
	if s.Logger == nil {
		s.Logger = zap.NewNop()
	}

	stop := make(chan struct{})
	done := make(chan struct{})
	go func() {
		defer close(done)
		ticker := time.NewTicker(s.Tick)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				s.TickOnce(ctx, svc)
			case <-stop:
				return
			case <-ctx.Done():
				return
			}
		}
	}()

	return func() {
		close(stop)
		<-done
	}
}

// TickOnce executes one scheduler scan. It is public so tests can drive
// the loop synchronously without sleeping for the full Tick interval.
func (s *Scheduler) TickOnce(ctx context.Context, svc SyncPolicyService) {
	if s.Now == nil {
		s.Now = time.Now
	}
	if s.Logger == nil {
		s.Logger = zap.NewNop()
	}
	now := s.Now()
	cronMatch := TickCronExprMatches(now)
	policies, err := svc.GetEnabledPolicies(ctx, "", cronMatch)
	if err != nil {
		s.Logger.Warn("scheduler: get enabled policies failed", zap.Error(err))
		return
	}
	for i := range policies {
		p := &policies[i]
		if p.LastRunAt != nil && now.Sub(*p.LastRunAt) < MinIntervalForFrequency(p.Frequency) {
			continue
		}
		log, err := svc.RunNow(ctx, p.TenantID, p.ID, "scheduler", "")
		if err != nil {
			s.Logger.Warn("scheduler: run now failed",
				zap.String("policy", p.ID), zap.Error(err))
			continue
		}
		if log.Status == models.SyncStatusConflict {
			s.Logger.Warn("scheduler: sync policy conflict",
				zap.String("policy", p.ID),
				zap.Strings("conflicts", log.ConflictFiles))
		}
	}
}

// TickCronExprMatches returns a cronMatch function that matches when the
// cron expression's minute and hour fields line up with the current time.
//
// This is a simplified matcher: it does not interpret cron wildcards,
// ranges, or step values beyond the basic * and integer forms. The
// repository stubs also do not yet persist real cron expressions — the
// scheduler is designed to grow a real cron parser (e.g. robfig/cron)
// later without changing the caller interface.
func TickCronExprMatches(now time.Time) func(string) bool {
	return func(expr string) bool {
		parts := splitWhitespace(expr)
		if len(parts) < 5 {
			// Malformed — treat as "no match" so we don't accidentally
			// run a policy that has a broken expression.
			return false
		}
		return cronFieldMatches(parts[0], int(now.Minute())) &&
			cronFieldMatches(parts[1], int(now.Hour()))
	}
}

// splitWhitespace splits on any run of ASCII whitespace. Kept local to
// avoid importing strings just for this helper.
func splitWhitespace(s string) []string {
	var out []string
	start := -1
	for i := 0; i < len(s); i++ {
		if s[i] == ' ' || s[i] == '\t' {
			if start >= 0 {
				out = append(out, s[start:i])
				start = -1
			}
		} else if start < 0 {
			start = i
		}
	}
	if start >= 0 {
		out = append(out, s[start:])
	}
	return out
}

// cronFieldMatches returns true if the integer matches the cron field.
// Supports: "*", integer, "a,b" list, "a-b" range, and "*/n" step.
// Anything else is treated as no-match (fail-safe).
func cronFieldMatches(field string, v int) bool {
	if field == "*" {
		return true
	}
	if field == "" {
		return false
	}
	// "*/n" step
	if len(field) >= 3 && field[:2] == "*/" {
		step := parseUint(field[2:])
		if step > 0 {
			return v%int(step) == 0
		}
		return false
	}
	// comma-separated list
	for _, tok := range splitComma(field) {
		if tok == "*" {
			return true
		}
		if lo, hi, ok := splitRange(tok); ok {
			if v >= lo && v <= hi {
				return true
			}
			continue
		}
		if n := parseUint(tok); n == uint64(v) {
			return true
		}
	}
	return false
}

func splitComma(s string) []string {
	var out []string
	start := 0
	for i := 0; i < len(s); i++ {
		if s[i] == ',' {
			if i > start {
				out = append(out, s[start:i])
			}
			start = i + 1
		}
	}
	if start < len(s) {
		out = append(out, s[start:])
	}
	return out
}

func splitRange(s string) (lo, hi int, ok bool) {
	dash := -1
	for i := 0; i < len(s); i++ {
		if s[i] == '-' {
			dash = i
			break
		}
	}
	if dash < 0 || dash == 0 || dash == len(s)-1 {
		return 0, 0, false
	}
	if !isAllDigits(s[:dash]) || !isAllDigits(s[dash+1:]) {
		return 0, 0, false
	}
	loU := parseUint(s[:dash])
	hiU := parseUint(s[dash+1:])
	return int(loU), int(hiU), true
}

func isAllDigits(s string) bool {
	if len(s) == 0 {
		return false
	}
	for i := 0; i < len(s); i++ {
		if s[i] < '0' || s[i] > '9' {
			return false
		}
	}
	return true
}

func parseUint(s string) uint64 {
	var n uint64
	for i := 0; i < len(s); i++ {
		if s[i] < '0' || s[i] > '9' {
			return 0
		}
		n = n*10 + uint64(s[i]-'0')
	}
	return n
}

// MinIntervalForFrequency returns the minimum time between two scheduler
// invocations of the same policy for the given frequency. Policies whose
// LastRunAt is more recent than now - MinInterval are skipped, which
// prevents a 5-minute ticker from firing more than once per
// frequency period even when the CronExpr would match.
func MinIntervalForFrequency(f models.SyncFrequency) time.Duration {
	switch f {
	case models.SyncFrequencyDaily:
		return 24 * time.Hour
	case models.SyncFrequencyWeekly:
		return 7 * 24 * time.Hour
	case models.SyncFrequencyMonthly:
		return 30 * 24 * time.Hour
	default:
		// Unknown frequency: be conservative and don't re-run within
		// an hour. This shouldn't happen in production because the
		// service layer validates Frequency on create/update.
		return time.Hour
	}
}
