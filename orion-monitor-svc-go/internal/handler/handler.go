package handler

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"orion/monitor-svc-go/internal/models"
	"orion/monitor-svc-go/internal/service"
	"go.uber.org/zap"
)

type Handler struct {
	metricSvc *service.MetricService
	alertSvc  *service.AlertService
	notifSvc  *service.NotificationService
	logger    *zap.Logger
}

func New(metricSvc *service.MetricService, alertSvc *service.AlertService, notifSvc *service.NotificationService, logger *zap.Logger) *Handler {
	return &Handler{
		metricSvc: metricSvc,
		alertSvc:  alertSvc,
		notifSvc:  notifSvc,
		logger:    logger,
	}
}

func (h *Handler) GetTenantID(c *gin.Context) uuid.UUID {
	tenantID, _ := uuid.Parse(c.GetString("tenantId"))
	return tenantID
}

// ==================== Health Check ====================

func (h *Handler) HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":  "healthy",
		"service": "orion-monitor-svc-go",
	})
}

// ==================== Metrics ====================

func (h *Handler) ReportMetric(c *gin.Context) {
	tenantID := h.GetTenantID(c)

	var req models.MetricQueryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "INVALID_REQUEST", "message": err.Error()})
		return
	}

	m, err := h.metricSvc.ReportMetric(c.Request.Context(), tenantID, req)
	if err != nil {
		h.logger.Error("failed to report metric", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "INTERNAL_ERROR", "message": "Failed to report metric"})
		return
	}

	c.JSON(http.StatusCreated, m)
}

func (h *Handler) QueryMetrics(c *gin.Context) {
	tenantID := h.GetTenantID(c)

	var req models.MetricQueryRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "INVALID_REQUEST", "message": err.Error()})
		return
	}

	resp, err := h.metricSvc.QueryMetrics(c.Request.Context(), tenantID, req)
	if err != nil {
		h.logger.Error("failed to query metrics", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "INTERNAL_ERROR", "message": "Failed to query metrics"})
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *Handler) GetMetricSeries(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	metricName := c.Param("name")

	ctx := c.Request.Context()
	series, err := h.metricSvc.GetSeries(ctx, tenantID, metricName)
	if err != nil {
		h.logger.Error("failed to get metric series", zap.String("metric", metricName), zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "INTERNAL_ERROR", "message": "Failed to get metric series"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": series, "count": len(series)})
}

func (h *Handler) GetMetricSummary(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	metricName := c.Param("name")

	windowMs, _ := strconv.ParseInt(c.Query("window_ms"), 10, 64)
	if windowMs <= 0 {
		windowMs = 60 * 60 * 1000 // default 1 hour
	}

	agg, err := h.metricSvc.GetAggregation(c.Request.Context(), tenantID, metricName, windowMs)
	if err != nil {
		h.logger.Error("failed to get metric summary", zap.String("metric", metricName), zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "INTERNAL_ERROR", "message": "Failed to get metric summary"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": gin.H{"summary": agg}})
}

func (h *Handler) GetRegisteredMetrics(c *gin.Context) {
	tenantID := h.GetTenantID(c)

	resp, err := h.notifSvc.ListRegisteredMetrics(c.Request.Context(), tenantID)
	if err != nil {
		h.logger.Error("failed to list registered metrics", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "INTERNAL_ERROR", "message": "Failed to list registered metrics"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": gin.H{"metrics": resp.Data}})
}

func (h *Handler) RegisterMetric(c *gin.Context) {
	tenantID := h.GetTenantID(c)

	var req models.RegisterMetricRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "INVALID_REQUEST", "message": err.Error()})
		return
	}

	reg, err := h.notifSvc.RegisterMetric(c.Request.Context(), tenantID, req.Name, req.Unit, req.DefaultTags, &req.Description)
	if err != nil {
		h.logger.Error("failed to register metric", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "INTERNAL_ERROR", "message": "Failed to register metric"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"success": true, "data": gin.H{"metric": reg}})
}

func (h *Handler) GetMetricAggregation(c *gin.Context) {
	tenantID := h.GetTenantID(c)

	var req models.GetMetricAggregationRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "INVALID_REQUEST", "message": err.Error()})
		return
	}

	windowMs := int64(req.WindowMs)
	if windowMs <= 0 {
		windowMs = 60 * 60 * 1000 // default 1 hour
	}

	agg, err := h.metricSvc.GetAggregation(c.Request.Context(), tenantID, req.MetricName, windowMs)
	if err != nil {
		h.logger.Error("failed to get metric aggregation", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "INTERNAL_ERROR", "message": "Failed to get metric aggregation"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": agg})
}

// ==================== Traces ====================

func (h *Handler) QueryTraces(c *gin.Context) {
	tenantID := h.GetTenantID(c)

	var req models.TraceQueryRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "INVALID_REQUEST", "message": err.Error()})
		return
	}

	resp, err := h.metricSvc.GetTraces(c.Request.Context(), tenantID, req)
	if err != nil {
		h.logger.Error("failed to query traces", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "INTERNAL_ERROR", "message": "Failed to query traces"})
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *Handler) GetTraceDetail(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	TRACE_ID := c.Param("trace_id")

	traces, err := h.metricSvc.GetTraceDetail(c.Request.Context(), tenantID, TRACE_ID)
	if err != nil {
		h.logger.Error("failed to get trace detail", zap.String("traceId", TRACE_ID), zap.Error(err))
		c.JSON(http.StatusNotFound, gin.H{"error": "NOT_FOUND", "message": "Trace not found"})
		return
	}

	if len(traces) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "NOT_FOUND", "message": "Trace not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"total": len(traces), "data": traces})
}

