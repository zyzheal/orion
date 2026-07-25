package cron

import (
	"context"
	"sync"
	"time"
)

// ExecutionStatus is the lifecycle state of a single job execution.
type ExecutionStatus string

const (
	StatusRunning   ExecutionStatus = "running"
	StatusCompleted ExecutionStatus = "completed"
	StatusFailed    ExecutionStatus = "failed"
	StatusTimedOut  ExecutionStatus = "timed_out"
	StatusSkipped   ExecutionStatus = "skipped"
	StatusCancelled ExecutionStatus = "cancelled"
)

// ExecutionResult is returned by the scheduler after a job fires.  It is
// persisted to the execution store (if configured) and exposed via the
// history API.
type ExecutionResult struct {
	// JobName is the name() of the IJob that ran.
	JobName string

	// JobID is the robfig/cron EntryID.
	JobID int

	// Status is the final state.
	Status ExecutionStatus

	// Attempt is the 1-based attempt number for this firing (1 = first try).
	Attempt int

	// Error is set when Status == StatusFailed or StatusTimedOut.
	Error string

	// DurationMs is the wall-clock execution time in milliseconds.
	DurationMs int64

	// StartedAt / FinishedAt bound the execution window.
	StartedAt  time.Time
	FinishedAt *time.Time

	// Ctx is a copy of the context at the start of execution, used for
	// downstream logging / tracing correlation.  Safe to copy.
	Ctx context.Context
}

// IsTerminal returns true when the execution is in a final, non-running state.
func (r *ExecutionResult) IsTerminal() bool {
	switch r.Status {
	case StatusCompleted, StatusFailed, StatusTimedOut, StatusSkipped, StatusCancelled:
		return true
	}
	return false
}

// ExecutionStore is the persistence backend for job execution history.
// A no-op implementation (InMemoryHistory) is used when no DB is configured;
// real services can wire in a PostgreSQL-backed store.
type ExecutionStore interface {
	// Record saves a completed execution.
	Record(ctx context.Context, r *ExecutionResult) error

	// ListRecent returns the last n results for a given job name, ordered
	// by StartedAt descending.
	ListRecent(ctx context.Context, jobName string, n int) ([]*ExecutionResult, error)

	// Stats returns aggregate counters for a job name.
	Stats(ctx context.Context, jobName string) (*ExecStats, error)
}

// ExecStats is a compact summary for the scheduler dashboard.
type ExecStats struct {
	JobName       string
	TotalRuns     int
	Successes     int
	Failures      int
	LastRunAt     *time.Time
	LastStatus    ExecutionStatus
	LastError     string
	AvgDurationMs float64
}

// ---------------------------------------------------------------------------
// InMemoryHistory -- the default (zero-config) implementation.  Safe for
// concurrent access via mutex; unbounded in memory, so a production service
// should swap it out for a PostgreSQL-backed ExecutionStore.
// ---------------------------------------------------------------------------

type InMemoryHistory struct {
	mu    sync.RWMutex
	ents  map[string][]*ExecutionResult // jobName -> slice (newest last)
	stats map[string]*ExecStats         // jobName -> rolling stats
}

// NewInMemoryHistory creates a ready-to-use in-memory history store.
func NewInMemoryHistory() *InMemoryHistory {
	return &InMemoryHistory{
		ents:  make(map[string][]*ExecutionResult),
		stats: make(map[string]*ExecStats),
	}
}

func (h *InMemoryHistory) Record(_ context.Context, r *ExecutionResult) error {
	h.mu.Lock()
	defer h.mu.Unlock()

	ents := h.ents[r.JobName]
	if len(ents) > 200 {
		ents = ents[len(ents)-200:]
	}
	h.ents[r.JobName] = append(ents, r)

	s := h.stats[r.JobName]
	if s == nil {
		s = &ExecStats{JobName: r.JobName}
		h.stats[r.JobName] = s
	}
	s.TotalRuns++
	if r.Status == StatusCompleted {
		s.Successes++
	} else if r.Status == StatusFailed || r.Status == StatusTimedOut {
		s.Failures++
	}
	s.LastRunAt = &r.StartedAt
	s.LastStatus = r.Status
	s.LastError = r.Error
	// Weighted average duration: naive running average.
	s.AvgDurationMs = ((s.AvgDurationMs * float64(s.TotalRuns-1)) + float64(r.DurationMs)) / float64(s.TotalRuns)

	return nil
}

func (h *InMemoryHistory) ListRecent(_ context.Context, jobName string, n int) ([]*ExecutionResult, error) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	ents := h.ents[jobName]
	if len(ents) == 0 || n <= 0 {
		return nil, nil
	}
	if n > len(ents) {
		n = len(ents)
	}
	// Return newest first.
	out := make([]*ExecutionResult, n)
	for i := range out {
		out[i] = ents[len(ents)-n+i]
	}
	return out, nil
}

func (h *InMemoryHistory) Stats(_ context.Context, jobName string) (*ExecStats, error) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	s := h.stats[jobName]
	if s == nil {
		return &ExecStats{JobName: jobName}, nil
	}
	cp := *s
	return &cp, nil
}
