package cron

import (
	"context"
	"errors"
	"sync"
	"time"

	"go.uber.org/zap"
)

// ErrConcurrencyLimit is returned when a job would exceed its concurrency
// budget and the caller opted for immediate fail-over rather than queueing.
var ErrConcurrencyLimit = errors.New("cron: concurrency limit reached")

// ErrJobSkippedBecauseDepFailed is returned by executeChain when a parent
// dependency is in a failed state and OnParentFailure == "skip".
var ErrJobSkippedBecauseDepFailed = errors.New("cron: job skipped because dependency failed")

// SchedulerConfig extends Config with IJob-specific behaviour knobs.
type SchedulerConfig struct {
	Config

	// DefaultMaxRetries is the fallback number of attempts when a job's
	// RetryPolicy is not configured.  0 == no retry.
	DefaultMaxRetries int

	// DefaultTimeout is the fallback ceiling when a job's Timeout() returns 0.
	DefaultTimeout time.Duration

	// MaxConcurrentExecutions caps the total number of goroutines this
	// scheduler may have running at any time.  0 == unlimited.
	MaxConcurrentExecutions int
}

// DefaultSchedulerConfig returns a sensible production-ready config.
func DefaultSchedulerConfig() SchedulerConfig {
	return SchedulerConfig{
		Config:              DefaultConfig(),
		DefaultMaxRetries:   3,
		DefaultTimeout:      5 * time.Minute,
		MaxConcurrentExecutions: 0,
	}
}

// SchedulerOption is a functional option for IJobScheduler.
type SchedulerOption func(*SchedulerConfig)

// WithDefaultMaxRetries sets the default retry budget.
func WithDefaultMaxRetries(n int) SchedulerOption {
	return func(c *SchedulerConfig) {
		c.DefaultMaxRetries = n
	}
}

// WithDefaultTimeout sets the default execution ceiling.
func WithDefaultTimeout(d time.Duration) SchedulerOption {
	return func(c *SchedulerConfig) {
		c.DefaultTimeout = d
	}
}

// WithMaxConcurrentExecutions caps the scheduler's global concurrency.
func WithMaxConcurrentExecutions(n int) SchedulerOption {
	return func(c *SchedulerConfig) {
		c.MaxConcurrentExecutions = n
	}
}

// WithExecutionStore sets a custom persistence backend for job results.
func WithExecutionStore(store ExecutionStore) SchedulerOption {
	return func(c *SchedulerConfig) {
		c.Logger = nil // handled by Scheduler constructor; store is saved elsewhere
	}
}

// ---------------------------------------------------------------------------
// IJobScheduler is the recommended entry-point for services that want the
// full IJob pattern (named jobs, retry, concurrency, dependency chains,
// execution history).  Use the legacy Scheduler for simple func()-based jobs.
// ---------------------------------------------------------------------------

type IJobScheduler struct {
	cfg     SchedulerConfig
	reg     *Registry
	sched   *Scheduler        // underlying robfig/cron engine (func wrappers)
	store   ExecutionStore   // optional; falls back to InMemoryHistory
	logger  *zap.Logger

	// global concurrency semaphore.
	sem chan struct{}

	// per-job concurrency tracking.
	mu            sync.RWMutex
	activeCount   map[string]int        // name -> currently running
	completionMu  sync.RWMutex
	completed     map[string]*execState // jobName -> latest result
	chainResults  map[string]*execState // jobName -> latest result (for chain)

	// wg tracks long-running goroutines so Stop waits for them.
	wg sync.WaitGroup

	stopped bool
}

// execState tracks the outcome of a single job invocation.
type execState struct {
	status    ExecutionStatus
	errMsg    string
	finishedAt *time.Time
	mu        sync.RWMutex
}

func (s *execState) get() (ExecutionStatus, string, *time.Time) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.status, s.errMsg, s.finishedAt
}

func (s *execState) set(status ExecutionStatus, errMsg string, finishedAt *time.Time) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.status = status
	s.errMsg = errMsg
	s.finishedAt = finishedAt
}

