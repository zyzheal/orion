package engine

import (
	"context"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/cron/models"
	"orion/platform-svc-go/internal/cron/types"

	"go.uber.org/zap"
)

// Job represents a job that can be executed with a typed context.
// This is intentionally a narrower interface than the IJob defined in
// service/scheduler.go so that the engine can be used both with the legacy
// scheduler handlers and with the new ad-hoc / HandlerFunc registrations.
type Job interface {
	Execute(ctx context.Context) (string, error)
}

// JobWrapper adapts the legacy service.IJob (Execute(ctx, config)) to the
// engine.Job interface (Execute(ctx)).
type JobWrapper struct {
	legacy JobWithConfig
	config map[string]string
}

// JobWithConfig is the legacy service.IJob Execute signature without the
// boilerplate methods.
type JobWithConfig interface {
	Execute(ctx context.Context, config map[string]string) (string, error)
}

// NewJobWrapper wraps a JobWithConfig handler and its config into engine.Job.
func NewJobWrapper(legacy JobWithConfig, config map[string]string) Job {
	return &JobWrapper{legacy: legacy, config: config}
}

// Execute delegates to the wrapped legacy handler.
func (w *JobWrapper) Execute(ctx context.Context) (string, error) {
	return w.legacy.Execute(ctx, w.config)
}

// Adapter wraps an engine.Job so it also satisfies the legacy IJob contract.
type Adapter struct {
	j       Job
	name    string
	cronExpr string
}

func NewAdapter(j Job, name, cronExpr string) *Adapter {
	return &Adapter{j: j, name: name, cronExpr: cronExpr}
}

func (a *Adapter) Name() string       { return a.name }
func (a *Adapter) CronExpr() string   { return a.cronExpr }
func (a *Adapter) Execute(ctx context.Context, config map[string]string) (string, error) {
	return a.j.Execute(ctx)
}
func (a *Adapter) Validate() error { return nil }

// Execution is the result of running a single job attempt through the engine.
type Execution struct {
	ID         string        `json:"id"`
	JobID      string        `json:"job_id"`
	JobName    string        `json:"job_name"`
	Kind       types.JobKind `json:"kind"`
	Status     string        `json:"status"`     // running | completed | failed | skipped
	Output     string        `json:"output"`
	Error      string        `json:"error"`
	Attempt    int           `json:"attempt"`    // 1-based
	MaxAttempts int          `json:"max_attempts"`
	DurationMs int64         `json:"duration_ms"`
	StartedAt  time.Time     `json:"started_at"`
	FinishedAt *time.Time    `json:"finished_at"`
}

// ExecutionEngine is responsible for running a job with retry policy and a hard
// timeout, and persisting the execution log.  It is deliberately stateless
// apart from the logger so that the same instance can be reused per call.
type ExecutionEngine struct {
	repo   LogPersister
	logger *zap.Logger
}

// LogPersister abstracts persistence of a job execution log.
type LogPersister interface {
	CreateJobExecutionLog(ctx context.Context, log *models.JobExecutionLog) error
}

// NewExecutionEngine creates an engine with the given log persister and logger.
func NewExecutionEngine(repo LogPersister, logger *zap.Logger) *ExecutionEngine {
	if logger == nil {
		logger, _ = zap.NewProduction()
	}
	return &ExecutionEngine{repo: repo, logger: logger}
}

