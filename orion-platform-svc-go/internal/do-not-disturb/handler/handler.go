package handler

import (
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/do-not-disturb/models"
	"orion/platform-svc-go/internal/do-not-disturb/service"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/do-not-disturb")

	f.POST("", auth.RequirePermission("do-not-disturb", "write"), h.Create)
	f.GET("", auth.RequirePermission("do-not-disturb", "read"), h.Get)
	f.PUT("", auth.RequirePermission("do-not-disturb", "write"), h.Update)
	f.GET("/active", h.IsActive)
}

func (h *Handler) Create(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	var req models.CreateDoNotDisturbRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	result, err := h.svc.Create(c.Request.Context(), tenantID, userID, &req)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(201, result)
}

func (h *Handler) Get(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	result, err := h.svc.Get(c.Request.Context(), tenantID, userID)
	if err != nil {
		c.JSON(404, gin.H{"error": "dnd schedule not found"})
		return
	}
	c.JSON(200, result)
}

func (h *Handler) Update(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	var req models.UpdateDoNotDisturbRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	result, err := h.svc.Update(c.Request.Context(), tenantID, userID, &req)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, result)
}

func (h *Handler) IsActive(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	active, err := h.svc.IsActive(c.Request.Context(), tenantID, userID)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"active": active})
}