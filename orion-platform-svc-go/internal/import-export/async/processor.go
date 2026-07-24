package async

import (
	"context"
	"io"
	"sync"
	"time"

	"orion/platform-svc-go/internal/import-export/factory"
	"orion/platform-svc-go/internal/import-export/models"
	"orion/platform-svc-go/internal/import-export/repository"
)

// Processor manages asynchronous import/export jobs.
//
// It dispatches jobs to goroutines and maintains an in-memory progress cache
// that callers (SSE / poll endpoints) can read without hitting the database.
type Processor struct {
	mu      sync.RWMutex
	jobs    map[string]chan float64 // jobID -> progress channel (0-100)
	factory *factory.Factory
	repo    *repository.Repository
}

// NewProcessor creates a processor and registers the given factories.
func NewProcessor(f *factory.Factory, repo *repository.Repository) *Processor {
	return &Processor{
		jobs:    make(map[string]chan float64),
		factory: f,
		repo:    repo,
	}
}

// StartImport dispatches an import job in the background.
//
// The caller owns the `body io.ReadCloser` for the duration of the job.
// Returns the job ID immediately; the worker populates progress via the
// channel returned by ProgressChan(jobID).
func (p *Processor) StartImport(ctx context.Context, jobID, dataType string,
	source io.ReadCloser, format string, opts *models.ImportOpts) error {
	if opts == nil {
		opts = &models.ImportOpts{}
	}
	opts.TenantID = jobID // carry tenant into the handler context

	p.recordInitial(jobID, opts.TenantID, opts.UserID, dataType, "import", format)
	p.mu.Lock()
	progressCh := make(chan float64, 1)
	p.jobs[jobID] = progressCh
	p.mu.Unlock()

	go func() {
		defer func() {
			progressCh <- 100
			p.mu.Lock()
			delete(p.jobs, jobID)
			p.mu.Unlock()
		}()

		handler := p.factory.GetImportHandler(dataType)
		if handler == nil {
			p.setJobStatus(jobID, "failed", 100, "no import handler registered for "+dataType)
			return
		}

		result, err := handler.Import(ctx, source, format, opts)
		if err != nil {
			p.setJobStatus(jobID, "failed", 100, err.Error())
			return
		}
		// Persist final state.
		progress := 100.0
		if result.TotalCount > 0 {
			progress = float64(result.SuccessCount) / float64(result.TotalCount) * 100
		}
		p.setJobStatus(jobID, "completed", progress, result.Message)
		if err := p.repo.BatchSaveErrors(ctx, result.Errors); err != nil {
			// Non-fatal: progress is the critical path.
		}
	}()

	return nil
}

// StartExport dispatches an export job in the background and writes the result
// to the given destination writer.
//
// Unlike StartImport, StartExport writes directly to `dest` because the caller
// (typically an HTTP response writer) is waiting for the data.
func (p *Processor) StartExport(ctx context.Context, jobID, dataType string,
	dest io.Writer, filter map[string]interface{}, format string, opts *models.ExportOpts) error {
	if opts == nil {
		opts = &models.ExportOpts{}
	}

	handler := p.factory.GetExportHandler(dataType)
	if handler == nil {
		return nil
	}

	reader, _, err := handler.Export(ctx, filter, format, opts)
	if err != nil {
		return err
	}

	_, err = io.Copy(dest, reader)
	if err != nil {
		return err
	}

	p.recordCompleted(jobID, opts.TenantID, opts.UserID, dataType, "export", format)
	return nil
}

// ProgressChan returns the progress channel for a running job.
//
// Callers should select on this channel or poll GetProgress(jobID).
// Returns nil if the job is not running or not found.
func (p *Processor) ProgressChan(jobID string) <-chan float64 {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.jobs[jobID]
}

// GetProgress queries the repository for the current job progress.
//
// The in-memory progress cache is authoritative while the job is running; once
// the job finishes, the persisted row is updated.
func (p *Processor) GetProgress(ctx context.Context, tenantID, jobID string) (*models.Job, error) {
	// Check in-memory first.
	p.mu.RLock()
	_, running := p.jobs[jobID]
	p.mu.RUnlock()

	if running {
		// Job is running; poll the DB for the latest persisted state.
		return p.repo.GetJob(ctx, tenantID, jobID)
	}
	// Job finished or not running.
	return p.repo.GetJob(ctx, tenantID, jobID)
}

// ===================================================================
// Internal helpers

// recordInitial creates the first database row for a job.
func (p *Processor) recordInitial(jobID, tenantID, userID, dataType,
	op, format string) {
	job := &models.Job{
		ID:        jobID,
		TenantID:  tenantID,
		UserID:    userID,
		DataType:  dataType,
		Operation: op,
		Status:    "processing",
		Format:    format,
		Progress:  0,
		ProgressMsg: "starting",
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}
	if err := p.repo.UpsertJob(context.Background(), job); err != nil {
		// Log but do not fail the job; the job will still run.
	}
}

// setJobStatus updates the job row and pushes a progress notification.
func (p *Processor) setJobStatus(jobID, status string, progress float64, msg string) {
	p.mu.RLock()
	job, ok := p.repo.GetJob(context.Background(), jobID, jobID) // best-effort
	p.mu.RUnlock()
	_ = job // TODO: read current job for delta update

	now := time.Now().UTC()
	_ = p.repo.UpsertJob(context.Background(), &models.Job{
		ID:        jobID,
		Status:    status,
		Progress:  progress,
		ProgressMsg: msg,
		UpdatedAt: now,
		FinishedAt: &now,
	})
}

// recordCompleted marks a successful export.
func (p *Processor) recordCompleted(jobID, tenantID, userID, dataType,
	op, format string) {
	now := time.Now().UTC()
	_ = p.repo.UpsertJob(context.Background(), &models.Job{
		ID:         jobID,
		TenantID:   tenantID,
		UserID:     userID,
		DataType:   dataType,
		Operation:  op,
		Status:     "completed",
		Format:     format,
		Progress:   100,
		ProgressMsg: "export complete",
		UpdatedAt:  now,
		FinishedAt: &now,
	})
}
