package handler

import (
	"go.opentelemetry.io/otel"
	"io"

	"orion/platform-svc-go/internal/ci-cd/pipeline/models"
	"orion/platform-svc-go/internal/ci-cd/pipeline/service"

	"github.com/gin-gonic/gin"
)

type TriggerHandler struct {
	svc *service.TriggerService
}

func NewTriggerHandler(svc *service.TriggerService) *TriggerHandler {
	return &TriggerHandler{svc: svc}
}

func (h *TriggerHandler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PipelineCreate")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	pipelineID := c.Param("pipelineId")

	var req models.CreateTriggerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	trigger, err := h.svc.Create(ctx, tenantID, pipelineID, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondCreated(c, trigger)
}

func (h *TriggerHandler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PipelineList")
	defer span.End()
	pipelineID := c.Param("pipelineId")

	triggers, err := h.svc.List(ctx, pipelineID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, triggers)
}

func (h *TriggerHandler) GetByID(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PipelineGetByID")
	defer span.End()
	trigger, err := h.svc.GetByID(ctx, c.Param("id"))
	if err != nil {
		respondNotFound(c, "trigger not found")
		return
	}

	respondSuccess(c, trigger)
}

func (h *TriggerHandler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PipelineDelete")
	defer span.End()
	if err := h.svc.Delete(ctx, c.Param("id")); err != nil {
		respondNotFound(c, err.Error())
		return
	}

	respondSuccess(c, gin.H{"message": "deleted"})
}

func (h *TriggerHandler) Toggle(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PipelineToggle")
	defer span.End()
	var req struct {
		Enabled bool `json:"enabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	if err := h.svc.Toggle(ctx, c.Param("id"), req.Enabled); err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, gin.H{"message": "toggled"})
}

func (h *TriggerHandler) ProcessWebhook(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PipelineProcessWebhook")
	defer span.End()
	triggerID := c.Param("id")

	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		respondBadRequest(c, "failed to read body")
		return
	}

	headers := make(map[string]string)
	for key := range c.Request.Header {
		headers[key] = c.GetHeader(key)
	}

	run, err := h.svc.ProcessWebhook(ctx, triggerID, body, headers)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	respondSuccess(c, run)
}

func (h *TriggerHandler) ProcessSCMEvent(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PipelineProcessSCMEvent")
	defer span.End()
	var event models.SCMTriggerEvent
	if err := c.ShouldBindJSON(&event); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	runs, err := h.svc.ProcessSCMEvent(ctx, event)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, gin.H{"runs": runs, "triggered": len(runs)})
}

func (h *TriggerHandler) RegisterRoutes(rg *gin.RouterGroup) {
	triggers := rg.Group("/triggers")
	{
		triggers.POST("/scm", h.ProcessSCMEvent)
	}

	pipelineTriggers := rg.Group("/pipelines/:pipelineId/triggers")
	{
		pipelineTriggers.POST("", h.Create)
		pipelineTriggers.GET("", h.List)
		pipelineTriggers.GET("/:id", h.GetByID)
		pipelineTriggers.DELETE("/:id", h.Delete)
		pipelineTriggers.PUT("/:id/toggle", h.Toggle)
		pipelineTriggers.POST("/:id/webhook", h.ProcessWebhook)
	}
}
