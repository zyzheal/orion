package handler

import (
	"strconv"

	"go.opentelemetry.io/otel"
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/pipeline-executor/models"
	"orion/platform-svc-go/internal/pipeline-executor/service"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	exec *service.PipelineExecutor
}

func NewHandler(exec *service.PipelineExecutor) *Handler {
	return &Handler{exec: exec}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	pipelines := rg.Group("")
	pipelines.POST("/pipelines", auth.RequirePermission("pipeline-executor", "write"), h.CreatePipeline)
	pipelines.GET("/pipelines", auth.RequirePermission("pipeline-executor", "read"), h.ListPipelines)
	pipelines.GET("/pipelines/:id", auth.RequirePermission("pipeline-executor", "read"), h.GetPipeline)
	pipelines.PUT("/pipelines/:id", auth.RequirePermission("pipeline-executor", "write"), h.UpdatePipeline)
	pipelines.DELETE("/pipelines/:id", auth.RequirePermission("pipeline-executor", "delete"), h.DeletePipeline)

	pipelines.POST("/pipelines/:id/steps", auth.RequirePermission("pipeline-executor", "write"), h.AddStep)
	pipelines.GET("/pipelines/:id/steps", auth.RequirePermission("pipeline-executor", "read"), h.ListSteps)
	pipelines.PUT("/pipelines/:id/steps/:stepId", auth.RequirePermission("pipeline-executor", "write"), h.UpdateStep)
	pipelines.DELETE("/pipelines/:id/steps/:stepId", auth.RequirePermission("pipeline-executor", "delete"), h.DeleteStep)

	pipelines.POST("/pipelines/:id/run", auth.RequirePermission("pipeline-executor", "execute"), h.RunPipeline)
	pipelines.GET("/pipelines/:id/history", auth.RequirePermission("pipeline-executor", "read"), h.ListExecutions)
}

func (h *Handler) tenantID(c *gin.Context) string {
	return c.GetString("tenant_id")
}

func (h *Handler) CreatePipeline(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreatePipeline")
	defer span.End()
	var req models.CreatePipelineRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	p, err := h.exec.CreatePipeline(ctx, h.tenantID(c), req.Name, req.Category)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, p)
}

func (h *Handler) ListPipelines(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListPipelines")
	defer span.End()
	status := c.Query("status")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	resp, err := h.exec.ListPipelines(ctx, h.tenantID(c), status, limit, offset)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, resp)
}

func (h *Handler) GetPipeline(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetPipeline")
	defer span.End()
	p, err := h.exec.GetPipeline(ctx, h.tenantID(c), c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, p)
}

func (h *Handler) UpdatePipeline(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdatePipeline")
	defer span.End()
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
	p, err := h.exec.UpdatePipeline(ctx, h.tenantID(c), c.Param("id"), fields)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, p)
}

func (h *Handler) DeletePipeline(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeletePipeline")
	defer span.End()
	if err := h.exec.DeletePipeline(ctx, h.tenantID(c), c.Param("id")); err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "deleted"})
}

func (h *Handler) AddStep(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AddPipelineStep")
	defer span.End()
	var req models.AddStepRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	if req.Config == nil {
		req.Config = make(map[string]string)
	}
	step, err := h.exec.AddStep(ctx, h.tenantID(c), c.Param("id"), req.Name, req.Type, req.Config, req.Priority)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, step)
}

func (h *Handler) ListSteps(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListPipelineSteps")
	defer span.End()
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	resp, err := h.exec.ListSteps(ctx, h.tenantID(c), c.Param("id"), limit, offset)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, resp)
}

func (h *Handler) UpdateStep(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdatePipelineStep")
	defer span.End()
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
	step, err := h.exec.UpdateStep(ctx, h.tenantID(c), stepID, fields)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, step)
}

func (h *Handler) DeleteStep(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeletePipelineStep")
	defer span.End()
	if err := h.exec.DeleteStep(ctx, h.tenantID(c), c.Param("stepId")); err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "deleted"})
}

func (h *Handler) RunPipeline(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RunPipeline")
	defer span.End()
	var req models.RunPipelineRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	exec, err := h.exec.Execute(ctx, h.tenantID(c), c.Param("id"), req.Input)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, exec)
}

func (h *Handler) ListExecutions(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListPipelineExecutions")
	defer span.End()
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	off, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	resp, err := h.exec.ListExecutions(ctx, h.tenantID(c), c.Param("id"), limit, off)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, resp)
}
