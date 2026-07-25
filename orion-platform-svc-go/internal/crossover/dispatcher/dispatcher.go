// Package dispatcher provides the CallDispatcher for async processing of
// crossover calls, including job creation, execution, and status tracking.
//
// The dispatcher manages the async lifecycle: create job → execute → track result.
package dispatcher

import (
	"context"
	"errors"
	"sync"
	"time"

	"orion/platform-svc-go/internal/crossover/models"
)

// ---------------------------------------------------------------------------
// Sentinel errors
// ---------------------------------------------------------------------------

var (
	ErrJobNotFound    = errors.New("job not found")
	ErrJobFailed      = errors.New("job execution failed")
	ErrInvalidStatus  = errors.New("invalid job status")
)

// ---------------------------------------------------------------------------
// AsyncJob
// ---------------------------------------------------------------------------

// AsyncJob represents a dispatched async crossover call job.
type AsyncJob struct {
	ID           string
	TenantID     string
	CallID       string
	TargetModule string
	Operation    string
	Parameters   models.CallParameters
	Status       string // pending, running, completed, failed
	Result       *models.CallResultObj
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

// NewAsyncJob creates a new async job.
func NewAsyncJob(tenantID, callID, targetModule, operation string, params models.CallParameters) *AsyncJob {
	now := time.Now().UTC()
	return &AsyncJob{
		ID:           callID, // reuse call ID for correlation
		TenantID:     tenantID,
		CallID:       callID,
		TargetModule: targetModule,
		Operation:    operation,
		Parameters:   params,
		Status:       "pending",
		CreatedAt:    now,
		UpdatedAt:    now,
	}
}

// ---------------------------------------------------------------------------
// CallDispatcher
// ---------------------------------------------------------------------------

// CallDispatcher handles async processing of crossover calls.
type CallDispatcher struct {
	mu     sync.RWMutex
	jobs   map[string]*AsyncJob
	ctx    context.Context
	cancel context.CancelFunc
}

// NewCallDispatcher creates a new dispatcher.
func NewCallDispatcher() *CallDispatcher {
	ctx, cancel := context.WithCancel(context.Background())
	d := &CallDispatcher{
		jobs: make(map[string]*AsyncJob),
		ctx:  ctx,
		cancel: cancel,
	}
	return d
}

// CreateJob creates a new async job and returns it.
func (d *CallDispatcher) CreateJob(ctx context.Context, tenantID, targetModule, operation string, params models.CallParameters) (*AsyncJob, error) {
	jobID := d.generateJobID(targetModule, operation)
	job := NewAsyncJob(tenantID, jobID, targetModule, operation, params)

	d.mu.Lock()
	d.jobs[jobID] = job
	d.mu.Unlock()

	return job, nil
}

// GetJob retrieves a job by ID.
func (d *CallDispatcher) GetJob(id string) (*AsyncJob, error) {
	d.mu.RLock()
	defer d.mu.RUnlock()
	job, ok := d.jobs[id]
	if !ok {
		return nil, ErrJobNotFound
	}
	return d.cloneJob(job), nil
}

// ListJobs lists all jobs for a tenant with optional status filter.
func (d *CallDispatcher) ListJobs(tenantID, status string) []*AsyncJob {
	d.mu.RLock()
	defer d.mu.RUnlock()
	result := make([]*AsyncJob, 0)
	for _, job := range d.jobs {
		if job.TenantID != tenantID {
			continue
		}
		if status != "" && job.Status != status {
			continue
		}
		result = append(result, d.cloneJob(job))
	}
	return result
}

// UpdateJobStatus updates the status of a job.
func (d *CallDispatcher) UpdateJobStatus(id, status string) error {
	validStatuses := map[string]bool{
		"pending":   true,
		"running":   true,
		"completed": true,
		"failed":    true,
	}
	if !validStatuses[status] {
		return ErrInvalidStatus
	}
	d.mu.Lock()
	defer d.mu.Unlock()
	job, ok := d.jobs[id]
	if !ok {
		return ErrJobNotFound
	}
	job.Status = status
	job.UpdatedAt = time.Now().UTC()
	return nil
}

// CompleteJob marks a job as completed with a result.
func (d *CallDispatcher) CompleteJob(id string, result map[string]interface{}) error {
	d.mu.Lock()
	defer d.mu.Unlock()
	job, ok := d.jobs[id]
	if !ok {
		return ErrJobNotFound
	}
	job.Status = "completed"
	job.Result = &models.CallResultObj{
		Value:  result,
		DoneAt: time.Now().UTC(),
	}
	job.UpdatedAt = time.Now().UTC()
	return nil
}

// FailJob marks a job as failed with an error.
func (d *CallDispatcher) FailJob(id string, errMsg string) error {
	d.mu.Lock()
	defer d.mu.Unlock()
	job, ok := d.jobs[id]
	if !ok {
		return ErrJobNotFound
	}
	job.Status = "failed"
	job.Result = &models.CallResultObj{
		Error:  errMsg,
		DoneAt: time.Now().UTC(),
	}
	updated := time.Now().UTC()
	job.UpdatedAt = updated
	return ErrJobFailed
}

// CountJobs returns the count of jobs for a tenant.
func (d *CallDispatcher) CountJobs(tenantID string) int {
	d.mu.RLock()
	defer d.mu.RUnlock()
	count := 0
	for _, job := range d.jobs {
		if job.TenantID == tenantID {
			count++
		}
	}
	return count
}

// CleanupFinishedJobs removes completed/failed jobs older than maxAge.
func (d *CallDispatcher) CleanupFinishedJobs(maxAge time.Duration) int {
	cutoff := time.Now().UTC().Add(-maxAge)
	d.mu.Lock()
	defer d.mu.Unlock()
	removed := 0
	for id, job := range d.jobs {
		if (job.Status == "completed" || job.Status == "failed") && job.UpdatedAt.Before(cutoff) {
			delete(d.jobs, id)
			removed++
		}
	}
	return removed
}

// Shutdown gracefully shuts down the dispatcher.
func (d *CallDispatcher) Shutdown() {
	d.cancel()
	d.mu.Lock()
	defer d.mu.Unlock()
	// Clear all jobs
	for id := range d.jobs {
		delete(d.jobs, id)
	}
}

// Context returns the dispatcher's context.
func (d *CallDispatcher) Context() context.Context {
	return d.ctx
}

// generateJobID creates a unique job ID.
func (d *CallDispatcher) generateJobID(targetModule, operation string) string {
	now := time.Now().UTC()
	return targetModule + "." + operation + "-" + now.Format("20060102150405")
}

// cloneJob returns a defensive copy.
func (d *CallDispatcher) cloneJob(job *AsyncJob) *AsyncJob {
	params := make(models.CallParameters)
	for k, v := range job.Parameters {
		params[k] = v
	}
	result := (*models.CallResultObj)(nil)
	if job.Result != nil {
		result = &models.CallResultObj{
			Value:  make(map[string]interface{}),
			Error:  job.Result.Error,
			DoneAt: job.Result.DoneAt,
		}
		for k, v := range job.Result.Value {
			result.Value[k] = v
		}
	}
	return &AsyncJob{
		ID:           job.ID,
		TenantID:     job.TenantID,
		CallID:       job.CallID,
		TargetModule: job.TargetModule,
		Operation:    job.Operation,
		Parameters:   params,
		Status:       job.Status,
		Result:       result,
		CreatedAt:    job.CreatedAt,
		UpdatedAt:    job.UpdatedAt,
	}
}

// ---------------------------------------------------------------------------
// BatchDispatcher
// ---------------------------------------------------------------------------

// BatchDispatcher handles batch crossover calls.
type BatchDispatcher struct {
	dispatcher *CallDispatcher
}

// NewBatchDispatcher creates a new batch dispatcher.
func NewBatchDispatcher(d *CallDispatcher) *BatchDispatcher {
	return &BatchDispatcher{dispatcher: d}
}

// DispatchBatch creates multiple async jobs and returns their IDs.
func (b *BatchDispatcher) DispatchBatch(ctx context.Context, tenantID string, calls []*models.CrossoverCall) ([]string, error) {
	if len(calls) == 0 {
		return []string{}, nil
	}
	jobIDs := make([]string, 0, len(calls))
	for _, call := range calls {
		job, err := b.dispatcher.CreateJob(ctx, tenantID, call.TargetModule, call.Operation, call.Parameters)
		if err != nil {
			return nil, err
		}
		jobIDs = append(jobIDs, job.ID)
	}
	return jobIDs, nil
}

// GetBatchResult retrieves results for multiple jobs.
func (b *BatchDispatcher) GetBatchResult(ids []string) (map[string]*models.CallResultObj, error) {
	if len(ids) == 0 {
		return map[string]*models.CallResultObj{}, nil
	}
	results := make(map[string]*models.CallResultObj)
	for _, id := range ids {
		job, err := b.dispatcher.GetJob(id)
		if err != nil {
			return nil, err
		}
		results[id] = job.Result
	}
	return results, nil
}
