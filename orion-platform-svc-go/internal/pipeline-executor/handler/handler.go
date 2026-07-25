// Package handler exposes the Pipeline Executor over HTTP (Gin).
//
// Routes (all under /api/pipelines):
//   POST   /              Create a new pipeline
//   GET    /              List pipelines (optional ?status=...)
//   GET    /:id           Get pipeline
//   PUT    /:id           Update pipeline
//   DELETE /:id           Delete pipeline
//   POST   /:id/steps     Add a step to a pipeline
//   GET    /:id/steps     List steps
//   PUT    /:id/steps/:stepId Update a step
//   DELETE /:id/steps/:stepId Delete a step
//   POST   /:id/run       Execute pipeline (chain-of-responsibility)
//   GET    /:id/history   Execution history
package handler

import (
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/pipeline-executor/models"
	"orion/platform-svc-go/internal/pipeline-executor/service"

	"github.com/gin-gonic/gin"
	"strconv"
)

// Handler provides HTTP endpoints for pipeline management and execution.
type Handler struct {
	exec *service.PipelineExecutor
}

// NewHandler creates a Handler wired to the given PipelineExecutor.
func NewHandler(exec *service.PipelineExecutor) *Handler {
	return &Handler{exec: exec}
}

// RegisterRoutes mounts the pipeline endpoints on the given RouterGroup.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	// Pipelines
	pipelines := rg.Group("")
	pipelines.POST("/pipelines", auth.RequirePermission("pipeline-executor", "write"), h.CreatePipeline)
	pipelines.GET("/pipelines", auth.RequirePermission("pipeline-executor", "read"), h.ListPipelines)
	pipelines.GET("/pipelines/:id", auth.RequirePermission("pipeline-executor", "read"), h.GetPipeline)
	pipelines.PUT("/pipelines/:id", auth.RequirePermission("pipeline-executor", "write"), h.UpdatePipeline)
	pipelines.DELETE("/pipelines/:id", auth.RequirePermission("pipeline-executor", "delete"), h.DeletePipeline)

	// Steps
	pipelines.POST("/pipelines/:id/steps", auth.RequirePermission("pipeline-executor", "write"), h.AddStep)
	pipelines.GET("/pipelines/:id/steps", auth.RequirePermission("pipeline-executor", "read"), h.ListSteps)
	pipelines.PUT("/pipelines/:id/steps/:stepId", auth.RequirePermission("pipeline-executor", "write"), h.UpdateStep)
	pipelines.DELETE("/pipelines/:id/steps/:stepId", auth.RequirePermission("pipeline-executor", "delete"), h.DeleteStep)

	// Execution
	pipelines.POST("/pipelines/:id/run", auth.RequirePermission("pipeline-executor", "execute"), h.RunPipeline)
	pipelines.GET("/pipelines/:id/history", auth.RequirePermission("pipeline-executor", "read"), h.ListExecutions)
}

func (h *Handler) tenantID(c *gin.Context) string {
	return c.GetString("tenant_id")
}

// ---------------------------------------------------------------------------
// Pipelines
// ---------------------------------------------------------------------------

func (h *Handler) CreatePipeline(c *gin.Context) {
	var req models.CreatePipelineRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	p, err := h.exec.CreatePipeline(c.Request.Context(), h.tenantID(c), req.Name, req.Category)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, p)
}

func (h *Handler) ListPipelines(c *gin.Context) {
	status := c.Query("status")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	resp, err := h.exec.ListPipelines(c.Request.Context(), h.tenantID(c), status, limit, offset)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, resp)
}

func (h *Handler) GetPipeline(c *gin.Context) {
	p, err := h.exec.GetPipeline(c.Request.Context(), h.tenantID(c), c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, p)
}

func (h *Handler) UpdatePipeline(c *gin.Context) {
	var req models.UpdatePipelineRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	fields := make(map[string]interface{})
	if req.Name != nil {
		fields["name"] = *req.Name
	}
	if req.Description != nil {
		fields["description"] = *req.Description
	}
	if req.Category != nil {
		fields["category"] = *req.Category
	}
	if req.Status != nil {
		fields["status"] = *req.Status
	}
	if len(fields) == 0 {
		respondBadRequest(c, "no fields to update")
		return
	}
	p, err := h.exec.UpdatePipeline(c.Request.Context(), h.tenantID(c), c.Param("id"), fields)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, p)
}

func (h *Handler) DeletePipeline(c *gin.Context) {
	if err := h.exec.DeletePipeline(c.Request.Context(), h.tenantID(c), c.Param("id")); err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "deleted"})
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

func (h *Handler) AddStep(c *gin.Context) {
	var req models.AddStepRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	if req.Config == nil {
		req.Config = make(map[string]string)
	}
	step, err := h.exec.AddStep(c.Request.Context(), h.tenantID(c), c.Param("id"),
		req.Name, req.Type, req.Config, req.Priority)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, step)
}

func (h *Handler) ListSteps(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	resp, err := h.exec.ListSteps(c.Request.Context(), h.tenantID(c), c.Param("id"), limit, offset)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, resp)
}

func (h *Handler) UpdateStep(c *gin.Context) {
	var req models.UpdateStepRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	stepID := c.Param("stepId")
	fields := make(map[string]interface{})
	if req.Name != nil {
		fields["name"] = *req.Name
	}
	if req.Type != nil {
		fields["type"] = *req.Type
	}
	if req.Config != nil {
		fields["config"] = *req.Config
	}
	if req.Priority != nil {
		fields["priority"] = *req.Priority
	}
	if req.Enabled != nil {
		fields["enabled"] = *req.Enabled
	}
	if req.Status != nil {
		fields["status"] = *req.Status
	}
	if req.Error != nil {
		fields["error"] = *req.Error
	}
	if len(fields) == 0 {
		respondBadRequest(c, "no fields to update")
		return
	}
	step, err := h.exec.UpdateStep(c.Request.Context(), h.tenantID(c), stepID, fields)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, step)
}

func (h *Handler) DeleteStep(c *gin.Context) {
	if err := h.exec.DeleteStep(c.Request.Context(), h.tenantID(c), c.Param("stepId")); err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "deleted"})
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

func (h *Handler) RunPipeline(c *gin.Context) {
	var req models.RunPipelineRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	exec, err := h.exec.Execute(c.Request.Context(), h.tenantID(c), c.Param("id"), req.Input)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, exec)
}

func (h *Handler) ListExecutions(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	off, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	resp, err := h.exec.ListExecutions(c.Request.Context(), h.tenantID(c), c.Param("id"), limit, off)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, resp)
}