// ==================== Services ====================

func (h *Handler) GetServices(c *gin.Context) {
	tenantID := h.GetTenantID(c)

	services, err := h.metricSvc.GetServices(c.Request.Context(), tenantID)
	if err != nil {
		h.logger.Error("failed to get services", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "INTERNAL_ERROR", "message": "Failed to get services"})
		return
	}

	if services == nil {
		services = []string{}
	}

	c.JSON(http.StatusOK, gin.H{"total": len(services), "data": services})
}

func (h *Handler) GetServiceOverview(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	serviceName := c.Param("service_name")

	overview, err := h.metricSvc.GetServiceOverview(c.Request.Context(), tenantID, serviceName)
	if err != nil {
		h.logger.Error("failed to get service overview", zap.String("serviceName", serviceName), zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "INTERNAL_ERROR", "message": "Failed to get service overview"})
		return
	}

	c.JSON(http.StatusOK, overview)
}

// ==================== Alerts ====================

func (h *Handler) QueryAlerts(c *gin.Context) {
	tenantID := h.GetTenantID(c)

	var req models.AlertQueryRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "INVALID_REQUEST", "message": err.Error()})
		return
	}

	resp, err := h.alertSvc.QueryAlerts(c.Request.Context(), tenantID, req)
	if err != nil {
		h.logger.Error("failed to query alerts", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "INTERNAL_ERROR", "message": "Failed to query alerts"})
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *Handler) GetAlertByID(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "INVALID_ID", "message": "Invalid alert ID"})
		return
	}

	alert, err := h.alertSvc.GetAlertByID(c.Request.Context(), tenantID, id)
	if err != nil {
		h.logger.Error("failed to get alert", zap.String("id", id.String()), zap.Error(err))
		c.JSON(http.StatusNotFound, gin.H{"error": "NOT_FOUND", "message": "Alert not found"})
		return
	}

	c.JSON(http.StatusOK, alert)
}

func (h *Handler) GetActiveAlerts(c *gin.Context) {
	tenantID := h.GetTenantID(c)

	resp, err := h.notifSvc.GetActiveAlerts(c.Request.Context(), tenantID)
	if err != nil {
		h.logger.Error("failed to get active alerts", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "INTERNAL_ERROR", "message": "Failed to get active alerts"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": gin.H{"alerts": resp.Data, "count": len(resp.Data)}})
}

func (h *Handler) AcknowledgeAlert(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "INVALID_ID", "message": "Invalid alert ID"})
		return
	}

	if err := h.notifSvc.AcknowledgeAlert(c.Request.Context(), tenantID, id); err != nil {
		h.logger.Error("failed to acknowledge alert", zap.String("id", id.String()), zap.Error(err))
		c.JSON(http.StatusNotFound, gin.H{"error": "NOT_FOUND", "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Alert acknowledged", "alert_id": id.String()})
}

func (h *Handler) SilenceAlert(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "INVALID_ID", "message": "Invalid alert ID"})
		return
	}

	if err := h.alertSvc.SilenceAlert(c.Request.Context(), tenantID, id); err != nil {
		h.logger.Error("failed to silence alert", zap.String("id", id.String()), zap.Error(err))
		c.JSON(http.StatusNotFound, gin.H{"error": "NOT_FOUND", "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Alert silenced", "alert_id": id.String()})
}

