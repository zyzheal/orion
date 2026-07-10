package handler

import (
	"net/http"

	"orion/notification-svc-go/internal/chatops/models"
	"orion/notification-svc-go/internal/chatops/service"

	"github.com/gin-gonic/gin"
)

type RateLimitHandler struct {
	svc *service.RateLimitService
}

func NewRateLimitHandler(svc *service.RateLimitService) *RateLimitHandler {
	return &RateLimitHandler{svc: svc}
}

func (h *RateLimitHandler) Create(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateRateLimitRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	rl, err := h.svc.Create(c.Request.Context(), tenantID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, rl)
}

func (h *RateLimitHandler) Get(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	rl, err := h.svc.Get(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "rate limit not found"})
		return
	}
	c.JSON(http.StatusOK, rl)
}

func (h *RateLimitHandler) List(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.List(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *RateLimitHandler) Update(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.UpdateRateLimitRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	rl, err := h.svc.Update(c.Request.Context(), tenantID, c.Param("id"), req)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, rl)
}

func (h *RateLimitHandler) Delete(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.Delete(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

func (h *RateLimitHandler) RegisterRoutes(rg *gin.RouterGroup) {
	rl := rg.Group("/rate-limits")
	{
		rl.POST("", h.Create)
		rl.GET("", h.List)
		rl.GET("/:id", h.Get)
		rl.PUT("/:id", h.Update)
		rl.DELETE("/:id", h.Delete)
	}
}
