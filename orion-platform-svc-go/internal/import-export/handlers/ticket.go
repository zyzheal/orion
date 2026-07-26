package handlers

import (
	"context"
	"io"
	"strings"
	"time"

	"orion/platform-svc-go/internal/import-export/formatters"
	"orion/platform-svc-go/internal/import-export/interfaces"
	"orion/platform-svc-go/internal/import-export/models"
	ticketingmodels "orion/platform-svc-go/internal/ticketing/models"
	"orion/platform-svc-go/internal/ticketing/service"

	"github.com/google/uuid"
)

func (h *TicketHandler) importInsertTicket(ctx context.Context, tenantID string, row map[string]interface{}) error {
	req := ticketingmodels.CreateTicketRequest{
		Title:       getString(row, "title"),
		Description: getString(row, "description"),
		Type:        getString(row, "type"),
		Priority:    getString(row, "priority"),
		Category:    getString(row, "category"),
		Source:      "import-export",
	}
	_, err := h.ticketingSvc.CreateTicket(ctx, tenantID, req, getString(row, "created_by"))
	return err
}

// TicketHandler is the import/export handler for the ticket data type.
//
// It coordinates the ticketing service with the formatter layer to import CSV/
// JSON files and to export ticket lists.  Excel is a TODO (see formatters/excel.go).
type TicketHandler struct {
	ticketingSvc *service.Service
}

func NewTicketHandler(svc *service.Service) *TicketHandler {
	return &TicketHandler{ticketingSvc: svc}
}

func (h *TicketHandler) DataType() string { return "ticket" }

// -----------------------------------------------------------------------
// Import

func (h *TicketHandler) Import(ctx context.Context, source io.Reader, format string,
	opts *models.ImportOpts) (*models.ImportResult, error) {
	if opts == nil {
		opts = &models.ImportOpts{}
	}
	opts.Format = format

	jobID := uuid.New().String()

	// 1. Parse source rows.
	rows, err := h.parseRows(source, format, opts.HeaderRow)
	if err != nil {
		return nil, err
	}

	// 2. Validate.
	errors := h.validateRows(rows, opts)
	if len(errors) > 0 && opts.OnError == "abort" {
		return &models.ImportResult{
			JobID:      jobID,
			Mode:       "sync",
			Message:    "import aborted: validation errors found",
			TotalCount: len(rows),
			ErrorCount: len(errors),
			Errors:     errors,
		}, nil
	}

	// 3. Insert in batches (respect DryRun).
	successCount := 0
	if opts.DryRun {
		return &models.ImportResult{
			JobID:      jobID,
			Mode:       "sync",
			Message:    "dry run complete",
			TotalCount: len(rows),
			ErrorCount: len(errors),
			Errors:     errors,
		}, nil
	}

	batchSize := opts.BatchSize
	if batchSize <= 0 {
		batchSize = 500
	}
	for i := 0; i < len(rows); i += batchSize {
		batch := rows[i:min(i+batchSize, len(rows))]
		for _, r := range batch {
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			default:
			}
			if err := h.insertTicket(ctx, opts.TenantID, r); err != nil {
				errors = append(errors, models.ValidationError{
					JobID:     jobID,
					RowNumber: i + 1,
					Message:   err.Error(),
					ErrType:   "constraint",
					CreatedAt: time.Now().UTC(),
				})
			} else {
				successCount++
			}
		}
	}

	return &models.ImportResult{
		JobID:        jobID,
		Mode:         "sync",
		Message:      "import complete",
		TotalCount:   len(rows),
		SuccessCount: successCount,
		ErrorCount:   len(errors),
		Errors:       errors,
	}, nil
}

func (h *TicketHandler) Validate(ctx context.Context, source io.Reader, format string,
	opts *models.ImportOpts) ([]models.ValidationError, error) {
	if opts == nil {
		opts = &models.ImportOpts{}
	}
	opts.Format = format
	rows, err := h.parseRows(source, format, opts.HeaderRow)
	if err != nil {
		return nil, err
	}
	return h.validateRows(rows, opts), nil
}

func (h *TicketHandler) parseRows(source io.Reader, format string, hasHeader bool) ([]map[string]interface{}, error) {
	format = strings.ToLower(format)
	switch format {
	case "json", "":
		return formatters.FromJSONReader(source)
	case "csv":
		return formatters.FromCSVRows(source, hasHeader)
	case "excel":
		// TODO: wire excelize once the dependency is added.
		return nil, nil
	default:
		return nil, nil
	}
	return nil, nil
}

func (h *TicketHandler) validateRows(rows []map[string]interface{}, opts *models.ImportOpts) []models.ValidationError {
	var errs []models.ValidationError
	for i, row := range rows {
		num := i + 1
		title := getString(row, "title")
		if opts != nil && title == "" {
			errs = append(errs, models.ValidationError{
				JobID:     opts.UserID,
				RowNumber: num,
				Field:     "title",
				Message:   "title is required",
				ErrType:   "missing_field",
			})
		}
	}
	return errs
}

func (h *TicketHandler) insertTicket(ctx context.Context, tenantID string, row map[string]interface{}) error {
	req := ticketingmodels.CreateTicketRequest{
		Title:      getString(row, "title"),
		Description: getString(row, "description"),
		Type:       getString(row, "type"),
		Priority:   getString(row, "priority"),
		Category:   getString(row, "category"),
		Source:     "import-export",
	}
	_, err := h.ticketingSvc.CreateTicket(ctx, tenantID, req, getString(row, "created_by"))
	return err
}

func (h *TicketHandler) GetImportColumns() []interfaces.ImportColumn {
	return []interfaces.ImportColumn{
		{Name: "ID", Field: "id", Type: "string"},
		{Name: "Title", Field: "title", Required: true, Type: "string"},
		{Name: "Description", Field: "description", Type: "string"},
		{Name: "Status", Field: "status", Type: "string"},
		{Name: "Priority", Field: "priority", Type: "string"},
		{Name: "Category", Field: "category", Type: "string"},
		{Name: "Reporter ID", Field: "reporter_id", Type: "string"},
		{Name: "Assignee ID", Field: "assignee_id", Type: "string"},
	}
}

// -----------------------------------------------------------------------
// Export

func (h *TicketHandler) Export(ctx context.Context, filter map[string]interface{}, format string,
	opts *models.ExportOpts) (io.Reader, string, error) {
	if opts == nil {
		opts = &models.ExportOpts{}
	}
	opts.Format = strings.ToLower(format)

	_ = opts.TenantID
	// TODO: query real tickets via ticketing service.
	var tickets []map[string]interface{}
	// Placeholder; replace with real service call.

	switch opts.Format {
	case "json":
		return readerFromBytes(formatToJSON(tickets)), "application/json", nil
	case "csv":
		return formatToCSV(tickets), "text/csv", nil
	case "excel":
		return nil, "", nil
	default:
		return nil, "", nil
	}
}
