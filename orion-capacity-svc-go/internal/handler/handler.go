package handler

import (
	"net/http"
	"strconv"
	"orion/capacity-svc-go/internal/models"
	"orion/capacity-svc-go/internal/service"
	"orion/go-common/pkg/auth"

	"github.com/gin-gonic/gin"
)

type Handler struct { svc *service.Service }
func NewHandler(svc *service.Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	c := rg.Group("/capacity")

	// Pool CRUD
	c.POST("/pools", auth.RequirePermission("capacity", "write"), h.CreatePool)
	c.GET("/pools", h.ListPools)
	c.GET("/pools/:id", h.GetPool)
	c.PUT("/pools/:id", auth.RequirePermission("capacity", "write"), h.UpdatePool)
	c.DELETE("/pools/:id", auth.RequirePermission("capacity", "delete"), h.Delete)
	c.GET("/pools-count", h.Count)

	// Metrics
	c.POST("/metrics", auth.RequirePermission("capacity", "write"), h.RecordMetric)
	c.GET("/metrics", h.ListMetrics)

	// Forecasts
	c.POST("/forecasts/generate", auth.RequirePermission("capacity", "write"), h.GenerateForecast)
	c.GET("/forecasts", h.ListForecasts)

	// Alerts
	c.GET("/alerts", h.ListAlerts)
	c.DELETE("/alerts/:id", auth.RequirePermission("capacity", "delete"), h.DeleteAlert)

	// Reports
	c.POST("/reports/generate", auth.RequirePermission("capacity", "write"), h.GenerateReport)
	c.GET("/reports", h.ListReports)
	c.GET("/reports/:id", h.GetReport)

	// Bottleneck analysis
	c.GET("/bottlenecks", h.AnalyzeBottlenecks)

	// Policies
	c.POST("/policies", auth.RequirePermission("capacity", "write"), h.CreatePolicy)
	c.GET("/policies", h.ListPolicies)
}

func (h *Handler) CreatePool(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreatePoolRequest
	if err := c.ShouldBindJSON(&req); err != nil { c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()}); return }
	item, err := h.svc.CreatePool(c.Request.Context(), tenantID, &req)
	if err != nil { c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()}); return }
	c.JSON(http.StatusCreated, item)
}

func (h *Handler) ListPools(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1")); ps, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	items, err := h.svc.ListPools(c.Request.Context(), tenantID, (page-1)*ps, ps)
	if err != nil { c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()}); return }
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *Handler) GetPool(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	item, err := h.svc.GetPool(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil { c.JSON(http.StatusNotFound, gin.H{"error": err.Error()}); return }
	c.JSON(http.StatusOK, item)
}

func (h *Handler) UpdatePool(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreatePoolRequest
	if err := c.ShouldBindJSON(&req); err != nil { c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()}); return }
	item, err := h.svc.UpdatePool(c.Request.Context(), tenantID, c.Param("id"), &req)
	if err != nil { c.JSON(http.StatusNotFound, gin.H{"error": err.Error()}); return }
	c.JSON(http.StatusOK, item)
}

func (h *Handler) ListForecasts(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1")); ps, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	items, err := h.svc.ListForecasts(c.Request.Context(), tenantID, (page-1)*ps, ps)
	if err != nil { c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()}); return }
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *Handler) CreatePolicy(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreatePolicyRequest
	if err := c.ShouldBindJSON(&req); err != nil { c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()}); return }
	item, err := h.svc.CreatePolicy(c.Request.Context(), tenantID, &req)
	if err != nil { c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()}); return }
	c.JSON(http.StatusCreated, item)
}

func (h *Handler) ListPolicies(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.ListPolicies(c.Request.Context(), tenantID)
	if err != nil { c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()}); return }
	c.JSON(http.StatusOK, gin.H{"data": items})
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

func (h *Handler) RecordMetric(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.RecordMetricRequest
	if err := c.ShouldBindJSON(&req); err != nil { c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()}); return }
	item, err := h.svc.RecordMetric(c.Request.Context(), tenantID, &req)
	if err != nil { c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()}); return }
	c.JSON(http.StatusCreated, item)
}

func (h *Handler) ListMetrics(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var f models.MetricFilter
	c.ShouldBindQuery(&f)
	items, err := h.svc.ListMetrics(c.Request.Context(), tenantID, &f)
	if err != nil { c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()}); return }
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *Handler) GenerateForecast(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.GenerateForecast(c.Request.Context(), tenantID)
	if err != nil { c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()}); return }
	c.JSON(http.StatusCreated, gin.H{"data": items})
}

func (h *Handler) ListAlerts(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.ListAlerts(c.Request.Context(), tenantID, nil)
	if err != nil { c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()}); return }
	c.JSON(http.StatusOK, gin.H{"data": items})
}

// DeleteAlert deletes a capacity alert.
func (h *Handler) DeleteAlert(c *gin.Context) {
	if err := h.svc.DeleteAlert(c.Request.Context(), c.Param("id")); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

// GenerateReport generates a capacity report.
func (h *Handler) GenerateReport(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	title := c.Query("title")
	report, err := h.svc.GenerateReport(c.Request.Context(), tenantID, title)
	if err != nil { c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()}); return }
	c.JSON(http.StatusCreated, report)
}

// ListReports lists capacity reports.
func (h *Handler) ListReports(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1")); ps, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	items, err := h.svc.ListReports(c.Request.Context(), tenantID, (page-1)*ps, ps)
	if err != nil { c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()}); return }
	c.JSON(http.StatusOK, gin.H{"data": items})
}

// GetReport gets a capacity report by ID.
func (h *Handler) GetReport(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	item, err := h.svc.GetReport(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil { c.JSON(http.StatusNotFound, gin.H{"error": err.Error()}); return }
	c.JSON(http.StatusOK, item)
}

// AnalyzeBottlenecks analyzes capacity bottlenecks.
func (h *Handler) AnalyzeBottlenecks(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	result, err := h.svc.AnalyzeBottlenecks(c.Request.Context(), tenantID)
	if err != nil { c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()}); return }
	c.JSON(http.StatusOK, result)
}
