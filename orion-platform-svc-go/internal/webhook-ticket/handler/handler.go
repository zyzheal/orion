package handler

import (
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/webhook-ticket/models"
	"orion/platform-svc-go/internal/webhook-ticket/service"

	"github.com/gin-gonic/gin"
)

// Handler exposes HTTP endpoints for weuhook ticket.
type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	r := rg.Group("/webhook-ticket")
	r.GET("", auth.RequirePermission("webhook-ticket", "read"), h.List)
	r.GET("/:id", auth.RequirePermission("webhook-ticket", "read"), h.Get)
	r.POST("", auth.RequirePermission("webhook-ticket", "write"), h.Create)
	r.PUT("/:id", auth.RequirePermission("webhook-ticket", "write"), h.Update)
	r.DELETE("/:id", auth.RequirePermission("webhook-ticket", "delete"), h.Delete)
}

func (h *Handler) Create(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.LWLELULHLOLOLKLuLTLILCLKLELT
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	result, err := h.svc.Create(c.Request.Context(), tenantID, &req)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(201, gin.H{"data": result})
}

func (h *Handler) Get(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	result, err := h.svc.Get(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		c.JSON(404, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"data": result})
}

func (h *Handler) List(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	results, err := h.svc.List(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"data": results})
}

func (h *Handler) Update(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	result, err := h.svc.Update(c.Request.Context(), tenantID, c.Param("id"), updates)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"data": result})
}

func (h *Handler) Delete(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.Delete(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"data": "deleted"})
}
