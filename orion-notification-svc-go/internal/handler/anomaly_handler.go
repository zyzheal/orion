package handler

import (
	"net/http"

	"orion/notification-svc-go/internal/models"
	"orion/notification-svc-go/internal/service"

	"orion/go-common/pkg/auth"

	"github.com/gin-gonic/gin"
)

// AnomalyHandler exposes HTTP endpoints for anomaly detection records.
type AnomalyHandler struct {
	anomalySvc *service.AnomalyService
}

// NewAnomalyHandler creates a new AnomalyHandler.
func NewAnomalyHandler(anomalySvc *service.AnomalyService) *AnomalyHandler {
	return &AnomalyHandler{anomalySvc: anomalySvc}
}

// RegisterRoutes mounts all anomaly endpoints onto the given router group.
func (h *AnomalyHandler) RegisterRoutes(rg *gin.RouterGroup) {
	anomalies := rg.Group("/anomalies")
	anomalies.Use(auth.RequirePermission("notification", "write"))
	{
		anomalies.POST("", h.Create)
		anomalies.GET("", h.List)
		anomalies.GET("/by-type", h.CountByType)
		anomalies.GET("/:id", h.Get)
		anomalies.PUT("/:id/status", h.UpdateStatus)
	}
}

// Create handles POST /anomalies - create a new anomaly record.
func (h *AnomalyHandler) Create(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var a models.Anomaly
	if err := c.ShouldBindJSON(&a); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.anomalySvc.CreateAnomaly(c.Request.Context(), tenantID, &a); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": a})
}

// List handles GET /anomalies - list anomalies with optional filters.
func (h *AnomalyHandler) List(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var opts models.ListAnomaliesQuery
	if err := c.ShouldBindQuery(&opts); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	items, total, err := h.anomalySvc.ListAnomalies(c.Request.Context(), tenantID, opts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items, "total": total, "page": opts.Page})
}

// CountByType handles GET /anomalies/by-type - anomaly counts grouped by type.
func (h *AnomalyHandler) CountByType(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	counts, err := h.anomalySvc.CountByType(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": counts})
}

// Get handles GET /anomalies/:id - get a single anomaly.
func (h *AnomalyHandler) Get(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	a, err := h.anomalySvc.GetAnomaly(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		if err == service.ErrAnomalyNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "anomaly not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": a})
}

// UpdateStatus handles PUT /anomalies/:id/status - update anomaly status.
func (h *AnomalyHandler) UpdateStatus(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.anomalySvc.UpdateStatus(c.Request.Context(), tenantID, c.Param("id"), req.Status); err != nil {
		if err == service.ErrAnomalyNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "anomaly not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "status updated"})
}
