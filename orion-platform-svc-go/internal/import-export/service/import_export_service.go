package service

import (
	"context"
	"io"

	"orion/platform-svc-go/internal/import-export/factory"
	"orion/platform-svc-go/internal/import-export/models"
	"orion/platform-svc-go/internal/import-export/repository"
)

// ImportExportService is the application service for import/export operations.
//
// It is the entry point for all callers (handlers, workers) and orchestrates
// the handler selection, job persistence, and progress reporting.
type ImportExportService struct {
	factory *factory.Factory
	repo    *repository.Repository
}

// New creates a service bound to the given factory and repository.
func New(f *factory.Factory, repo *repository.Repository) *ImportExportService {
	return &ImportExportService{
		factory: f,
		repo:    repo,
	}
}

// Import selects the appropriate import handler and invokes its Import method.
//
// Returns a result immediately (synchronous import).  For large files use
// ImportAsync instead.
func (s *ImportExportService) Import(ctx context.Context, dataType string,
	source io.Reader, format string, opts *models.ImportOpts) (*models.ImportResult, error) {
	if opts == nil {
		opts = &models.ImportOpts{}
	}

	handler := s.factory.GetImportHandler(dataType)
	if handler == nil {
		return nil, nil
	}

	return handler.Import(ctx, source, format, opts)
}

// Validate selects the appropriate import handler and invokes its Validate method.
//
// Dry-runs import validation without writing any data.
func (s *ImportExportService) Validate(ctx context.Context, dataType string,
	source io.Reader, format string, opts *models.ImportOpts) ([]models.ValidationError, error) {
	if opts == nil {
		opts = &models.ImportOpts{}
	}

	handler := s.factory.GetImportHandler(dataType)
	if handler == nil {
		return nil, nil
	}

	return handler.Validate(ctx, source, format, opts)
}

// Export selects the appropriate export handler and returns the export stream.
func (s *ImportExportService) Export(ctx context.Context, dataType string,
	filter map[string]interface{}, format string, opts *models.ExportOpts) (io.Reader, string, error) {
	if opts == nil {
		opts = &models.ExportOpts{}
	}

	handler := s.factory.GetExportHandler(dataType)
	if handler == nil {
		return nil, "", nil
	}

	return handler.Export(ctx, filter, format, opts)
}

// GetHistory returns the list of import/export jobs for the tenant, filtered.
func (s *ImportExportService) GetHistory(ctx context.Context, tenantID string,
	filter *models.JobFilter, limit int) ([]models.Job, error) {
	return s.repo.ListJobs(ctx, tenantID, filter, limit)
}

// GetProgress returns the current status of a specific job.
func (s *ImportExportService) GetProgress(ctx context.Context, tenantID, jobID string) (
	*models.Job, error) {
	return s.repo.GetJob(ctx, tenantID, jobID)
}

// GetErrors returns the validation errors for a specific import job.
func (s *ImportExportService) GetErrors(ctx context.Context, tenantID, jobID string) (
	[]models.ValidationError, error) {
	return s.repo.GetErrorsForJob(ctx, tenantID, jobID)
}
