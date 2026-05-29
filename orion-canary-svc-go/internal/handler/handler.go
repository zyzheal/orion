package handler

import (
	"net/http"
	"strconv"

	"orion/canary-svc-go/internal/models"
	"orion/canary-svc-go/internal/service"

	"github.com/gin-gonic/gin"
)

// Handler provides HTTP handlers for canary operations.
type Handler struct {
	svc *service.CanaryService
}

func NewHandler(svc *service.CanaryService) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers canary routes on the given router group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	canaries := rg.Group("/canaries")
	{
		canaries.POST("", h.CreateCanary)
		canaries.GET("", h.ListCanaries)
		canaries.GET("/:id", h.GetCanary)
		canaries.POST("/:id/promote", h.Promote)
		canaries.POST("/:id/rollback", h.Rollback)
		canaries.POST("/:id/metrics", h.AddMetric)
		canaries.GET("/:id/metrics", h.GetMetrics)
	}
	canaries.DELETE("/:id", h.Delete)
	canaries.GET("/count", h.Count)
}

func (h *Handler) CreateCanary(c *gin.Context) {
	var canary models.Canary
	if err := c.ShouldBindJSON(&canary); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	canary.TenantID = c.GetString("tenant_id")
	if err := h.svc.Create(c.Request.Context(), &canary); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, canary)
}

func (h *Handler) GetCanary(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	canary, err := h.svc.GetByID(c.Request.Context(), tenantID, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "canary not found"})
		return
	}

	c.JSON(http.StatusOK, canary)
}

func (h *Handler) ListCanaries(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	canaries, err := h.svc.List(c.Request.Context(), tenantID, offset, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": canaries})
}

func (h *Handler) Promote(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	if err := h.svc.Promote(c.Request.Context(), tenantID, id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "promoted"})
}

func (h *Handler) Rollback(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	if err := h.svc.Rollback(c.Request.Context(), tenantID, id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "rolled back"})
}

func (h *Handler) AddMetric(c *gin.Context) {
	var metric models.CanaryMetric
	if err := c.ShouldBindJSON(&metric); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	metric.CanaryID = c.Param("id")
	if err := h.svc.AddMetric(c.Request.Context(), &metric); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, metric)
}

func (h *Handler) GetMetrics(c *gin.Context) {
	id := c.Param("id")

	metrics, err := h.svc.GetMetrics(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": metrics})
}

func (h *Handler) Delete(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.Delete(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

func (h *Handler) Count(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	count, err := h.svc.Count(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"count": count})
}
