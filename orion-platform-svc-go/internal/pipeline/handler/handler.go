package handler

import (
	"context"
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/pipeline/models"
	"orion/platform-svc-go/internal/pipeline/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
	"go.opentelemetry.io/otel"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	r := rg.Group("/pipeline")

	// Pipelines CRUD
	r.GET("",
		auth.RequirePermission("pipeline", "read"),
		h.ListPipelines)
	r.POST("",
		auth.RequirePermission("pipeline", "write"),
		h.CreatePipeline)
	r.GET("/:id",
		auth.RequirePermission("pipeline", "read"),
		h.GetPipeline)
	r.PUT("/:id",
		auth.RequirePermission("pipeline", "write"),
		h.UpdatePipeline)
	r.DELETE("/:id",
		auth.RequirePermission("pipeline", "delete"),
		h.DeletePipeline)

	// Validation
	r.POST("/validate",
		auth.RequirePermission("pipeline", "write"),
		h.ValidatePipeline)

	// Runs
	r.POST("/:id/run",
		auth.RequirePermission("pipeline", "write"),
		h.StartRun)
	r.POST("/runs/:runId/stop",
		auth.RequirePermission("pipeline", "write"),
		h.StopRun)

	// Batch operations
	r.POST("/batch/start",
		auth.RequirePermission("pipeline", "write"),
		h.BatchStart)
	r.POST("/batch/stop",
		auth.RequirePermission("pipeline", "write"),
		h.BatchStop)
	r.POST("/batch/delete",
		auth.RequirePermission("pipeline", "delete"),
		h.BatchDelete)

	// Stats & Versions
	r.GET("/:id/stats",
		auth.RequirePermission("pipeline", "read"),
		h.GetStats)
	r.GET("/:id/versions",
		auth.RequirePermission("pipeline", "read"),
		h.GetVersions)
}

// === CRUD ===

func (h *Handler) ListPipelines(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListPipelines")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx := middleware.TimeoutContext(c)

	opt := models.ListPipelinesOptions{}
	if proj := c.Query("projectId"); proj != "" {
		opt.ProjectID = proj
	}
	if status := c.Query("status"); status != "" {
		opt.Status = status
	}
	if name := c.Query("name"); name != "" {
		opt.Name = name
	}
	if pageStr := c.Query("page"); pageStr != "" {
		opt.Page, _ = strconv.Atoi(pageStr)
	}
	if limitStr := c.Query("limit"); limitStr != "" {
		opt.Limit, _ = strconv.Atoi(limitStr)
	}
	if opt.Page <= 0 {
		opt.Page = 1
	}
	if opt.Limit <= 0 || opt.Limit > 100 {
		opt.Limit = 20
	}

	pipelines, total, err := h.svc.ListPipelines(ctx, tenantID, opt)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{
		"data":  pipelines,
		"total": total,
	})
}

func (h *Handler) CreatePipeline(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreatePipeline")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx := middleware.TimeoutContext(c)

	var req models.CreatePipelineRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	pipeline, err := h.svc.CreatePipeline(ctx, tenantID, req)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondCreated(c, pipeline)
}

func (h *Handler) GetPipeline(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetPipeline")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx := middleware.TimeoutContext(c)
	pipeline, err := h.svc.GetPipeline(ctx, tenantID, c.Param("id"))
	if err != nil {
		middleware.RespondNotFound(c, "pipeline not found")
		return
	}
	middleware.RespondSuccess(c, pipeline)
}

func (h *Handler) UpdatePipeline(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdatePipeline")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx := middleware.TimeoutContext(c)

	var req models.UpdatePipelineRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	pipeline, err := h.svc.UpdatePipeline(ctx, tenantID, c.Param("id"), req)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, pipeline)
}

func (h *Handler) DeletePipeline(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeletePipeline")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx := middleware.TimeoutContext(c)
	deleted, err := h.svc.DeletePipeline(ctx, tenantID, c.Param("id"))
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if !deleted {
		middleware.RespondNotFound(c, "pipeline not found")
		return
	}
	middleware.RespondSuccess(c, nil) // c)
}

// === Validation ===

func (h *Handler) ValidatePipeline(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ValidatePipeline")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx := middleware.TimeoutContext(c)

	var req models.CreatePipelineRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	result, err := h.svc.ValidatePipeline(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

// === Runs ===

func (h *Handler) StartRun(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "StartRun")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx := middleware.TimeoutContext(c)
	result, err := h.svc.StartRun(ctx, tenantID, c.Param("id"))
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) StopRun(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "StopRun")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx := middleware.TimeoutContext(c)
	err := h.svc.StopRun(ctx, tenantID, c.Param("runId"))
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "run stopped"})
}

// === Batch ===

func (h *Handler) BatchStart(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "BatchStart")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx := middleware.TimeoutContext(c)

	var req struct {
		PipelineIDs []string `json:"pipelineIds" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	results, err := h.svc.BatchStart(ctx, tenantID, req.PipelineIDs)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, results)
}

func (h *Handler) BatchStop(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "BatchStop")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx := middleware.TimeoutContext(c)

	var req struct {
		RunIDs []string `json:"runIds" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	results, err := h.svc.BatchStop(ctx, tenantID, req.RunIDs)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, results)
}

func (h *Handler) BatchDelete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "BatchDelete")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx := middleware.TimeoutContext(c)

	var req struct {
		PipelineIDs []string `json:"pipelineIds" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	results, err := h.svc.BatchDelete(ctx, tenantID, req.PipelineIDs)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, results)
}

// === Stats & Versions ===

func (h *Handler) GetStats(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetStats")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx := middleware.TimeoutContext(c)
	stats, err := h.svc.GetStats(ctx, tenantID, c.Param("id"))
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, stats)
}

func (h *Handler) GetVersions(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetVersions")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx := middleware.TimeoutContext(c)
	versions, err := h.svc.GetVersions(ctx, tenantID, c.Param("id"))
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, versions)
}
