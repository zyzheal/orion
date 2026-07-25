// Package handler provides HTTP handlers for the CMDB Import service.
// All endpoints are mounted under the api.RouterGroup via RegisterRoutes.
//
// API contract:
//   POST   /api/cmdb/import/jobs           - Create import job
//   GET    /api/cmdb/import/jobs           - List jobs (paginated)
//   GET    /api/cmdb/import/jobs/:id       - Get job details
//   POST   /api/cmdb/import/jobs/:id/start - Start job
//   POST   /api/cmdb/import/jobs/:id/cancel - Cancel job
//   GET    /api/cmdb/import/jobs/:id/records - Get import records
//   POST   /api/cmdb/import/validate       - Validate source before import
package handler

import (
	"context"
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/cmdb-import/models"
	"orion/platform-svc-go/internal/middleware"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
)

// Service defines the methods the handler calls on the service layer.
type Service interface {
	CreateJob(ctx context.Context, tenantID, name, sourceType, sourcePath, targetType, mode string, mapping map[string]string) (*models.CMDBImportJob, error)
	StartJob(ctx context.Context, jobID string) error
	GetJob(ctx context.Context, tenantID, jobID string) (*models.CMDBImportJob, error)
	ListJobs(ctx context.Context, tenantID, status string, offset, limit int) ([]models.CMDBImportJob, error)
	CancelJob(ctx context.Context, tenantID, jobID string) error
	ValidateSource(ctx context.Context, sourceType, sourcePath string, mapping, config map[string]string) (*models.ValidateImportResponse, error)
}

type Handler struct{ svc Service }

func NewHandler(svc Service) *Handler { return &Handler{svc: svc} }

// RegisterRoutes mounts all CMDB import endpoints.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.POST("/cmdb/import/jobs", auth.RequirePermission("cmdb-import", "write"), h.CreateJob)
	rg.GET("/cmdb/import/jobs", auth.RequirePermission("cmdb-import", "read"), h.ListJobs)
	rg.GET("/cmdb/import/jobs/:id", auth.RequirePermission("cmdb-import", "read"), h.GetJob)
	rg.POST("/cmdb/import/jobs/:id/start", auth.RequirePermission("cmdb-import", "write"), h.StartJob)
	rg.POST("/cmdb/import/jobs/:id/cancel", auth.RequirePermission("cmdb-import", "write"), h.CancelJob)
	rg.GET("/cmdb/import/jobs/:id/records", auth.RequirePermission("cmdb-import", "read"), h.GetRecords)
	rg.POST("/cmdb/import/validate", auth.RequirePermission("cmdb-import", "write"), h.Validate)
}

// ===========================================================================
// Job management
// ===========================================================================

// CreateJob creates a new import job.
func (h *Handler) CreateJob(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateImportJob")
	defer span.End()

	tenantID := c.GetString("tenant_id")
	var req models.CreateImportJobRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	job, err := h.svc.CreateJob(ctx, tenantID, req.Name, req.SourceType,
		req.SourcePath, req.TargetType, req.Mode, req.Mapping)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}

	middleware.RespondCreated(c, gin.H{
		"id":         job.ID,
		"source_type": job.SourceType,
		"status":     job.Status,
		"target_type": job.TargetType,
		"mode":       job.Mode,
		"name":       job.Name,
	})
}

// ListJobs returns paginated import jobs for a tenant.
func (h *Handler) ListJobs(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListImportJobs")
	defer span.End()

	tenantID := c.GetString("tenant_id")
	status := c.Query("status")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	ps, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	offset := (page - 1) * ps
	limit := ps
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}

	jobs, err := h.svc.ListJobs(ctx, tenantID, status, offset, limit)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if jobs == nil {
		jobs = []models.CMDBImportJob{}
	}

	middleware.RespondPaginated(c, jobs, offset, limit, len(jobs))
}

// GetJob returns job details by ID.
func (h *Handler) GetJob(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetImportJob")
	defer span.End()

	tenantID := c.GetString("tenant_id")
	jobID := c.Param("id")
	job, err := h.svc.GetJob(ctx, tenantID, jobID)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}

	middleware.RespondSuccess(c, job)
}

// StartJob starts a pending import job.
func (h *Handler) StartJob(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "StartImportJob")
	defer span.End()

	jobID := c.Param("id")
	err := h.svc.StartJob(ctx, jobID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}

	middleware.RespondSuccess(c, gin.H{
		"status":   "started",
		"job_id":   jobID,
		"message":  "import job started",
	})
}

// CancelJob cancels a running or pending import job.
func (h *Handler) CancelJob(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CancelImportJob")
	defer span.End()

	tenantID := c.GetString("tenant_id")
	jobID := c.Param("id")
	err := h.svc.CancelJob(ctx, tenantID, jobID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}

	middleware.RespondSuccess(c, gin.H{
		"status":  "cancelled",
		"job_id":  jobID,
		"message": "import job cancelled",
	})
}

// GetRecords returns import records for a job (paginated).
func (h *Handler) GetRecords(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetImportRecords")
	defer span.End()

	tenantID := c.GetString("tenant_id")
	jobID := c.Param("id")
	_ = tenantID

	// Validate job ownership first
	_, err := h.svc.GetJob(ctx, tenantID, jobID)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}

	// TODO: when repository exposes ListRecordsByJob, wire it through
	//       service layer. For now return success with empty records.
	middleware.RespondSuccess(c, gin.H{
		"job_id":  jobID,
		"records": []interface{}{},
	})
}

// Validate validates a source before creating an import job.
func (h *Handler) Validate(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ValidateImportSource")
	defer span.End()

	var req models.ValidateImportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	resp, err := h.svc.ValidateSource(ctx, req.SourceType, req.SourcePath,
		req.Mapping, req.Config)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}

	middleware.RespondSuccess(c, resp)
}