func (h *Handler) ResolveAlert(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "INVALID_ID", "message": "Invalid alert ID"})
		return
	}

	if err := h.alertSvc.ResolveAlert(c.Request.Context(), tenantID, id); err != nil {
		h.logger.Error("failed to resolve alert", zap.String("id", id.String()), zap.Error(err))
		c.JSON(http.StatusNotFound, gin.H{"error": "NOT_FOUND", "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Alert resolved", "alert_id": id.String()})
}

// ==================== Alert Rules ====================

func (h *Handler) QueryAlertRules(c *gin.Context) {
	tenantID := h.GetTenantID(c)

	resp, err := h.alertSvc.QueryAlertRules(c.Request.Context(), tenantID)
	if err != nil {
		h.logger.Error("failed to query alert rules", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "INTERNAL_ERROR", "message": "Failed to query alert rules"})
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *Handler) CreateAlertRule(c *gin.Context) {
	tenantID := h.GetTenantID(c)

	var req models.CreateAlertRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "INVALID_REQUEST", "message": err.Error()})
		return
	}

	rule, err := h.alertSvc.CreateAlertRule(c.Request.Context(), tenantID, req)
	if err != nil {
		h.logger.Error("failed to create alert rule", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "INTERNAL_ERROR", "message": "Failed to create alert rule"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"success": true, "data": gin.H{"rule": rule}})
}

func (h *Handler) GetAlertRule(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "INVALID_ID", "message": "Invalid alert rule ID"})
		return
	}

	rule, err := h.alertSvc.GetAlertRule(c.Request.Context(), tenantID, id)
	if err != nil {
		h.logger.Error("failed to get alert rule", zap.String("id", id.String()), zap.Error(err))
		c.JSON(http.StatusNotFound, gin.H{"error": "NOT_FOUND", "message": "Alert rule not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"rule": rule}})
}

func (h *Handler) UpdateAlertRule(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "INVALID_ID", "message": "Invalid alert rule ID"})
		return
	}

	var req models.UpdateAlertRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "INVALID_REQUEST", "message": err.Error()})
		return
	}

	if err := h.alertSvc.UpdateAlertRule(c.Request.Context(), tenantID, id, req); err != nil {
		h.logger.Error("failed to update alert rule", zap.String("id", id.String()), zap.Error(err))
		c.JSON(http.StatusNotFound, gin.H{"error": "NOT_FOUND", "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Alert rule updated", "id": id.String()})
}

func (h *Handler) DeleteAlertRule(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "INVALID_ID", "message": "Invalid alert rule ID"})
		return
	}

	if err := h.alertSvc.DeleteAlertRule(c.Request.Context(), tenantID, id); err != nil {
		h.logger.Error("failed to delete alert rule", zap.String("id", id.String()), zap.Error(err))
		c.JSON(http.StatusNotFound, gin.H{"error": "NOT_FOUND", "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Alert rule deleted", "id": id.String()})
}

func (h *Handler) ToggleAlertRule(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "INVALID_ID", "message": "Invalid alert rule ID"})
		return
	}

	enabled, _ := strconv.ParseBool(c.Query("enabled"))
	rule, err := h.alertSvc.GetAlertRule(c.Request.Context(), tenantID, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "NOT_FOUND", "message": "Alert rule not found"})
		return
	}

	rule.IsEnabled = enabled
	if err := h.alertSvc.UpdateAlertRule(c.Request.Context(), tenantID, id, models.UpdateAlertRuleRequest{IsEnabled: &enabled}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "INTERNAL_ERROR", "message": "Failed to toggle rule"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"rule": rule}})
}

func (h *Handler) Count(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	count, err := h.alertSvc.Count(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"count": count})
}

// ==================== Notification Channels ====================

func (h *Handler) CreateChannel(c *gin.Context) {
	tenantID := h.GetTenantID(c)

	var req models.CreateNotificationChannelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "INVALID_REQUEST", "message": err.Error()})
		return
	}

	channel, err := h.notifSvc.CreateChannel(c.Request.Context(), tenantID, req)
	if err != nil {
		h.logger.Error("failed to create channel", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "INTERNAL_ERROR", "message": "Failed to create channel"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"success": true, "data": gin.H{"channel": channel}})
}

