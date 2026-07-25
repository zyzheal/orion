package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"orion/ai-svc-go/internal/degradation/models"
	"orion/ai-svc-go/internal/degradation/service"
	"orion/go-common/pkg/auth"
)

type DegradationHandler struct {
	svc *service.DegradationService
}

func NewDegradationHandler(svc *service.DegradationService) *DegradationHandler {
	return &DegradationHandler{svc: svc}
}

func (h *DegradationHandler) GetTenantID(c *gin.Context) string {
	return c.GetString("tenantId")
}

// RegisterRoutes registers degradation routes.
func (h *DegradationHandler) RegisterRoutes(rg *gin.RouterGroup) {
	deg := rg.Group("/degradation")
	deg.GET("", auth.RequirePermission("ai", "read"), h.ListConfigs)
	deg.GET("/level/:service", auth.RequirePermission("ai", "read"), h.GetLevel)
	deg.GET("/config/:service", auth.RequirePermission("ai", "read"), h.GetConfig)
	deg.PATCH("/level/:service", auth.RequirePermission("ai", "write"), h.SetLevel)
	deg.POST("/resolve/:service", auth.RequirePermission("ai", "execute"), h.Resolve)
}

// ListConfigs returns all degradation configs.
func (h *DegradationHandler) ListConfigs(c *gin.Context) {
	resp := h.svc.QueryConfigs()
	c.JSON(http.StatusOK, gin.H{"code": 0, "total": resp.Total, "data": resp.Data})
}

// GetLevel returns the degradation level for a service.
func (h *DegradationHandler) GetLevel(c *gin.Context) {
	serviceName := c.Param("service")
	level := h.svc.GetLevel(serviceName)
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": gin.H{
		"service": serviceName,
		"level":   level,
	}})
}

// GetConfig returns the degradation config for a service.
func (h *DegradationHandler) GetConfig(c *gin.Context) {
	serviceName := c.Param("service")

	cfg, err := h.svc.GetConfig(serviceName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": cfg})
}

// SetLevel sets the degradation level for a service.
func (h *DegradationHandler) SetLevel(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	serviceName := c.Param("service")

	var req models.SetLevelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": err.Error()})
		return
	}

	cfg, err := h.svc.SetLevel(c.Request.Context(), tenantID, serviceName, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": cfg})
}

// Resolve resolves degradation for a service.
func (h *DegradationHandler) Resolve(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	serviceName := c.Param("service")

	cfg, err := h.svc.Resolve(c.Request.Context(), tenantID, serviceName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": cfg})
}
