package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/cron/service"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"orion/platform-svc-go/internal/middleware"
)

// SchedulerHandler handles the SchedulerManager IJob lifecycle endpoints.
type SchedulerHandler struct {
	sm *service.SchedulerManager
}

// NewSchedulerHandler creates a SchedulerHandler.
func NewSchedulerHandler(sm *service.SchedulerManager) *SchedulerHandler {
	return &SchedulerHandler{sm: sm}
}

// RegisterRoutes mounts all SchedulerManager endpoints onto the given router group.
func (h *SchedulerHandler) RegisterRoutes(rg *gin.RouterGroup) {
	// POST   /api/cron/scheduler/jobs              - Create job
	// GET    /api/cron/scheduler/jobs              - List jobs
	// GET    /api/cron/scheduler/jobs/:id          - Get job
	// PUT    /api/cron/scheduler/jobs/:id          - Update job
	// POST   /api/cron/scheduler/jobs/:id/enable   - Enable job
	// POST   /api/cron/scheduler/jobs/:id/disable  - Disable job
	// POST   /api/cron/scheduler/jobs/:id/run      - Run job now
	// GET    /api/cron/scheduler/jobs/:id/logs     - Get execution logs

	jobs := rg.Group("/cron/scheduler/jobs")
	jobs.POST("", auth.RequirePermission("cron", "write"), h.Create)
	jobs.GET("", auth.RequirePermission("cron", "read"), h.List)
	jobs.GET("/:id", auth.RequirePermission("cron", "read"), h.Get)
	jobs.PUT("/:id", auth.RequirePermission("cron", "write"), h.Update)
	jobs.POST("/:id/enable", auth.RequirePermission("cron", "write"), h.EnableJob)
	jobs.POST("/:id/disable", auth.RequirePermission("cron", "write"), h.DisableJob)
	jobs.POST("/:id/run", auth.RequirePermission("cron", "write"), h.RunJobNow)
	jobs.GET("/:id/logs", auth.RequirePermission("cron", "read"), h.GetLogs)
}

type createJobRequest struct {
	Name       string            `json:"name" binding:"required"`
	CronExpr   string            `json:"cron_expr" binding:"required"`
	JobType    string            `json:"job_type" binding:"required"`
	Config     map[string]string `json:"config"`
	MaxRetries int               `json:"max_retries"`
	TimeoutSec int               `json:"timeout_sec"`
	Enabled    *bool             `json:"enabled"`
}

func (h *SchedulerHandler) Create(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SchedulerCreate")
	defer span.End()

	var req createJobRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	// Use tenant ID from auth middleware ONLY — never from request body
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		middleware.RespondUnauthorized(c, "tenant_id not found in context")
		return
	}

	config := req.Config
	if config == nil {
		config = make(map[string]string)
	}

	j, err := h.sm.CreateJob(c.Request.Context(), tenantID, req.Name, req.CronExpr, req.JobType, config)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, j)
}

func (h *SchedulerHandler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SchedulerList")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		tenantID = c.Query("tenant_id")
	}
	items, err := h.sm.ListJobs(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, items)
}

func (h *SchedulerHandler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SchedulerGet")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	m, err := h.sm.GetJob(ctx, tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, "not found")
		return
	}
	middleware.RespondSuccess(c, m)
}

type updateJobRequest struct {
	Name       *string           `json:"name"`
	CronExpr   *string           `json:"cron_expr"`
	JobType    *string           `json:"job_type"`
	Config     map[string]string `json:"config"`
	MaxRetries *int              `json:"max_retries"`
	TimeoutSec *int              `json:"timeout_sec"`
}

func (h *SchedulerHandler) Update(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SchedulerUpdate")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	var req updateJobRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.CronExpr != nil {
		updates["cron_expr"] = *req.CronExpr
	}
	if req.JobType != nil {
		updates["job_type"] = *req.JobType
	}
	if req.Config != nil {
		updates["config"] = req.Config
	}
	if req.MaxRetries != nil {
		updates["max_retries"] = *req.MaxRetries
	}
	if req.TimeoutSec != nil {
		updates["timeout_sec"] = *req.TimeoutSec
	}

	if len(updates) == 0 {
		middleware.RespondBadRequest(c, "no fields to update")
		return
	}

	m, err := h.sm.UpdateJob(ctx, tenantID, id, updates)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, m)
}

func (h *SchedulerHandler) EnableJob(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SchedulerEnableJob")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.sm.EnableJob(ctx, tenantID, id); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "job enabled"})
}

func (h *SchedulerHandler) DisableJob(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SchedulerDisableJob")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.sm.DisableJob(ctx, tenantID, id); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "job disabled"})
}

type runJobRequest struct {
	TenantID string `json:"tenant_id"`
}

func (h *SchedulerHandler) RunJobNow(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SchedulerRunJobNow")
	defer span.End()

	// Use tenant ID from auth middleware ONLY — never from request body
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		middleware.RespondUnauthorized(c, "tenant_id not found in context")
		return
	}
	var req runJobRequest
	_ = c.ShouldBindJSON(&req) // bind for validation; ignore tenant_id field
	id := c.Param("id")

	log, err := h.sm.RunJobNow(ctx, tenantID, id)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, log)
}

func (h *SchedulerHandler) GetLogs(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SchedulerGetLogs")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	logs, err := h.sm.GetExecutionLogs(ctx, tenantID, id, limit)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, logs)
}
