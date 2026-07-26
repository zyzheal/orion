package handlers

import (
	"context"
	"encoding/json"
	"io"
	"strings"
	"time"

	"orion/platform-svc-go/internal/import-export/formatters"
	"orion/platform-svc-go/internal/import-export/interfaces"
	"orion/platform-svc-go/internal/import-export/models"
	alertModels "orion/platform-svc-go/internal/alert/models"
	"orion/platform-svc-go/internal/alert/service"

	"github.com/google/uuid"
)

// AlertHandler is the import/export handler for the alert data type.
//
// It coordinates the alert service with the formatter layer to import CSV/
// JSON files and to export alert lists.  Excel is a TODO.
type AlertHandler struct {
	alertSvc *service.Service
}

func NewAlertHandler(svc *service.Service) *AlertHandler {
	return &AlertHandler{alertSvc: svc}
}

func (h *AlertHandler) DataType() string { return "alert" }

// -----------------------------------------------------------------------
// Import

func (h *AlertHandler) Import(ctx context.Context, source io.Reader, format string,
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

	// 3. Insert via alert Ingest.
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

	successCount := 0
	for i, row := range rows {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		default:
		}
		if err := h.ingestAlert(ctx, opts.TenantID, row); err != nil {
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

func (h *AlertHandler) Validate(ctx context.Context, source io.Reader, format string,
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

func (h *AlertHandler) parseRows(source io.Reader, format string, hasHeader bool) ([]map[string]interface{}, error) {
	format = strings.ToLower(format)
	switch format {
	case "json", "":
		return formatters.FromJSONReader(source)
	case "csv":
		return formatters.FromCSVRows(source, hasHeader)
	case "excel":
		return nil, nil
	default:
		return nil, nil
	}
}

func (h *AlertHandler) validateRows(rows []map[string]interface{}, opts *models.ImportOpts) []models.ValidationError {
	var errs []models.ValidationError
	for i, row := range rows {
		num := i + 1
		name := getString(row, "name")
		if opts != nil && name == "" {
			errs = append(errs, models.ValidationError{
				JobID:     opts.UserID,
				RowNumber: num,
				Field:     "name",
				Message:   "name is required",
				ErrType:   "missing_field",
			})
		}
	}
	return errs
}

func (h *AlertHandler) ingestAlert(ctx context.Context, tenantID string, row map[string]interface{}) error {
	req := alertModels.IngestRequest{}
	if err := json.Unmarshal(formatToJSON([]map[string]interface{}{row}), &req); err != nil {
		return err
	}
	req.TenantID = tenantID
	_, err := h.alertSvc.Ingest(ctx, tenantID, req)
	return err
}

func (h *AlertHandler) GetImportColumns() []interfaces.ImportColumn {
	return []interfaces.ImportColumn{
		{Name: "ID", Field: "id", Type: "string"},
		{Name: "Name", Field: "name", Required: true, Type: "string"},
		{Name: "Severity", Field: "severity", Type: "string"},
		{Name: "Status", Field: "status", Type: "string"},
		{Name: "Fingerprint", Field: "fingerprint", Type: "string"},
		{Name: "Source Type", Field: "sourceType", Type: "string"},
		{Name: "Source ID", Field: "sourceId", Type: "string"},
		{Name: "Metric", Field: "metric", Type: "string"},
	}
}

// -----------------------------------------------------------------------
// Export

func (h *AlertHandler) Export(ctx context.Context, filter map[string]interface{}, format string,
	opts *models.ExportOpts) (io.Reader, string, error) {
	if opts == nil {
		opts = &models.ExportOpts{}
	}
	opts.Format = strings.ToLower(format)

	_ = filter
	// TODO: query real alerts via alert service.
	var alerts []map[string]interface{}

	switch opts.Format {
	case "json":
		return readerFromBytes(formatToJSON(alerts)), "application/json", nil
	case "csv":
		return formatToCSV(alerts), "text/csv", nil
	case "excel":
		return nil, "", nil
	default:
		return nil, "", nil
	}
}