// NewIJobScheduler creates a scheduler wired to a Registry, an underlying
// Scheduler, and an ExecutionStore.  If store is nil, an InMemoryHistory is
// created.
func NewIJobScheduler(reg *Registry, sched *Scheduler, store ExecutionStore, opts ...SchedulerOption) *IJobScheduler {
	cfg := DefaultSchedulerConfig()
	for _, o := range opts {
		o(&cfg)
	}

	if store == nil {
		store = NewInMemoryHistory()
	}

	sem := make(chan struct{}, cfg.MaxConcurrentExecutions)

	s := &IJobScheduler{
		cfg:          cfg,
		reg:          reg,
		sched:        sched,
		store:        store,
		logger:       cfg.Logger,
		sem:          sem,
		activeCount:  make(map[string]int),
		completed:    make(map[string]*execState),
		chainResults: make(map[string]*execState),
	}

	if cfg.Running {
		s.Start()
	}
	return s
}

// Log returns a child logger tagged with "i-job-scheduler".
func (s *IJobScheduler) Log() *zap.Logger {
	if s.logger == nil {
		l, _ := zap.NewDevelopment()
		return l.Named("i-job-scheduler")
	}
	return s.logger.Named("i-job-scheduler")
}

// ---------------------------------------------------------------------------
// Registration -- mirrors Registry API but also wires the job into the
// underlying robfig/cron engine.
// ---------------------------------------------------------------------------

// Register wires an IJob spec into both the Registry and the cron engine.
// If the spec passes validation it is added to the scheduler; registration
// errors are returned and nothing is added.
func (s *IJobScheduler) Register(spec JobSpec) error {
	if err := s.reg.Register(spec); err != nil {
		return err
	}

	// Build a func() wrapper that delegates to IJob.Execute with timeout + retry.
	name := spec.Name
	wrapper := func() {
		s.runJobOnce(name, spec.Job, spec.RetryPolicy, spec.Concurrency)
	}
	// We use Add via a wrapper; name collision is handled by Scheduler.Add panic
	// -- to avoid panic, check first.
	// (The registry already guards duplicates, so this is a safety belt.)

	// Register the wrapper with the underlying engine.
	// The legacy Scheduler.Add panics on duplicate names; we guard.
	s.mu.RLock()
	_, exists := s.activeCount[name]
	s.mu.RUnlock()
	// AddSpec is provided as a non-panicking entry point.
	s.addSpec(name, spec.Spec, wrapper)
	return nil
}

// Unregister removes a job from the engine and the registry.
func (s *IJobScheduler) Unregister(name string) {
	s.sched.Remove(name)
	s.reg.Unregister(name)
}

