package handler

import (
	"net/http"
	"strconv"
	"time"

	"orion/visor-svc-go/internal/models"
	"orion/visor-svc-go/internal/service"

	"orion/go-common/pkg/auth"

	"github.com/gin-gonic/gin"
)

// Handler exposes HTTP endpoints for the visor service.
type Handler struct {
	svc *service.Service
}

// NewHandler creates a new Handler backed by the given Service.
func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all visor API routes under the given router group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	// Dashboards
	dash := rg.Group("/dashboards")
	dash.POST("", auth.RequirePermission("visor", "write"), h.CreateDashboard)
	dash.GET("", h.ListDashboards)
	dash.GET("/count", h.CountDashboards)
	dash.GET("/:id", h.GetDashboard)
	dash.PUT("/:id", auth.RequirePermission("visor", "write"), h.UpdateDashboard)
	dash.DELETE("/:id", auth.RequirePermission("visor", "delete"), h.DeleteDashboard)

	// Monitor Hosts
	hosts := rg.Group("/hosts")
	hosts.POST("", auth.RequirePermission("visor", "write"), h.CreateHost)
	hosts.GET("", h.ListHosts)
	hosts.GET("/count", h.CountHosts)
	hosts.GET("/status", h.HostStatusSummary)
	hosts.GET("/:id", h.GetHost)
	hosts.PUT("/:id", auth.RequirePermission("visor", "write"), h.UpdateHost)
	hosts.DELETE("/:id", auth.RequirePermission("visor", "delete"), h.DeleteHost)
	hosts.POST("/:id/heartbeat", auth.RequirePermission("visor", "write"), h.HostHeartbeat)

	// Alert Rules
	rules := rg.Group("/alert-rules")
	rules.POST("", auth.RequirePermission("visor", "write"), h.CreateAlertRule)
	rules.GET("", h.ListAlertRules)
	rules.GET("/:id", h.GetAlertRule)
	rules.PUT("/:id", auth.RequirePermission("visor", "write"), h.UpdateAlertRule)
	rules.DELETE("/:id", auth.RequirePermission("visor", "delete"), h.DeleteAlertRule)
	rules.PATCH("/:id/toggle", auth.RequirePermission("visor", "write"), h.ToggleAlertRule)

	// Alert Instances
	alerts := rg.Group("/alerts")
	alerts.GET("", h.ListAlerts)
	alerts.GET("/stats", h.AlertStats)
	alerts.GET("/:id", h.GetAlert)
	alerts.POST("/:id/acknowledge", auth.RequirePermission("visor", "execute"), h.AcknowledgeAlert)
	alerts.POST("/:id/resolve", auth.RequirePermission("visor", "execute"), h.ResolveAlert)

	// Metrics
	metrics := rg.Group("/metrics")
	metrics.POST("", auth.RequirePermission("visor", "write"), h.RecordMetric)
	metrics.GET("/:name/series", h.QueryMetricSeries)
	metrics.GET("/:name/latest", h.GetLatestMetricValue)
	metrics.GET("/:name/summary", h.GetMetricSummary)
	metrics.GET("/:name/anomalies", h.DetectAnomalies)

	// Rule evaluation
	rg.POST("/evaluate-rules", auth.RequirePermission("visor", "write"), h.EvaluateRules)

	// Notification channels
	channels := rg.Group("/notification-channels")
	channels.POST("", auth.RequirePermission("visor", "write"), h.CreateChannel)
	channels.GET("", h.ListChannels)
	channels.PATCH("/:id/toggle", auth.RequirePermission("visor", "write"), h.ToggleChannel)
	channels.DELETE("/:id", auth.RequirePermission("visor", "delete"), h.DeleteChannel)

	// Notification history
	rg.GET("/notification-history", h.ListNotificationHistory)

	// Send notification
	rg.POST("/alerts/:id/notify", auth.RequirePermission("visor", "write"), h.SendNotification)
}

// ==================== Dashboard Handlers ====================

func (h *Handler) CreateDashboard(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateDashboardRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	d, err := h.svc.CreateDashboard(c.Request.Context(), tenantID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, d)
}

func (h *Handler) ListDashboards(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	ps, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	items, err := h.svc.ListDashboards(c.Request.Context(), tenantID, (page-1)*ps, ps)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *Handler) GetDashboard(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	d, err := h.svc.GetDashboard(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, d)
}

func (h *Handler) UpdateDashboard(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.UpdateDashboardRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	d, err := h.svc.UpdateDashboard(c.Request.Context(), tenantID, c.Param("id"), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, d)
}

func (h *Handler) DeleteDashboard(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.DeleteDashboard(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

func (h *Handler) CountDashboards(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	count, err := h.svc.CountDashboards(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"count": count})
}

// ==================== Monitor Host Handlers ====================

func (h *Handler) CreateHost(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateHostRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	host, err := h.svc.CreateHost(c.Request.Context(), tenantID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, host)
}

func (h *Handler) ListHosts(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	ps, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	items, err := h.svc.ListHosts(c.Request.Context(), tenantID, (page-1)*ps, ps)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *Handler) GetHost(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	host, err := h.svc.GetHost(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, host)
}

func (h *Handler) UpdateHost(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.UpdateHostRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	host, err := h.svc.UpdateHost(c.Request.Context(), tenantID, c.Param("id"), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, host)
}

func (h *Handler) DeleteHost(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.DeleteHost(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

func (h *Handler) CountHosts(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	count, err := h.svc.CountHosts(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"count": count})
}

func (h *Handler) HostStatusSummary(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	summary, err := h.svc.GetHostStatusSummary(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, summary)
}

func (h *Handler) HostHeartbeat(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.Heartbeat(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "heartbeat recorded"})
}

// ==================== Alert Rule Handlers ====================

func (h *Handler) CreateAlertRule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateAlertRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	rule, err := h.svc.CreateAlertRule(c.Request.Context(), tenantID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, rule)
}

