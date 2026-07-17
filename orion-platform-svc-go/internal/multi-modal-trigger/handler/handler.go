package handler

import (
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/middleware"
	"orion/go-common/pkg/errors"
	"orion/platform-svc-go/internal/multi-modal-trigger/models"
	"orion/platform-svc-go/internal/multi-modal-trigger/service"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	r := rg.Group("/multi-modal-trigger")
	r.GET("", auth.RequirePermission("multi_modal_trigger", "read"), h.List)
	r.GET("/:id", auth.RequirePermission("multi_modal_trigger", "read"), h.Get)
	r.POST("", auth.RequirePermission("multi_modal_trigger", "write"), h.Create)
	r.PUT("/:id", auth.RequirePermission("multi_modal_trigger", "write"), h.Update)
	r.DELETE("/:id", auth.RequirePermission("multi_modal_trigger", "delete"), h.Delete)

	// Business endpoints
	r.POST("/:id/execute", auth.RequirePermission("multi_modal_trigger", "write"), h.ExecuteTrigger)
	r.POST("/:id/evaluate", auth.RequirePermission("multi_modal_trigger", "write"), h.EvaluateTrigger)
	r.POST("/webhook/process", auth.RequirePermission("multi_modal_trigger", "write"), h.ProcessWebhook)
}

func (h *Handler) List(c *gin.Context) {
	tenantID := h.getTenantID(c)
	items, err := h.svc.List(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": items, "total": len(items)})
}

func (h *Handler) Get(c *gin.Context) {
	tenantID := h.getTenantID(c)
	id := c.Param("id")
	item, err := h.svc.Get(c.Request.Context(), tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, "not found")
		return
	}
	middleware.RespondSuccess(c, item)
}

func (h *Handler) Create(c *gin.Context) {
	tenantID := h.getTenantID(c)
	var req models.CreateMultiModalTriggerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	item, err := h.svc.Create(c.Request.Context(), tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	errors.WriteCreated(c, item)
}

func (h *Handler) Update(c *gin.Context) {
	tenantID := h.getTenantID(c)
	id := c.Param("id")
	var req models.UpdateMultiModalTriggerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	item, err := h.svc.Update(c.Request.Context(), tenantID, id, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, item)
}

func (h *Handler) Delete(c *gin.Context) {
	tenantID := h.getTenantID(c)
	id := c.Param("id")
	if err := h.svc.Delete(c.Request.Context(), tenantID, id); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "deleted"})
}

func (h *Handler) ExecuteTrigger(c *gin.Context) {
	id := c.Param("id")
	var req models.TriggerExecuteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	result, err := h.svc.ExecuteTrigger(c.Request.Context(), tenantID, id, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) EvaluateTrigger(c *gin.Context) {
	id := c.Param("id")
	var req models.TriggerEvaluateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	result, err := h.svc.EvaluateTrigger(c.Request.Context(), tenantID, id, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) ProcessWebhook(c *gin.Context) {
	var req models.WebhookProcessRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	result, err := h.svc.ProcessWebhook(c.Request.Context(), tenantID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) getTenantID(c *gin.Context) string {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		return "00000000-0000-0000-0000-000000000000"
	}
	return tenantID
}
