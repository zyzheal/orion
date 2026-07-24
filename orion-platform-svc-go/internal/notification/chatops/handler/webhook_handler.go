package handler

import (
	"strconv"

	"orion/platform-svc-go/internal/chatops/models"
	"orion/platform-svc-go/internal/chatops/service"

	"github.com/gin-gonic/gin"
)

type WebhookHandler struct {
	svc *service.WebhookService
}

func NewWebhookHandler(svc *service.WebhookService) *WebhookHandler {
	return &WebhookHandler{svc: svc}
}

func (h *WebhookHandler) Create(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateWebhookRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	wh, err := h.svc.Create(c.Request.Context(), tenantID, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, wh)
}

func (h *WebhookHandler) Get(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	wh, err := h.svc.Get(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		respondNotFound(c, "webhook not found")
		return
	}
	respondSuccess(c, wh)
}

func (h *WebhookHandler) List(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.List(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

func (h *WebhookHandler) Update(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.UpdateWebhookRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	wh, err := h.svc.Update(c.Request.Context(), tenantID, c.Param("id"), req)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, wh)
}

func (h *WebhookHandler) Delete(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.Delete(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "deleted"})
}

func (h *WebhookHandler) GetLogs(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	logs, err := h.svc.GetLogs(c.Request.Context(), tenantID, c.Param("id"), limit)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, logs)
}

func (h *WebhookHandler) Test(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	result, err := h.svc.Test(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, result)
}

func (h *WebhookHandler) RegisterRoutes(rg *gin.RouterGroup) {
	wh := rg.Group("/webhooks")
	{
		wh.POST("", h.Create)
		wh.GET("", h.List)
		wh.GET("/:id", h.Get)
		wh.PUT("/:id", h.Update)
		wh.DELETE("/:id", h.Delete)
		wh.GET("/:id/logs", h.GetLogs)
		wh.POST("/:id/test", h.Test)
	}
}
