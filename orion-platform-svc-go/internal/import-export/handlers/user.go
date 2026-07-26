package handlers

import (
	"context"
	"io"
	"strings"
	"time"

	"orion/platform-svc-go/internal/import-export/formatters"
	"orion/platform-svc-go/internal/import-export/interfaces"
	"orion/platform-svc-go/internal/import-export/models"
	userModels "orion/platform-svc-go/internal/user/models"
	"orion/platform-svc-go/internal/user/service"

	"github.com/google/uuid"
)

// UserHandler is the import/export handler for the user data type.
//
// It coordinates the user service with the formatter layer to import CSV/
// JSON files and to export user lists.  Excel is a TODO.
type UserHandler struct {
	userSvc *service.Service
}

func NewUserHandler(svc *service.Service) *UserHandler {
	return &UserHandler{userSvc: svc}
}

func (h *UserHandler) DataType() string { return "user" }

// -----------------------------------------------------------------------
// Import

func (h *UserHandler) Import(ctx context.Context, source io.Reader, format string,
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

	// 3. Insert via user service.
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
		if err := h.createUser(ctx, opts.TenantID, row); err != nil {
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

func (h *UserHandler) Validate(ctx context.Context, source io.Reader, format string,
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

func (h *UserHandler) parseRows(source io.Reader, format string, hasHeader bool) ([]map[string]interface{}, error) {
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

func (h *UserHandler) validateRows(rows []map[string]interface{}, opts *models.ImportOpts) []models.ValidationError {
	var errs []models.ValidationError
	for i, row := range rows {
		num := i + 1
		username := getString(row, "username")
		if opts != nil && username == "" {
			errs = append(errs, models.ValidationError{
				JobID:     opts.UserID,
				RowNumber: num,
				Field:     "username",
				Message:   "username is required",
				ErrType:   "missing_field",
			})
		}
		email := getString(row, "email")
		if opts != nil && email != "" && !strings.Contains(email, "@") {
			errs = append(errs, models.ValidationError{
				JobID:     opts.UserID,
				RowNumber: num,
				Field:     "email",
				Message:   "invalid email format",
				ErrType:   "invalid_format",
			})
		}
	}
	return errs
}

func (h *UserHandler) createUser(ctx context.Context, tenantID string, row map[string]interface{}) error {
	req := userModels.CreateUserRequest{
		Username: getString(row, "username"),
		Email:    getString(row, "email"),
		Password: getString(row, "password"),
		FullName: getString(row, "displayName"),
		Role:     getString(row, "role"),
	}
	_, err := h.userSvc.Create(ctx, tenantID, getString(row, "creatorID"), &req)
	return err
}

func (h *UserHandler) GetImportColumns() []interfaces.ImportColumn {
	return []interfaces.ImportColumn{
		{Name: "ID", Field: "id", Type: "string"},
		{Name: "Username", Field: "username", Required: true, Type: "string"},
		{Name: "Email", Field: "email", Required: true, Type: "string"},
		{Name: "Display Name", Field: "displayName", Type: "string"},
		{Name: "Role", Field: "role", Type: "string"},
		{Name: "Status", Field: "status", Type: "string"},
	}
}

// -----------------------------------------------------------------------
// Export

func (h *UserHandler) Export(ctx context.Context, filter map[string]interface{}, format string,
	opts *models.ExportOpts) (io.Reader, string, error) {
	if opts == nil {
		opts = &models.ExportOpts{}
	}
	opts.Format = strings.ToLower(format)

	_ = filter
	// TODO: query real users via user service.
	var users []map[string]interface{}

	switch opts.Format {
	case "json":
		return readerFromBytes(formatToJSON(users)), "application/json", nil
	case "csv":
		return formatToCSV(users), "text/csv", nil
	case "excel":
		return nil, "", nil
	default:
		return nil, "", nil
	}
}