func (h *Handler) ListAlertRules(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.ListAlertRules(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *Handler) GetAlertRule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	rule, err := h.svc.GetAlertRule(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, rule)
}

func (h *Handler) UpdateAlertRule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.UpdateAlertRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	rule, err := h.svc.UpdateAlertRule(c.Request.Context(), tenantID, c.Param("id"), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, rule)
}

func (h *Handler) DeleteAlertRule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.DeleteAlertRule(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

func (h *Handler) ToggleAlertRule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req struct {
		Enabled bool `json:"enabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	rule, err := h.svc.ToggleAlertRule(c.Request.Context(), tenantID, c.Param("id"), req.Enabled)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, rule)
}

// ==================== Alert Instance Handlers ====================

func (h *Handler) ListAlerts(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	status := c.Query("status")
	severity := c.Query("severity")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	ps, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	items, total, err := h.svc.ListAlerts(c.Request.Context(), tenantID, status, severity, (page-1)*ps, ps)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	totalPages := total / ps
	if total%ps > 0 {
		totalPages++
	}
	c.JSON(http.StatusOK, models.PaginatedResult{
		Data:       items,
		Total:      total,
		Page:       page,
		PageSize:   ps,
		TotalPages: totalPages,
	})
}

func (h *Handler) GetAlert(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	alert, err := h.svc.GetAlert(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, alert)
}

func (h *Handler) AcknowledgeAlert(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	if userID == "" {
		userID = "anonymous"
	}
	alert, err := h.svc.AcknowledgeAlert(c.Request.Context(), tenantID, c.Param("id"), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, alert)
}

func (h *Handler) ResolveAlert(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	alert, err := h.svc.ResolveAlert(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, alert)
}

func (h *Handler) AlertStats(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	stats, err := h.svc.GetAlertStats(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, stats)
}

// ==================== Metric Handlers ====================

func (h *Handler) RecordMetric(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.RecordMetricRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.svc.RecordMetric(c.Request.Context(), tenantID, &req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message": "recorded"})
}

func (h *Handler) QueryMetricSeries(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	metricName := c.Param("name")
	startStr := c.DefaultQuery("start", time.Now().Add(-1*time.Hour).Format(time.RFC3339))
	endStr := c.DefaultQuery("end", time.Now().Format(time.RFC3339))
	maxPoints, _ := strconv.Atoi(c.DefaultQuery("max_points", "500"))

	start, err := time.Parse(time.RFC3339, startStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid start time"})
		return
	}
	end, err := time.Parse(time.RFC3339, endStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid end time"})
		return
	}

	points, err := h.svc.QueryMetricSeries(c.Request.Context(), tenantID, metricName, start, end, maxPoints)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": points})
}

func (h *Handler) GetLatestMetricValue(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	val, err := h.svc.GetLatestMetricValue(c.Request.Context(), tenantID, c.Param("name"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "no data"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"value": val})
}

func (h *Handler) GetMetricSummary(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	metricName := c.Param("name")
	windowMs, _ := strconv.ParseInt(c.DefaultQuery("window_ms", "3600000"), 10, 64)

	summary, err := h.svc.GetMetricSummary(c.Request.Context(), tenantID, metricName, windowMs)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, summary)
}

func (h *Handler) DetectAnomalies(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	metricName := c.Param("name")
	windowMs, _ := strconv.ParseInt(c.DefaultQuery("window_ms", "3600000"), 10, 64)
	threshold, _ := strconv.ParseFloat(c.DefaultQuery("threshold", "2.5"), 64)

	anomalies, err := h.svc.DetectAnomalies(c.Request.Context(), tenantID, metricName, windowMs, threshold)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": anomalies})
}

// ==================== Rule Evaluation ====================

func (h *Handler) EvaluateRules(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	alerts, err := h.svc.EvaluateRules(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"triggered": len(alerts), "alerts": alerts})
}

// ==================== Notification Channel Handlers ====================

func (h *Handler) CreateChannel(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateChannelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	ch, err := h.svc.CreateChannel(c.Request.Context(), tenantID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, ch)
}

func (h *Handler) ListChannels(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.ListChannels(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *Handler) ToggleChannel(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req struct {
		Enabled bool `json:"enabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.svc.ToggleChannel(c.Request.Context(), tenantID, c.Param("id"), req.Enabled); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "toggled"})
}

func (h *Handler) DeleteChannel(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.DeleteChannel(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

// ==================== Notification History ====================

func (h *Handler) ListNotificationHistory(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	alertID := c.Query("alert_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))

	items, err := h.svc.ListNotificationHistory(c.Request.Context(), tenantID, alertID, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *Handler) SendNotification(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req struct {
		ChannelIDs []string `json:"channel_ids" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	records, err := h.svc.SendNotification(c.Request.Context(), tenantID, c.Param("id"), req.ChannelIDs)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": records})
}