func (h *Handler) ListChannels(c *gin.Context) {
	tenantID := h.GetTenantID(c)

	resp, err := h.notifSvc.ListChannels(c.Request.Context(), tenantID)
	if err != nil {
		h.logger.Error("failed to list channels", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "INTERNAL_ERROR", "message": "Failed to list channels"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"channels": resp.Data}})
}

func (h *Handler) GetChannel(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "INVALID_ID", "message": "Invalid channel ID"})
		return
	}

	channel, err := h.notifSvc.GetChannel(c.Request.Context(), tenantID, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "NOT_FOUND", "message": "Channel not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"channel": channel}})
}

func (h *Handler) ToggleChannel(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "INVALID_ID", "message": "Invalid channel ID"})
		return
	}

	var body gin.H
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "INVALID_REQUEST", "message": err.Error()})
		return
	}
	enabled := true
	if v, ok := body["enabled"]; ok && v != nil {
		if e, ok := v.(bool); ok {
			enabled = e
		}
	}

	channel, err := h.notifSvc.ToggleChannel(c.Request.Context(), tenantID, id, enabled)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "NOT_FOUND", "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"channel": channel}})
}

func (h *Handler) DeleteChannel(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "INVALID_ID", "message": "Invalid channel ID"})
		return
	}

	if err := h.notifSvc.DeleteChannel(c.Request.Context(), tenantID, id); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "NOT_FOUND", "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Channel deleted"})
}

// ==================== Escalation Policies ====================

func (h *Handler) CreateEscalationPolicy(c *gin.Context) {
	tenantID := h.GetTenantID(c)

	var req models.CreateEscalationPolicyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "INVALID_REQUEST", "message": err.Error()})
		return
	}

	policy, err := h.notifSvc.CreateEscalationPolicy(c.Request.Context(), tenantID, req)
	if err != nil {
		h.logger.Error("failed to create escalation policy", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "INTERNAL_ERROR", "message": "Failed to create escalation policy"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"success": true, "data": gin.H{"policy": policy}})
}

func (h *Handler) ListEscalationPolicies(c *gin.Context) {
	tenantID := h.GetTenantID(c)

	resp, err := h.notifSvc.ListEscalationPolicies(c.Request.Context(), tenantID)
	if err != nil {
		h.logger.Error("failed to list escalation policies", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "INTERNAL_ERROR", "message": "Failed to list escalation policies"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"policies": resp.Data}})
}

func (h *Handler) GetEscalationPolicy(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "INVALID_ID", "message": "Invalid policy ID"})
		return
	}

	policy, err := h.notifSvc.GetEscalationPolicy(c.Request.Context(), tenantID, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "NOT_FOUND", "message": "Escalation policy not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"policy": policy}})
}

// ==================== Notification History ====================

func (h *Handler) ListNotificationHistory(c *gin.Context) {
	tenantID := h.GetTenantID(c)

	var req models.NotificationHistoryQueryRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "INVALID_REQUEST", "message": err.Error()})
		return
	}

	resp, err := h.notifSvc.ListNotificationHistory(c.Request.Context(), tenantID, req)
	if err != nil {
		h.logger.Error("failed to list notification history", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "INTERNAL_ERROR", "message": "Failed to list notification history"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"history": resp.Data}})
}

// ==================== Dashboard ====================

func (h *Handler) GetDashboard(c *gin.Context) {
	tenantID := h.GetTenantID(c)

	timeWindow := models.TimeWindow(c.Query("time_window"))
	if timeWindow == "" {
		timeWindow = models.TimeWindow1h
	}

	data, err := h.notifSvc.GetDashboardData(c.Request.Context(), tenantID, timeWindow)
	if err != nil {
		h.logger.Error("failed to get dashboard data", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "INTERNAL_ERROR", "message": "Failed to get dashboard data"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"dashboard": data}})
}