// Execute runs the job and returns a *Execution describing the outcome.
//
// It honours the job's RetryPolicy and Timeout:
//   - The timeout is applied to each individual attempt, not to the full retry
//     loop (so a 30s timeout + 3 attempts can take at most ~90s wall clock).
//   - Between failed attempts the engine sleeps BackoffDelay(retry#).
//   - If any attempt succeeds, remaining retries are skipped.
//   - Once MaxAttempts is exhausted the job is considered failed.
func (e *ExecutionEngine) Execute(ctx context.Context, job *types.CronJob, handler Job) *Execution {
	deadline := time.Now().UTC()
	result := &Execution{
		JobID:       job.ID,
		JobName:     job.Name,
		Kind:        job.Kind,
		Status:      "running",
		StartedAt:   deadline,
		MaxAttempts: job.RetryPolicy.MaxAttempts,
	}

	for attempt := 0; attempt < job.RetryPolicy.MaxAttempts; attempt++ {
		result.Attempt = attempt + 1

		// Skip retries that are not for this attempt.
		if attempt > 0 {
			backoff := job.RetryPolicy.BackoffDelay(attempt - 1)
			e.logger.Debug("engine: backing off before retry",
				zap.String("job", job.Name),
				zap.Int("attempt", attempt+1),
				zap.Duration("backoff", backoff))
			if !e.sleepOrCancel(ctx, backoff) {
				result.Status = "skipped"
				result.Error = "context cancelled during backoff"
				return e.persist(ctx, job, result)
			}
		}

		attCtx, cancel := context.WithTimeout(ctx, job.Timeout)
		attemptStart := time.Now().UTC()

		attDone := make(chan struct{})
		var out string
		var err error
		go func() {
			out, err = handler.Execute(attCtx)
			close(attDone)
		}()

		select {
		case <-attDone:
		case <-attCtx.Done():
			err = errors.New("job attempt timed out")
		case <-ctx.Done():
			cancel()
			<-attDone
			result.Status = "skipped"
			result.Error = "context cancelled"
			return e.persist(ctx, job, result)
		}
		cancel()

		elapsed := time.Since(attemptStart)
		result.DurationMs = elapsed.Milliseconds()
		now := time.Now().UTC()
		result.FinishedAt = &now

		if err == nil {
			result.Status = "completed"
			// Preserve the last attempt's output for the caller; do not
			// overwrite a successful output with a later one.
			result.Output = out
			result.Error = ""
			e.logger.Info("engine: job completed",
				zap.String("job_id", job.ID),
				zap.String("job_name", job.Name),
				zap.Int("attempt", result.Attempt),
				zap.Duration("elapsed", elapsed),
				zap.String("result", out))
			return e.persist(ctx, job, result)
		}

		if !job.RetryPolicy.ShouldRetry(attempt, err) {
			result.Status = "failed"
			result.Output = ""
			result.Error = err.Error()
			e.logger.Error("engine: job failed (no more retries)",
				zap.String("job_id", job.ID),
				zap.String("job_name", job.Name),
				zap.Int("attempt", result.Attempt),
				zap.Error(err))
			return e.persist(ctx, job, result)
		}

		result.Status = "failed" // transient
		result.Output = ""
		result.Error = err.Error()
		e.logger.Warn("engine: job attempt failed, will retry",
			zap.String("job_id", job.ID),
			zap.String("job_name", job.Name),
			zap.Int("attempt", result.Attempt),
			zap.Int("max_attempts", job.RetryPolicy.MaxAttempts),
			zap.Error(err))
	}

	// Exhausted all attempts.
	result.Status = "failed"
	result.Attempt = job.RetryPolicy.MaxAttempts
	result.Error = fmt.Sprintf("max retries exceeded (%d attempts)", job.RetryPolicy.MaxAttempts)
	e.logger.Error("engine: job failed after all retries",
		zap.String("job_id", job.ID),
		zap.String("job_name", job.Name),
		zap.Int("attempts", job.RetryPolicy.MaxAttempts))
	return e.persist(ctx, job, result)
}

// persist writes the execution result to the log persister.  If the persister
// is nil or the write fails, the Execution is still returned so callers can
// surface the result to the user.
func (e *ExecutionEngine) persist(_ context.Context, job *types.CronJob, result *Execution) *Execution {
	if e.repo == nil {
		return result
	}
	if result.FinishedAt == nil {
		now := time.Now().UTC()
		result.FinishedAt = &now
	}
	log := &models.JobExecutionLog{
		JobID:      result.JobID,
		Status:     result.Status,
		Output:     result.Output,
		Error:      result.Error,
		DurationMs: result.DurationMs,
		StartedAt:  result.StartedAt,
		FinishedAt: result.FinishedAt,
	}
	if err := e.repo.CreateJobExecutionLog(context.Background(), log); err != nil {
		e.logger.Error("engine: failed to persist execution log",
			zap.String("job_id", job.ID),
			zap.Error(err))
	}
	return result
}

// sleepOrCancel sleeps for d, returning false if ctx is cancelled.
func (e *ExecutionEngine) sleepOrCancel(ctx context.Context, d time.Duration) bool {
	if d <= 0 {
		return true
	}
	timer := time.NewTimer(d)
	defer timer.Stop()
	select {
	case <-timer.C:
		return true
	case <-ctx.Done():
		return false
	}
}
