package handler

import (
	"context"
	"net/http"
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/pipeline-engine/models"
	"orion/platform-svc-go/internal/pipeline-engine/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
)

// Handler exposes HTTP endpoints for the Pipeline Engine.
type Handler struct {
	engine *service.PipelineEngine
}

// NewHandler creates a new Handler.
func NewHandler(engine *service.PipelineEngine) *Handler {
	return &Handler{engine: engine}
}

// RegisterRoutes mounts all pipeline-engine routes.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	r := rg.Group("/pipeline-engine")

	// Trigger a pipeline run
	r.POST("/runs",
		auth.RequirePermission("pipeline_engine", "write"),
		h.TriggerRun)

	// Get run status
	r.GET("/runs/:runId",
		auth.RequirePermission("pipeline_engine", "read"),
		h.GetRun)

	// List runs for a pipeline
	r.GET("/pipelines/:pipelineId/runs",
		auth.RequirePermission("pipeline_engine", "read"),
		h.ListRuns)

	// Get stages for a run
	r.GET("/runs/:runId/stages",
		auth.RequirePermission("pipeline_engine", "read"),
		h.GetStages)

	// Get tasks for a stage
	r.GET("/stages/:stageId/tasks",
		auth.RequirePermission("pipeline_engine", "read"),
		h.GetTasks)

	// Cancel a run
	r.POST("/runs/:runId/cancel",
		auth.RequirePermission("pipeline_engine", "delete"),
		h.CancelRun)
}

// unused import fix
var _ = http.StatusOK
var _ = strconv.Itoa

// TriggerRun triggers a pipeline execution.
func (h *Handler) TriggerRun(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.TriggerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	ctx := context.Background()
	run, err := h.engine.Execute(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}

	middleware.RespondCreated(c, run)
}

// GetRun retrieves pipeline run status.
func (h *Handler) GetRun(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := context.Background()
	run, err := h.engine.GetRun(ctx, tenantID, c.Param("runId"))
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, run)
}

// ListRuns lists pipeline runs.
func (h *Handler) ListRuns(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := context.Background()
	req := models.ListRunsQuery{}
	if err := c.ShouldBindQuery(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if req.Limit <= 0 || req.Limit > 100 {
		req.Limit = 20
	}

	resp, err := h.engine.ListRuns(ctx, tenantID, c.Param("pipelineId"), req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, resp)
}

// GetStages retrieves stages for a run.
func (h *Handler) GetStages(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := context.Background()
	stages, err := h.engine.GetStages(ctx, tenantID, c.Param("runId"))
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": stages, "count": len(stages)})
}

// GetTasks retrieves tasks for a stage.
func (h *Handler) GetTasks(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := context.Background()
	tasks, err := h.engine.GetTasks(ctx, tenantID, c.Param("stageId"))
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": tasks, "count": len(tasks)})
}

// CancelRun cancels a running pipeline.
func (h *Handler) CancelRun(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := context.Background()
	var req models.CancelRunRequest
	_ = c.ShouldBindJSON(&req) // optional

	if req.TriggerBy == "" {
		req.TriggerBy = c.GetString("user_id")
	}
	run, err := h.engine.CancelRun(ctx, tenantID, c.Param("runId"), req.TriggerBy)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, run)
}
