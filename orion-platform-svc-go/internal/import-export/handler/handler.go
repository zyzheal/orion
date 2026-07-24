package handler

import (
	"mime/multipart"
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/import-export/async"
	"orion/platform-svc-go/internal/import-export/models"
	"orion/platform-svc-go/internal/import-export/service"
	"orion/platform-svc-go/internal/middleware"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
)

type Handler struct {
	svc      *service.ImportExportService
	asyncSvc *async.Processor
}

func NewHandler(svc *service.ImportExportService, asyncSvc *async.Processor) *Handler {
	return &Handler{svc: svc, asyncSvc: asyncSvc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	write := auth.RequirePermission("system", "write")
	read := auth.RequirePermission("system", "read")

	// Synchronous import.
	rg.POST("/import/:data_type", write, h.Import)

	// Synchronous export (returns file).
	rg.POST("/export/:data_type", write, h.Export)

	// Validation (dry-run import).
	rg.POST("/import/validate/:data_type", write, h.Validate)

	// History listing.
	rg.GET("/import/history", read, h.ImportHistory)
	rg.GET("/import/history/:operation", read, h.ImportHistory)

	// Async progress polling.
	rg.GET("/import/:id/progress", read, h.Progress)
	rg.GET("/import/:id/errors", read, h.JobErrors)

	_ = write
}

// ---------------------------------------------------------------------------
// Import

func (h *Handler) Import(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Import")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	dataType := c.Param("data_type")

	// Parse multipart form.
	form, err := c.MultipartForm()
	if err != nil {
		middleware.RespondBadRequest(c, "multipart form required")
		return
	}

	fileHeaders, ok := form.File["file"]
	if !ok || len(fileHeaders) == 0 {
		middleware.RespondBadRequest(c, "file field required")
		return
	}

	file, err := fileHeaders[0].Open()
	if err != nil {
		middleware.RespondInternalError(c, "failed to open file")
		return
	}
	defer file.Close()

	format := c.PostForm("format")
	if format == "" {
		format = c.Request.URL.Query().Get("format")
	}
	if format == "" {
		middleware.RespondBadRequest(c, "format required (csv|json)")
		return
	}

	opts := &models.ImportOpts{
		Format:    format,
		HeaderRow: c.PostForm("header") != "false",
		DryRun:    c.PostForm("dry_run") == "true",
		OnError:   c.PostForm("on_error"),
		UserID:    userID,
		TenantID:  tenantID,
	}
	opts.HeaderRow = c.DefaultPostForm("header", "true") == "true"

	result, err := h.svc.Import(ctx, dataType, file, format, opts)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if result == nil {
		middleware.RespondBadRequest(c, "no import handler for data type: "+dataType)
		return
	}
	middleware.RespondCreated(c, result)
}

// ---------------------------------------------------------------------------
// Export

func (h *Handler) Export(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Export")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	dataType := c.Param("data_type")

	format := c.DefaultQuery("format", "csv")
	filter := map[string]interface{}{}

	// TODO: bind optional JSON filter body when present.

	opts := &models.ExportOpts{
		Format:   format,
		Headers:  true,
		UserID:   userID,
		TenantID: tenantID,
	}

	reader, contentType, err := h.svc.Export(ctx, dataType, filter, format, opts)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if reader == nil {
		middleware.RespondBadRequest(c, "no export handler for data type: "+dataType)
		return
	}

	ext := "csv"
	if format == "json" {
		ext = "json"
		contentType = "application/json"
	}

	c.Header("Content-Type", contentType)
	c.Header("Content-Disposition", "attachment; filename="+dataType+"."+ext)
	if reader2, ok := reader.(interface {
		Reset()
	}); ok {
		reader2.Reset()
	}
	c.Writer.Write([]byte{}) // flush headers
}

// ---------------------------------------------------------------------------
// Validate

func (h *Handler) Validate(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Validate")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	dataType := c.Param("data_type")

	form, err := c.MultipartForm()
	if err != nil {
		middleware.RespondBadRequest(c, "multipart form required")
		return
	}
	fileHeaders, ok := form.File["file"]
	if !ok || len(fileHeaders) == 0 {
		middleware.RespondBadRequest(c, "file field required")
		return
	}
	file, err := fileHeaders[0].Open()
	if err != nil {
		middleware.RespondInternalError(c, "failed to open file")
		return
	}
	defer file.Close()

	format := c.DefaultPostForm("format", "csv")

	errors, err := h.svc.Validate(ctx, dataType, file, format, &models.ImportOpts{
		UserID:   userID,
		TenantID: tenantID,
	})
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{
		"errors": errors,
	})
}

// ---------------------------------------------------------------------------
// History

func (h *Handler) ImportHistory(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ImportHistory")
	defer span.End()
	tenantID := c.GetString("tenant_id")

	operation := c.Param("operation")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))

	filter := &models.JobFilter{
		Operation: operation,
		Status:    c.Query("status"),
	}

	jobs, err := h.svc.GetHistory(ctx, tenantID, filter, limit)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{
		"jobs": jobs,
		"total": len(jobs),
	})
}

// ---------------------------------------------------------------------------
// Progress / Errors

func (h *Handler) Progress(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Progress")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	jobID := c.Param("id")

	job, err := h.svc.GetProgress(ctx, tenantID, jobID)
	if err != nil {
		middleware.RespondNotFound(c, "job not found")
		return
	}
	middleware.RespondSuccess(c, gin.H{
		"job":    job,
		"status": job.Status,
	})
}

func (h *Handler) JobErrors(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "JobErrors")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	jobID := c.Param("id")

	errors, err := h.svc.GetErrors(ctx, tenantID, jobID)
	if err != nil {
		middleware.RespondNotFound(c, "job not found")
		return
	}
	middleware.RespondSuccess(c, gin.H{
		"errors": errors,
		"total":  len(errors),
	})
}

