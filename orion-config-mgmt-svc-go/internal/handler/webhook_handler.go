package handler

import (
	"net/http"

	"orion/config-mgmt-svc-go/internal/models"
	"orion/config-mgmt-svc-go/internal/service"

	"github.com/gin-gonic/gin"
)

// WebhookHandler handles config webhook HTTP endpoints.
type WebhookHandler struct {
	svc *service.WebhookService
}

// NewWebhookHandler creates a new WebhookHandler.
func NewWebhookHandler(svc *service.WebhookService) *WebhookHandler {
	return &WebhookHandler{svc: svc}
}

// Create handles POST /webhooks.
func (h *WebhookHandler) Create(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateWebhookRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	w, err := h.svc.Create(c.Request.Context(), tenantID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, w)
}

// List handles GET /webhooks.
func (h *WebhookHandler) List(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	webhooks, err := h.svc.List(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": webhooks})
}

// GetByID handles GET /webhooks/:id.
func (h *WebhookHandler) GetByID(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	w, err := h.svc.GetByID(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, w)
}

// Update handles PUT /webhooks/:id.
func (h *WebhookHandler) Update(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.UpdateWebhookRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	w, err := h.svc.Update(c.Request.Context(), tenantID, c.Param("id"), &req)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, w)
}

// Delete handles DELETE /webhooks/:id.
func (h *WebhookHandler) Delete(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.Delete(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

// RegisterRoutes registers all webhook endpoints.
func (h *WebhookHandler) RegisterRoutes(rg *gin.RouterGroup) {
	w := rg.Group("/webhooks")
	{
		w.POST("", h.Create)
		w.GET("", h.List)
		w.GET("/:id", h.GetByID)
		w.PUT("/:id", h.Update)
		w.DELETE("/:id", h.Delete)
	}
}