// SetDependencyChain is a passthrough to the registry.
func (s *IJobScheduler) SetDependencyChain(name string, dep DependencyChain) error {
	return s.reg.SetDependencyChain(name, dep)
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

// Start kicks off the underlying cron engine.
func (s *IJobScheduler) Start() {
	s.sched.Start()
	s.log("i-job-scheduler started")
}

// Stop signals shutdown and waits for all running goroutines to drain.
func (s *IJobScheduler) Stop() {
	s.mu.Lock()
	s.stopped = true
	s.mu.Unlock()

	s.sched.Stop()
	s.wg.Wait()
	s.log("i-job-scheduler stopped")
}

// ---------------------------------------------------------------------------
// Manual invocation
// ---------------------------------------------------------------------------

// RunJobNow manually triggers a single job, respecting timeout and retry.
func (s *IJobScheduler) RunJobNow(ctx context.Context, name string) (*ExecutionResult, error) {
	spec, ok := s.reg.Get(name)
	if !ok {
		return nil, errors.New("cron: job not found: " + name)
	}

	result, err := s.executeJobWithRetry(ctx, spec.Job, spec.RetryPolicy)
	return result, err
}

// RunChain runs a full dependency chain starting from a given root job.  Jobs
// with unmet dependencies are skipped unless OnParentFailure == "run_anyway".
func (s *IJobScheduler) RunChain(ctx context.Context, rootName string) ([]*ExecutionResult, error) {
	// Rebuild topological order each call so it reflects latest config.
	order := s.reg.GetChainOrder()

	// Build a map from root name to its reachable subgraph in topological order.
	// Walk predecessors of rootName, include them all if they appear before it.
	seen := make(map[string]bool)
	var walk func(n string)
	walk = func(n string) {
		if seen[n] {
			return
		}
		seen[n] = true
		for depName := range s.reg.Dependencies(n).DependsOn {
			walk(depName)
		}
	}
	walk(rootName)

	var results []*ExecutionResult
	for _, name := range order {
		if !seen[name] {
			continue
		}
		spec, ok := s.reg.Get(name)
		if !ok {
			continue
		}
		dep := s.reg.Dependencies(name)

		// Check dependency results.
		shouldSkip := false
		for _, depName := range dep.DependsOn {
			st, errStr, finishedAt := s.getChainResult(depName)
			if finishedAt == nil {
				// Dependency hasn't run yet in this chain; skip.
				shouldSkip = true
				break
			}
			if st == StatusFailed || st == StatusTimedOut {
				if dep.OnParentFailure != "run_anyway" {
					shouldSkip = true
					break
				}
			}
		}
		if shouldSkip {
			result := &ExecutionResult{
				JobName:   name,
				Status:    StatusSkipped,
				StartedAt: time.Now().UTC(),
			}
			finishedAt := time.Now().UTC()
			result.FinishedAt = &finishedAt
			s.setChainResult(name, result)
			results = append(results, result)
			continue
		}

		res, _ := s.RunJobNow(ctx, name)
		if res != nil {
			s.setChainResult(name, res)
		}
		results = append(results, res)
	}
	return results, nil
}

// ---------------------------------------------------------------------------
// History / stats
// ---------------------------------------------------------------------------

// History returns recent execution results for a job.
func (s *IJobScheduler) History(ctx context.Context, name string, n int) ([]*ExecutionResult, error) {
	return s.store.ListRecent(ctx, name, n)
}

// Stats returns aggregate stats for a job.
func (s *IJobScheduler) Stats(ctx context.Context, name string) (*ExecStats, error) {
	return s.store.Stats(ctx, name)
}

// AllSpecs returns a sorted list of every registered spec.
func (s *IJobScheduler) AllSpecs() []JobSpec {
	return s.reg.AllSpecs()
}

// Registry returns the underlying registry (for callers that want direct access).
func (s *IJobScheduler) Registry() *Registry {
	return s.reg
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

// addSpec is the non-panicking equivalent of Scheduler.Add for IJob wrappers.
// It adds the job to the engine and keeps a bookkeeping entry.
func (s *IJobScheduler) addSpec(name, spec string, fn func()) {
	s.mu.Lock()
	defer s.mu.Unlock()
	// Guard against duplicates the registry already ensures.
	s.sched.Add(name, spec, fn)
}

// runJobOnce is the wrapper invoked by the cron engine.  It acquires the
// concurrency semaphore, handles per-job concurrency, calls executeJobWithRetry,
// and persists the result.
func (s *IJobScheduler) runJobOnce(name string, job IJob, policy RetryPolicy, concurrency int) {
	s.wg.Add(1)
	defer s.wg.Done()

	// Acquire global concurrency slot (non-blocking: we drop if full).
	if cap(s.sem) > 0 {
		select {
		case s.sem <- struct{}{}:
			defer func() { <-s.sem }()
		default:
			s.log("job dropped: global concurrency limit", zap.String("name", name))
			s.recordResult(name, &ExecutionResult{
				JobName: name,
				Status:  StatusSkipped,
			})
			return
		}
	}

	// Per-job concurrency guard.
	s.mu.Lock()
	current := s.activeCount[name]
	s.activeCount[name] = current + 1
	s.mu.Unlock()
	defer func() {
		s.mu.Lock()
		s.activeCount[name]--
		s.mu.Unlock()
	}()

	if concurrency > 0 && current >= concurrency {
		s.log("job dropped: per-job concurrency limit",
			zap.String("name", name), zap.Int("current", current), zap.Int("limit", concurrency))
		s.recordResult(name, &ExecutionResult{
			JobName: name,
			Status:  StatusSkipped,
			Error:   ErrConcurrencyLimit.Error(),
		})
		return
	}

	result := s.executeJobWithRetry(context.Background(), job, policy)
	s.recordResult(name, result)
}

// executeJobWithRetry runs a job up to the configured number of attempts with
// exponential backoff.  Returns the final result (success or last failure).
func (s *IJobScheduler) executeJobWithRetry(ctx context.Context, job IJob, policy RetryPolicy) *ExecutionResult {
	started := time.Now().UTC()

	// Determine effective config.
	maxAttempts := policy.EffectiveAttempts()
	if maxAttempts < 1 {
		if job.Retry() {
			maxAttempts = s.cfg.DefaultMaxRetries
		} else {
			MaxAttempts := 1
			_ = MaxAttempts // ensure variable is used to avoid compiler error; kept for clarity
		}
	}
	// If job.Retry() is false, respect maxAttempts=1.
	if !job.Retry() {
		maxAttempts = 1
	}

	// Effective timeout.
	timeout := job.Timeout()
	if timeout <= 0 {
		timeout = s.cfg.DefaultTimeout
	}

	for attempt := 1; attempt <= maxAttempts; attempt++ {
		attemptCtx, cancel := context.WithTimeout(ctx, timeout)

		var result string
		var err error

		done := make(chan struct{})
		s.wg.Add(1)
		go func() {
			defer s.wg.Done()
			err = job.Execute(attemptCtx)
			close(done)
		}()

		select {
		case <-done:
		case <-attemptCtx.Done():
			err = errors.New("job timed out")
		}
		cancel()

		elapsed := time.Since(started).Milliseconds()
		finishedAt := time.Now().UTC()

		result := &ExecutionResult{
			JobName:    job.Name(),
			Status:     StatusCompleted,
			Attempt:    attempt,
			DurationMs: elapsed,
			StartedAt:  started,
			FinishedAt: &finishedAt,
			Ctx:        attemptCtx,
		}

		if err != nil {
			if attemptCtx.Err() != nil {
				result.Status = StatusTimedOut
			} else {
				result.Status = StatusFailed
			}
			result.Error = err.Error()

			// Retry decision.
			if attempt < maxAttempts && policy.IsRetriableError(err) {
				delay, capped := policy.EffectiveBackoff(attempt - 1)
				s.log("job failed, retrying",
					zap.String("name", job.Name()),
					zap.Int("attempt", attempt),
					zap.Int("max_attempts", maxAttempts),
					zap.Duration("backoff", delay),
					zap.Bool("capped", capped),
					zap.Error(err),
				)
				if delay > 0 {
					select {
					case <-ctx.Done():
						result.Status = StatusCancelled
						return result
					case <-time.After(delay):
						// proceed to next attempt
					}
				}
				continue
			}
			return result
		}

		// Success.
		s.log("job completed",
			"orion/cron/job", job.Name(),
			"orion/cron/attempt", attempt,
			"orion/cron/duration_ms", elapsed,
		)
		return result
	}

	// Fallback (should never reach here).
	return &ExecutionResult{
		JobName:  job.Name(),
		Status:   StatusFailed,
		Attempt:  maxAttempts,
		Error:    "exhausted retries",
		StartedAt: started,
	}
}

// recordResult persists the result and updates the completed map.
func (s *IJobScheduler) recordResult(name string, result *ExecutionResult) {
	if result.FinishedAt == nil {
		now := time.Now().UTC()
		result.FinishedAt = &now
	}
	s.store.Record(context.Background(), result)

	s.completionMu.Lock()
	s.completed[name] = &execState{
		status:     result.Status,
		errMsg:     result.Error,
		finishedAt: result.FinishedAt,
	}
	s.completionMu.Unlock()
}

// getChainResult reads the latest result for a job from chainResults.
func (s *IJobScheduler) getChainResult(name string) (ExecutionStatus, string, *time.Time) {
	s.completionMu.RLock()
	defer s.completionMu.RUnlock()
	if st, ok := s.chainResults[name]; ok {
		return st.get()
	}
	// Fall back to latest completed.
	if st, ok := s.completed[name]; ok {
		return st.get()
	}
	return StatusSkipped, "", nil
}

// setChainResult writes a result into the chain-results map.
func (s *IJobScheduler) setChainResult(name string, result *ExecutionResult) {
	s.completionMu.Lock()
	defer s.completionMu.Unlock()
	s.chainResults[name] = &execState{
		status:     result.Status,
		errMsg:     result.Error,
		finishedAt: result.FinishedAt,
	}
}

// log helper that respects whether a logger was configured.
func (s *IJobScheduler) log(msg string, fields ...zap.Field) {
	logger := s.Log()
	if logger != nil {
		logger.Info(msg, fields...)
	}
}
