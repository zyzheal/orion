package handler

import (
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
	tenantID := c.GetString("tenant_id")
	pipelineID := c.Param("pipelineId")

	var req models.CreateTriggerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	trigger, err := h.svc.Create(c.Request.Context(), tenantID, pipelineID, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondCreated(c, trigger)
}

func (h *TriggerHandler) List(c *gin.Context) {
	pipelineID := c.Param("pipelineId")

	triggers, err := h.svc.List(c.Request.Context(), pipelineID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, triggers)
}

func (h *TriggerHandler) GetByID(c *gin.Context) {
	trigger, err := h.svc.GetByID(c.Request.Context(), c.Param("id"))
	if err != nil {
		respondNotFound(c, "trigger not found")
		return
	}

	respondSuccess(c, trigger)
}

func (h *TriggerHandler) Delete(c *gin.Context) {
	if err := h.svc.Delete(c.Request.Context(), c.Param("id")); err != nil {
		respondNotFound(c, err.Error())
		return
	}

	respondSuccess(c, gin.H{"message": "deleted"})
}

func (h *TriggerHandler) Toggle(c *gin.Context) {
	var req struct {
		Enabled bool `json:"enabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	if err := h.svc.Toggle(c.Request.Context(), c.Param("id"), req.Enabled); err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, gin.H{"message": "toggled"})
}

func (h *TriggerHandler) ProcessWebhook(c *gin.Context) {
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

	run, err := h.svc.ProcessWebhook(c.Request.Context(), triggerID, body, headers)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	respondSuccess(c, run)
}

func (h *TriggerHandler) ProcessSCMEvent(c *gin.Context) {
	var event models.SCMTriggerEvent
	if err := c.ShouldBindJSON(&event); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	runs, err := h.svc.ProcessSCMEvent(c.Request.Context(), event)
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
