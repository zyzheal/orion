package handler

import (
	"net/http"
	"strconv"

	"orion/pipeline-svc-go/internal/models"
	"orion/pipeline-svc-go/internal/service"
	"orion/go-common/pkg/auth"

	"github.com/gin-gonic/gin"
)

// Handler provides HTTP handlers for pipeline operations.
type Handler struct {
	svc *service.PipelineService
}

func NewHandler(svc *service.PipelineService) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers pipeline routes on the given router group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	pipelines := rg.Group("/pipelines")
	{
		// Read: all authenticated users
		pipelines.GET("", h.ListPipelines)
		pipelines.GET("/:id", h.GetPipeline)
		pipelines.GET("/count", h.Count)
		pipelines.GET("/:id/stats", h.GetPipelineStats)

		// Write: require pipeline:write
		pipelines.POST("", auth.RequirePermission("pipeline", "write"), h.CreatePipeline)
		pipelines.PUT("/:id", auth.RequirePermission("pipeline", "write"), h.UpdatePipeline)

		// Execute: require pipeline:execute
		pipelines.POST("/:id/run", auth.RequirePermission("pipeline", "execute"), h.RunPipeline)
		pipelines.POST("/:id/runs", auth.RequirePermission("pipeline", "execute"), h.TriggerRun)

		// Delete: require pipeline:delete
		pipelines.DELETE("/:id", auth.RequirePermission("pipeline", "delete"), h.Delete)
	}

	runs := rg.Group("/runs")
	{
		// Read: all authenticated users
		runs.GET("", h.ListRuns)
		runs.GET("/:id", h.GetRun)
		runs.GET("/:id/status", h.GetRunStatus)
		runs.GET("/:id/stages", h.GetRunStages)
		runs.GET("/:id/logs", h.GetRunLogs)

		// Execute: require pipeline:execute
		runs.POST("/:id/cancel", auth.RequirePermission("pipeline", "execute"), h.CancelRun)
	}
}

// ==================== Pipeline Handlers ====================

func (h *Handler) CreatePipeline(c *gin.Context) {
	var pipeline models.Pipeline
	if err := c.ShouldBindJSON(&pipeline); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	pipeline.TenantID = c.GetString("tenant_id")
	if err := h.svc.Create(c.Request.Context(), &pipeline); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, pipeline)
}

func (h *Handler) GetPipeline(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	pipeline, err := h.svc.GetByID(c.Request.Context(), tenantID, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "pipeline not found"})
		return
	}

	c.JSON(http.StatusOK, pipeline)
}

func (h *Handler) ListPipelines(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	pipelines, err := h.svc.List(c.Request.Context(), tenantID, offset, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": pipelines})
}

func (h *Handler) UpdatePipeline(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	var pipeline models.Pipeline
	if err := c.ShouldBindJSON(&pipeline); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	pipeline.ID = id
	pipeline.TenantID = tenantID
	if err := h.svc.Update(c.Request.Context(), &pipeline); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "updated"})
}

func (h *Handler) Delete(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.Delete(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

func (h *Handler) Count(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	count, err := h.svc.Count(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"count": count})
}

// ==================== Pipeline Run Handlers ====================

// RunPipeline starts a new pipeline execution.
func (h *Handler) RunPipeline(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	pipelineID := c.Param("id")

	var req models.RunPipelineRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		// Default to manual trigger if body is empty/invalid
		req.TriggerType = models.TriggerManual
	}
	if req.TriggerType == "" {
		req.TriggerType = models.TriggerManual
	}

	run, err := h.svc.RunPipeline(c.Request.Context(), tenantID, pipelineID, req)
	if err != nil {
		if err == service.ErrPipelineNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, run)
}

// TriggerRun is the legacy trigger endpoint.
func (h *Handler) TriggerRun(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	triggeredBy := c.GetString("user_id")
	pipelineID := c.Param("id")

	var req struct {
		TriggerType string `json:"trigger_type"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		req.TriggerType = "manual"
	}
	if req.TriggerType == "" {
		req.TriggerType = "manual"
	}

	run, err := h.svc.TriggerRun(c.Request.Context(), tenantID, pipelineID, req.TriggerType, triggeredBy)
	if err != nil {
		if err == service.ErrPipelineNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, run)
}

// GetRun returns a pipeline run by ID.
func (h *Handler) GetRun(c *gin.Context) {
	id := c.Param("id")

	run, err := h.svc.GetRunByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "run not found"})
		return
	}

	c.JSON(http.StatusOK, run)
}

// GetRunStatus returns the current status of a pipeline run.
func (h *Handler) GetRunStatus(c *gin.Context) {
	id := c.Param("id")

	run, err := h.svc.GetRunStatus(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "run not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":           run.ID,
		"pipeline_id":  run.PipelineID,
		"status":       run.Status,
		"started_at":   run.StartedAt,
		"completed_at": run.CompletedAt,
		"duration_ms":  run.DurationMs,
		"trigger_type": run.TriggerType,
		"trigger_by":   run.TriggerBy,
	})
}

// GetRunStages returns all stages for a run.
func (h *Handler) GetRunStages(c *gin.Context) {
	runID := c.Param("id")

	stages, err := h.svc.GetStages(c.Request.Context(), runID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": stages})
}

// GetRunLogs returns execution logs for all stages in a run.
func (h *Handler) GetRunLogs(c *gin.Context) {
	runID := c.Param("id")

	logs, err := h.svc.GetRunLogs(c.Request.Context(), runID)
	if err != nil {
		if err == service.ErrRunNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": logs})
}

// CancelRun cancels a running pipeline run.
func (h *Handler) CancelRun(c *gin.Context) {
	runID := c.Param("id")

	run, err := h.svc.CancelRun(c.Request.Context(), runID)
	if err != nil {
		if err == service.ErrRunNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		if err == service.ErrRunNotCancellable {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, run)
}

// ListRuns lists pipeline runs with optional filtering.
func (h *Handler) ListRuns(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	filter := models.PipelineRunFilter{
		TenantID:    tenantID,
		PipelineID:  c.Query("pipeline_id"),
		Status:      models.PipelineRunStatus(c.Query("status")),
		TriggerType: models.TriggerType(c.Query("trigger_type")),
	}

	if limit, err := strconv.Atoi(c.DefaultQuery("limit", "20")); err == nil {
		filter.Limit = limit
	}
	if offset, err := strconv.Atoi(c.DefaultQuery("offset", "0")); err == nil {
		filter.Offset = offset
	}

	result, err := h.svc.ListRuns(c.Request.Context(), filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

// GetPipelineStats returns aggregate statistics for a pipeline.
func (h *Handler) GetPipelineStats(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	pipelineID := c.Param("id")

	stats, err := h.svc.GetPipelineStats(c.Request.Context(), tenantID, pipelineID)
	if err != nil {
		if err == service.ErrPipelineNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, stats)
}