func (h *Handler) CreateWidgetConfig(c *gin.Context) {
	tenantID := h.GetTenantID(c)

	var body gin.H
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "INVALID_REQUEST", "message": err.Error()})
		return
	}

	title, ok := body["title"].(string)
	if !ok || title == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "VALIDATION_ERROR", "message": "Missing required field: title"})
		return
	}

	metricsRaw, ok := body["metrics"].([]interface{})
	if !ok || len(metricsRaw) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "VALIDATION_ERROR", "message": "Missing required field: metrics (array)"})
		return
	}
	var metrics []string
	for _, m := range metricsRaw {
		if s, ok := m.(string); ok {
			metrics = append(metrics, s)
		}
	}
	if len(metrics) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "VALIDATION_ERROR", "message": "metrics must contain at least one valid string"})
		return
	}

	timeWindow := body["time_window"]
	if tw, ok := timeWindow.(string); !ok || tw == "" {
		timeWindow = "1h"
	}

	cfg, err := h.notifSvc.CreateWidgetConfig(c.Request.Context(), tenantID, title, metrics, timeWindow.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "INTERNAL_ERROR", "message": "Failed to create widget config"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"success": true, "data": gin.H{"widget": cfg}})
}

func (h *Handler) ListWidgetConfigs(c *gin.Context) {
	tenantID := h.GetTenantID(c)

	widgets, err := h.notifSvc.ListWidgetConfigs(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "INTERNAL_ERROR", "message": "Failed to list widget configs"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"widgets": widgets}})
}

func (h *Handler) DeleteWidgetConfig(c *gin.Context) {
	tenantID := h.GetTenantID(c)

	widgetIDStr := c.Param("id")
	widgetID, err := uuid.Parse(widgetIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "VALIDATION_ERROR", "message": "Invalid widget ID"})
		return
	}

	if err := h.notifSvc.DeleteWidgetConfig(c.Request.Context(), tenantID, widgetID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "INTERNAL_ERROR", "message": "Failed to delete widget config"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Widget config deleted"})
}

func (h *Handler) GetAggregatedMetrics(c *gin.Context) {
	tenantID := h.GetTenantID(c)

	metricsParam := c.Query("metrics")
	if metricsParam == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "VALIDATION_ERROR", "message": "Missing required query param: metrics (comma-separated)"})
		return
	}

	var metrics []string
	for _, m := range strings.Split(metricsParam, ",") {
		m = strings.TrimSpace(m)
		if m != "" {
			metrics = append(metrics, m)
		}
	}

	timeWindow := models.TimeWindow(c.Query("time_window"))
	if timeWindow == "" {
		timeWindow = models.TimeWindow1h
	}

	aggregated, err := h.notifSvc.GetAggregatedMetrics(c.Request.Context(), tenantID, metrics, timeWindow)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "INTERNAL_ERROR", "message": "Failed to get aggregated metrics"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"aggregated": aggregated}})
}

// ==================== Anomalies ====================

func (h *Handler) DetectAnomalies(c *gin.Context) {
	tenantID := h.GetTenantID(c)

	metricName := c.Query("metric")
	if metricName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "VALIDATION_ERROR", "message": "Missing required query param: metric"})
		return
	}

	timeWindow := models.TimeWindow(c.Query("time_window"))
	if timeWindow == "" {
		// This is an invalid case, but we'll set a default
		timeWindow = models.TimeWindow1h
	}

	thresholdStr := c.Query("threshold")
	threshold := 3.0
	if ts, err := strconv.ParseFloat(thresholdStr, 64); err == nil {
		threshold = ts
	}

	anomalies, err := h.notifSvc.DetectAnomalies(c.Request.Context(), tenantID, metricName, timeWindow, threshold)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "INTERNAL_ERROR", "message": "Failed to detect anomalies"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"anomalies": anomalies, "count": len(anomalies)}})
}

func (h *Handler) GetAnomalySummary(c *gin.Context) {
	// Return an empty summary for now
	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"summary": gin.H{
		"anomaly_count": 0,
		"total_metrics": 0,
		"last_updated":  time.Now(),
	}}})
}

func (h *Handler) GetAlertStats(c *gin.Context) {
	tenantID := h.GetTenantID(c)

	// Count by status
	firingResp, _ := h.alertSvc.QueryAlerts(c.Request.Context(), tenantID, models.AlertQueryRequest{Status: "firing"})
	ackResp, _ := h.alertSvc.QueryAlerts(c.Request.Context(), tenantID, models.AlertQueryRequest{Status: "acknowledged"})
	silencedResp, _ := h.alertSvc.QueryAlerts(c.Request.Context(), tenantID, models.AlertQueryRequest{Status: "silenced"})

	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"stats": gin.H{
		"firing":      len(firingResp.Data),
		"acknowledged": len(ackResp.Data),
		"silenced":    len(silencedResp.Data),
		"total":       len(firingResp.Data) + len(ackResp.Data) + len(silencedResp.Data),
	}}})
}
