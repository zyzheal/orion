package registry

import (
	"errors"
	"sync"
	"time"

	"orion/platform-svc-go/internal/cron/models"
	"orion/platform-svc-go/internal/cron/types"

	"context"

	"go.uber.org/zap"
)

// JobRegistry is the authoritative map of registered job definitions keyed by
// their logical name (e.g. "daily-db-backup").  It is shared between the
// scheduler goroutine and the HTTP handler so that runtime queries ("what jobs
// are registered?") see a single consistent state.
// Job is the handler interface for scheduled jobs.
type Job interface {
	Execute(context.Context) (string, error)
}

// HandlerFunc adapts a function to the Job interface.
type HandlerFunc func(context.Context) (string, error)

func (fn HandlerFunc) Execute(ctx context.Context) (string, error) {
	return fn(ctx)
}

type JobRegistry struct {
	mu      sync.RWMutex
	jobs    map[string]*types.CronJob         // name -> job
	handler map[string]types.CronJob              // name -> engine.Job handler
	logger  *zap.Logger
}

// NewJobRegistry creates an empty registry with the given logger.
func NewJobRegistry(logger *zap.Logger) *JobRegistry {
	if logger == nil {
		logger, _ = zap.NewProduction()
	}
	return &JobRegistry{
		jobs:    make(map[string]*types.CronJob),
		handler: make(map[string]types.CronJob),
		logger:  logger,
	}
}

// Register adds a job definition and its callable handler to the registry.
// If a job with the same name already exists, it is replaced atomically.
//
// The job kind must be valid (recurring / one_time / delayed).
func (r *JobRegistry) Register(job *types.CronJob, handler types.CronJob) error {
	if !job.Kind.IsValid() {
		return errors.New("invalid job kind " + string(job.Kind))
	}
	if job.Name == "" {
		return errors.New("job name is required")
	}
	if handler.Name == "" {
		return errors.New("job handler must not be nil")
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	r.jobs[job.Name] = job
	r.handler[job.Name] = handler
	r.logger.Info("registry: registered job",
		zap.String("name", job.Name),
		zap.String("kind", string(job.Kind)),
		zap.String("schedule", job.Schedule))
	return nil
}

// Unregister removes a job and its handler by name.
func (r *JobRegistry) Unregister(name string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.jobs, name)
	delete(r.handler, name)
	r.logger.Info("registry: unregistered job", zap.String("name", name))
}

// Get returns the job definition for the given name, or nil if not found.
func (r *JobRegistry) Get(name string) *types.CronJob {
	r.mu.RLock()
	defer r.mu.RUnlock()
	j, ok := r.jobs[name]
	if !ok {
		return nil
	}
	cp := *j
	return &cp // shallow copy protects internal pointer fields from callers mutating
}

// GetHandler returns the callable handler for a registered job.
func (r *JobRegistry) GetHandler(name string) types.CronJob {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.handler[name]
}

// IsRegistered reports whether a name is present.
func (r *JobRegistry) IsRegistered(name string) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	_, ok := r.jobs[name]
	return ok
}

// List returns all registered job definitions (shallow-copied).
func (r *JobRegistry) List() []types.CronJob {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]types.CronJob, 0, len(r.jobs))
	for _, j := range r.jobs {
		cp := *j
		out = append(out, cp)
	}
	return out
}

// Names returns the set of registered job names.
func (r *JobRegistry) Names() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	names := make([]string, 0, len(r.jobs))
	for name := range r.jobs {
		names = append(names, name)
	}
	return names
}

// ResolveDependencies reports whether every dependency of the given job has
// already executed successfully (status "completed") at least once.
//
// depsSatisfied is a caller-provided map jobID -> bool indicating whether that
// dependency has completed.  This avoids the registry reaching into the log
// persister, keeping its responsibility narrow.
func (r *JobRegistry) ResolveDependencies(name string, depsSatisfied map[string]bool) (bool, []string) {
	j, ok := r.jobs[name]
	if !ok {
		return false, nil
	}
	if j == nil || len(j.DependsOn) == 0 {
		return true, nil // no dependencies = ready
	}

	blocked := make([]string, 0, len(j.DependsOn))
	for _, dep := range j.DependsOn {
		if depsSatisfied[dep.JobID] {
			continue
		}
		blocked = append(blocked, dep.JobID)
	}
	if len(blocked) == 0 {
		return true, nil
	}
	return false, blocked
}

// SetStatus updates the runtime status of a job by name.
func (r *JobRegistry) SetStatus(name, status string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if j, ok := r.jobs[name]; ok {
		j.Status = status
		j.UpdatedAt = time.Now().UTC()
	}
}

// Enable sets the enabled flag.
func (r *JobRegistry) Enable(name string, v bool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if j, ok := r.jobs[name]; ok {
		j.Enabled = v
		j.UpdatedAt = time.Now().UTC()
	}
}

// ToJobDefinition converts a CronJob into the legacy persistence model
// (models.JobDefinition).  Used when registering jobs through the scheduler
// so they can be persisted and later reloaded.
func ToJobDefinition(job *types.CronJob) *models.JobDefinition {
	d := &models.JobDefinition{
		ID:         job.ID,
		TenantID:   job.TenantID,
		Name:       job.Name,
		CronExpr:   job.Schedule,
		JobType:    string(job.Kind),
		Status:     job.Status,
		Enabled:    job.Enabled,
		MaxRetries: job.RetryPolicy.MaxAttempts,
		TimeoutSec: int(job.Timeout.Seconds()),
		CreatedAt:  job.CreatedAt,
		UpdatedAt:  job.UpdatedAt,
	}
	if !job.RunAt.IsZero() {
		d.LastRunAt = &job.RunAt
	}
	return d
}

// FromJobDefinition converts a persisted definition back into a CronJob.
func FromJobDefinition(def *models.JobDefinition) *types.CronJob {
	kind := types.JobKind(def.JobType)
	if !kind.IsValid() {
		kind = types.KindRecurring // default for legacy definitions
	}
	retry := types.RetryPolicy{
		MaxAttempts:    def.MaxRetries,
		InitialDelay:   time.Second,
		MaxDelay:       5 * time.Minute,
		Multiplier:     2.0,
		RetryableErrors: nil,
	}
	if def.MaxRetries == 0 {
		retry = types.DefaultRetryPolicy()
	}

	job := &types.CronJob{
		ID:          def.ID,
		TenantID:    def.TenantID,
		Name:        def.Name,
		Kind:        kind,
		Schedule:    def.CronExpr,
		Task:        def.JobType, // legacy: task = job_type
		Description: def.Name,
		Enabled:     def.Enabled,
		Status:      def.Status,
		RetryPolicy: retry,
		Timeout:     time.Duration(def.TimeoutSec) * time.Second,
		CreatedAt:   def.CreatedAt,
		UpdatedAt:   def.UpdatedAt,
	}
	// def.LastRunAt is informational; CronJob has no LastRunAt field
	return job
}

// DependencyManager tracks the completion state of each job so that dependent
// jobs can check whether their prerequisites are satisfied.
type DependencyManager struct {
	mu   sync.RWMutex
	done map[string]bool // jobID -> completed at least once
}

// NewDependencyManager creates an empty tracker.
func NewDependencyManager() *DependencyManager {
	return &DependencyManager{
		done: make(map[string]bool),
	}
}

// MarkCompleted records that a job has finished successfully.
func (dm *DependencyManager) MarkCompleted(jobID string) {
	dm.mu.Lock()
	defer dm.mu.Unlock()
	dm.done[jobID] = true
}

// IsCompleted reports whether a job has completed at least once.
func (dm *DependencyManager) IsCompleted(jobID string) bool {
	dm.mu.RLock()
	defer dm.mu.RUnlock()
	return dm.done[jobID]
}

// AllDone returns the current map for bulk evaluation.
func (dm *DependencyManager) AllDone() map[string]bool {
	dm.mu.RLock()
	defer dm.mu.RUnlock()
	cp := make(map[string]bool, len(dm.done))
	for k, v := range dm.done {
		cp[k] = v
	}
	return cp
}

// Reset clears all completion markers.
func (dm *DependencyManager) Reset() {
	dm.mu.Lock()
	defer dm.mu.Unlock()
	dm.done = make(map[string]bool)
}

// JobRegistryManager is a convenience holder used by the SchedulerManager
// wrapper.  It groups registry + dependency tracker so callers can wire up
// once.  The real engine package lives in cron/engine; it is referenced here
// by value via the engine type.
type JobRegistryManager struct {
	Registry      *JobRegistry
	DependencyMgr *DependencyManager
}

