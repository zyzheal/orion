package handler

import (
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.opentelemetry.io/otel"
	"go.uber.org/zap"
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/monitoring/internal/models"
	"orion/platform-svc-go/internal/monitoring/internal/service"
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

// RegisterRoutes registers all monitor API routes under the given router group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	// Health
	rg.GET("/health", h.HealthCheck)

	// Metrics
	rg.POST("/metrics/report", auth.RequirePermission("monitor", "write"), h.ReportMetric)
	rg.GET("/metrics/query", auth.RequirePermission("monitor", "read"), h.QueryMetrics)
	rg.GET("/metrics/series/:name", auth.RequirePermission("monitor", "read"), h.GetMetricSeries)
	rg.GET("/metrics/summary/:name", auth.RequirePermission("monitor", "read"), h.GetMetricSummary)
	rg.POST("/metrics/collect", auth.RequirePermission("monitor", "write"), h.CollectSystemMetrics)
	rg.GET("/metrics/registered", auth.RequirePermission("monitor", "read"), h.GetRegisteredMetrics)
	rg.POST("/metrics/register", auth.RequirePermission("monitor", "write"), h.RegisterMetric)
	rg.GET("/metrics/aggregation", auth.RequirePermission("monitor", "read"), h.GetMetricAggregation)

	// Traces
	rg.GET("/traces", auth.RequirePermission("monitor", "read"), h.QueryTraces)
	rg.GET("/traces/:trace_id", auth.RequirePermission("monitor", "read"), h.GetTraceDetail)

	// Services
	rg.GET("/services", auth.RequirePermission("monitor", "read"), h.GetServices)
	rg.GET("/services/:service_name/overview", auth.RequirePermission("monitor", "read"), h.GetServiceOverview)

	// Alerts
	rg.GET("/alerts", auth.RequirePermission("monitor", "read"), h.QueryAlerts)
	rg.GET("/alerts/:id", auth.RequirePermission("monitor", "read"), h.GetAlertByID)
	rg.GET("/alerts/active", auth.RequirePermission("monitor", "read"), h.GetActiveAlerts)
	rg.POST("/alerts/:id/acknowledge", auth.RequirePermission("monitor", "execute"), h.AcknowledgeAlert)
	rg.POST("/alerts/:id/silence", auth.RequirePermission("monitor", "execute"), h.SilenceAlert)
	rg.POST("/alerts/:id/resolve", auth.RequirePermission("monitor", "execute"), h.ResolveAlert)

	// Alert Rules
	rg.GET("/alert-rules", auth.RequirePermission("monitor", "read"), h.QueryAlertRules)
	rg.POST("/alert-rules", auth.RequirePermission("monitor", "write"), h.CreateAlertRule)
	rg.GET("/alert-rules/:id", auth.RequirePermission("monitor", "read"), h.GetAlertRule)
	rg.PUT("/alert-rules/:id", auth.RequirePermission("monitor", "write"), h.UpdateAlertRule)
	rg.DELETE("/alert-rules/:id", auth.RequirePermission("monitor", "delete"), h.DeleteAlertRule)
	rg.PATCH("/alert-rules/:id/toggle", auth.RequirePermission("monitor", "write"), h.ToggleAlertRule)
	rg.GET("/alert-rules/count", auth.RequirePermission("monitor", "read"), h.Count)

	// Notification Channels
	rg.POST("/channels", auth.RequirePermission("monitor", "write"), h.CreateChannel)
	rg.GET("/channels", auth.RequirePermission("monitor", "read"), h.ListChannels)
	rg.GET("/channels/:id", auth.RequirePermission("monitor", "read"), h.GetChannel)
	rg.PATCH("/channels/:id/toggle", auth.RequirePermission("monitor", "write"), h.ToggleChannel)
	rg.DELETE("/channels/:id", auth.RequirePermission("monitor", "delete"), h.DeleteChannel)

	// Escalation Policies
	rg.POST("/escalation-policies", auth.RequirePermission("monitor", "write"), h.CreateEscalationPolicy)
	rg.GET("/escalation-policies", auth.RequirePermission("monitor", "read"), h.ListEscalationPolicies)
	rg.GET("/escalation-policies/:id", auth.RequirePermission("monitor", "read"), h.GetEscalationPolicy)

	// Notification History
	rg.GET("/notification-history", auth.RequirePermission("monitor", "read"), h.ListNotificationHistory)

	// Dashboard
	rg.GET("/dashboard", auth.RequirePermission("monitor", "read"), h.GetDashboard)
	rg.POST("/widgets", auth.RequirePermission("monitor", "write"), h.CreateWidgetConfig)
	rg.GET("/widgets", auth.RequirePermission("monitor", "read"), h.ListWidgetConfigs)
	rg.DELETE("/widgets/:id", auth.RequirePermission("monitor", "delete"), h.DeleteWidgetConfig)

	// Aggregated Metrics
	rg.GET("/metrics/aggregated", auth.RequirePermission("monitor", "read"), h.GetAggregatedMetrics)

	// Anomalies
	rg.GET("/anomalies/detect", auth.RequirePermission("monitor", "read"), h.DetectAnomalies)
	rg.GET("/anomalies/summary", auth.RequirePermission("monitor", "read"), h.GetAnomalySummary)

	// Alert Stats
	rg.GET("/alerts/stats", auth.RequirePermission("monitor", "read"), h.GetAlertStats)
}

// ==================== Health Check ====================

func (h *Handler) HealthCheck(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "MonitorHealthCheck")
	defer span.End()
	respondSuccess(c, gin.H{
		"status":  "healthy",
		"service": "orion-monitor-svc-go",
	})
}

// ==================== Metrics ====================

func (h *Handler) ReportMetric(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "MonitorReportMetric")
	defer span.End()
	tenantID := h.GetTenantID(c)

	var req models.MetricQueryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	m, err := h.metricSvc.ReportMetric(ctx, tenantID, req)
	if err != nil {
		h.logger.Error("failed to report metric", zap.Error(err))
		respondInternalError(c, "Failed to report metric")
		return
	}

	respondCreated(c, m)
}

func (h *Handler) QueryMetrics(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "MonitorQueryMetrics")
	defer span.End()
	tenantID := h.GetTenantID(c)

	var req models.MetricQueryRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	resp, err := h.metricSvc.QueryMetrics(ctx, tenantID, req)
	if err != nil {
		h.logger.Error("failed to query metrics", zap.Error(err))
		respondInternalError(c, "Failed to query metrics")
		return
	}

	respondSuccess(c, resp)
}

func (h *Handler) GetMetricSeries(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "MonitorGetMetricSeries")
	defer span.End()
	tenantID := h.GetTenantID(c)
	metricName := c.Param("name")
	series, err := h.metricSvc.GetSeries(ctx, tenantID, metricName)
	if err != nil {
		h.logger.Error("failed to get metric series", zap.String("metric", metricName), zap.Error(err))
		respondInternalError(c, "Failed to get metric series")
		return
	}

	respondSuccess(c, gin.H{"data": series, "count": len(series)})
}

func (h *Handler) GetMetricSummary(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "MonitorGetMetricSummary")
	defer span.End()
	tenantID := h.GetTenantID(c)
	metricName := c.Param("name")

	windowMs, _ := strconv.ParseInt(c.Query("window_ms"), 10, 64)
	if windowMs <= 0 {
		windowMs = 60 * 60 * 1000 // default 1 hour
	}

	agg, err := h.metricSvc.GetAggregation(ctx, tenantID, metricName, windowMs)
	if err != nil {
		h.logger.Error("failed to get metric summary", zap.String("metric", metricName), zap.Error(err))
		respondInternalError(c, "Failed to get metric summary")
		return
	}

	respondSuccess(c, gin.H{"data": gin.H{"summary": agg}})
}

// CollectSystemMetrics accepts a batch of system-level metrics (CPU, memory, disk, network)
// for a host and persists them as individual metric data points.
func (h *Handler) CollectSystemMetrics(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "MonitorCollectSystemMetrics")
	defer span.End()
	tenantID := h.GetTenantID(c)

	var req models.CollectSystemMetricsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	resp, err := h.metricSvc.CollectSystemMetrics(ctx, tenantID, req)
	if err != nil {
		h.logger.Error("failed to collect system metrics",
			zap.String("hostname", req.Hostname),
			zap.Error(err),
		)
		respondInternalError(c, "Failed to collect system metrics")
		return
	}

	respondCreated(c, resp)
}

func (h *Handler) GetRegisteredMetrics(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "MonitorGetRegisteredMetrics")
	defer span.End()
	tenantID := h.GetTenantID(c)

	resp, err := h.notifSvc.ListRegisteredMetrics(ctx, tenantID)
	if err != nil {
		h.logger.Error("failed to list registered metrics", zap.Error(err))
		respondInternalError(c, "Failed to list registered metrics")
		return
	}

	respondSuccess(c, gin.H{"metrics": resp.Data})
}

func (h *Handler) RegisterMetric(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "MonitorRegisterMetric")
	defer span.End()
	tenantID := h.GetTenantID(c)

	var req models.RegisterMetricRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	reg, err := h.notifSvc.RegisterMetric(ctx, tenantID, req.Name, req.Unit, req.DefaultTags, &req.Description)
	if err != nil {
		h.logger.Error("failed to register metric", zap.Error(err))
		respondInternalError(c, "Failed to register metric")
		return
	}

	respondCreated(c, gin.H{"success": true, "data": gin.H{"metric": reg}})
}

func (h *Handler) GetMetricAggregation(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "MonitorGetMetricAggregation")
	defer span.End()
	tenantID := h.GetTenantID(c)

	var req models.GetMetricAggregationRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	windowMs := int64(req.WindowMs)
	if windowMs <= 0 {
		windowMs = 60 * 60 * 1000 // default 1 hour
	}

	agg, err := h.metricSvc.GetAggregation(ctx, tenantID, req.MetricName, windowMs)
	if err != nil {
		h.logger.Error("failed to get metric aggregation", zap.Error(err))
		respondInternalError(c, "Failed to get metric aggregation")
		return
	}

	respondSuccess(c, agg)
}

// ==================== Traces ====================

func (h *Handler) QueryTraces(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "MonitorQueryTraces")
	defer span.End()
	tenantID := h.GetTenantID(c)

	var req models.TraceQueryRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	resp, err := h.metricSvc.GetTraces(ctx, tenantID, req)
	if err != nil {
		h.logger.Error("failed to query traces", zap.Error(err))
		respondInternalError(c, "Failed to query traces")
		return
	}

	respondSuccess(c, resp)
}

func (h *Handler) GetTraceDetail(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "MonitorGetTraceDetail")
	defer span.End()
	tenantID := h.GetTenantID(c)
	TRACE_ID := c.Param("trace_id")

	traces, err := h.metricSvc.GetTraceDetail(ctx, tenantID, TRACE_ID)
	if err != nil {
		h.logger.Error("failed to get trace detail", zap.String("traceId", TRACE_ID), zap.Error(err))
		respondNotFound(c, "Trace not found")
		return
	}

	if len(traces) == 0 {
		respondNotFound(c, "Trace not found")
		return
	}

	respondSuccess(c, gin.H{"total": len(traces), "data": traces})
}

// ==================== Services ====================

func (h *Handler) GetServices(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "MonitorGetServices")
	defer span.End()
	tenantID := h.GetTenantID(c)

	services, err := h.metricSvc.GetServices(ctx, tenantID)
	if err != nil {
		h.logger.Error("failed to get services", zap.Error(err))
		respondInternalError(c, "Failed to get services")
		return
	}

	if services == nil {
		services = []string{}
	}

	respondSuccess(c, gin.H{"total": len(services), "data": services})
}

func (h *Handler) GetServiceOverview(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "MonitorGetServiceOverview")
	defer span.End()
	tenantID := h.GetTenantID(c)
	serviceName := c.Param("service_name")

	overview, err := h.metricSvc.GetServiceOverview(ctx, tenantID, serviceName)
	if err != nil {
		h.logger.Error("failed to get service overview", zap.String("serviceName", serviceName), zap.Error(err))
		respondInternalError(c, "Failed to get service overview")
		return
	}

	respondSuccess(c, overview)
}

// ==================== Alerts ====================

func (h *Handler) QueryAlerts(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "MonitorQueryAlerts")
	defer span.End()
	tenantID := h.GetTenantID(c)

	var req models.AlertQueryRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	resp, err := h.alertSvc.QueryAlerts(ctx, tenantID, req)
	if err != nil {
		h.logger.Error("failed to query alerts", zap.Error(err))
		respondInternalError(c, "Failed to query alerts")
		return
	}

	respondSuccess(c, resp)
}

func (h *Handler) GetAlertByID(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "MonitorGetAlertByID")
	defer span.End()
	tenantID := h.GetTenantID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		respondBadRequest(c, "Invalid alert ID")
		return
	}

	alert, err := h.alertSvc.GetAlertByID(ctx, tenantID, id)
	if err != nil {
		h.logger.Error("failed to get alert", zap.String("id", id.String()), zap.Error(err))
		respondNotFound(c, "Alert not found")
		return
	}

	respondSuccess(c, alert)
}

func (h *Handler) GetActiveAlerts(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "MonitorGetActiveAlerts")
	defer span.End()
	tenantID := h.GetTenantID(c)

	resp, err := h.notifSvc.GetActiveAlerts(ctx, tenantID)
	if err != nil {
		h.logger.Error("failed to get active alerts", zap.Error(err))
		respondInternalError(c, "Failed to get active alerts")
		return
	}

	respondSuccess(c, gin.H{"alerts": resp.Data, "count": len(resp.Data)})
}

func (h *Handler) AcknowledgeAlert(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "MonitorAcknowledgeAlert")
	defer span.End()
	tenantID := h.GetTenantID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		respondBadRequest(c, "Invalid alert ID")
		return
	}

	if err := h.notifSvc.AcknowledgeAlert(ctx, tenantID, id); err != nil {
		h.logger.Error("failed to acknowledge alert", zap.String("id", id.String()), zap.Error(err))
		respondNotFound(c, err.Error())
		return
	}

	respondSuccess(c, gin.H{"message": "Alert acknowledged", "alert_id": id.String()})
}

func (h *Handler) SilenceAlert(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "MonitorSilenceAlert")
	defer span.End()
	tenantID := h.GetTenantID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		respondBadRequest(c, "Invalid alert ID")
		return
	}

	if err := h.alertSvc.SilenceAlert(ctx, tenantID, id); err != nil {
		h.logger.Error("failed to silence alert", zap.String("id", id.String()), zap.Error(err))
		respondNotFound(c, err.Error())
		return
	}

	respondSuccess(c, gin.H{"message": "Alert silenced", "alert_id": id.String()})
}

func (h *Handler) ResolveAlert(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "MonitorResolveAlert")
	defer span.End()
	tenantID := h.GetTenantID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		respondBadRequest(c, "Invalid alert ID")
		return
	}

	if err := h.alertSvc.ResolveAlert(ctx, tenantID, id); err != nil {
		h.logger.Error("failed to resolve alert", zap.String("id", id.String()), zap.Error(err))
		respondNotFound(c, err.Error())
		return
	}

	respondSuccess(c, gin.H{"message": "Alert resolved", "alert_id": id.String()})
}

// ==================== Alert Rules ====================

func (h *Handler) QueryAlertRules(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "MonitorQueryAlertRules")
	defer span.End()
	tenantID := h.GetTenantID(c)

	resp, err := h.alertSvc.QueryAlertRules(ctx, tenantID)
	if err != nil {
		h.logger.Error("failed to query alert rules", zap.Error(err))
		respondInternalError(c, "Failed to query alert rules")
		return
	}

	respondSuccess(c, resp)
}

func (h *Handler) CreateAlertRule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "MonitorCreateAlertRule")
	defer span.End()
	tenantID := h.GetTenantID(c)

	var req models.CreateAlertRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	rule, err := h.alertSvc.CreateAlertRule(ctx, tenantID, req)
	if err != nil {
		h.logger.Error("failed to create alert rule", zap.Error(err))
		respondInternalError(c, "Failed to create alert rule")
		return
	}

	respondCreated(c, gin.H{"success": true, "data": gin.H{"rule": rule}})
}

func (h *Handler) GetAlertRule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "MonitorGetAlertRule")
	defer span.End()
	tenantID := h.GetTenantID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		respondBadRequest(c, "Invalid alert rule ID")
		return
	}

	rule, err := h.alertSvc.GetAlertRule(ctx, tenantID, id)
	if err != nil {
		h.logger.Error("failed to get alert rule", zap.String("id", id.String()), zap.Error(err))
		respondNotFound(c, "Alert rule not found")
		return
	}

	respondSuccess(c, gin.H{"success": true, "data": gin.H{"rule": rule}})
}

func (h *Handler) UpdateAlertRule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "MonitorUpdateAlertRule")
	defer span.End()
	tenantID := h.GetTenantID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		respondBadRequest(c, "Invalid alert rule ID")
		return
	}

	var req models.UpdateAlertRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	if err := h.alertSvc.UpdateAlertRule(ctx, tenantID, id, req); err != nil {
		h.logger.Error("failed to update alert rule", zap.String("id", id.String()), zap.Error(err))
		respondNotFound(c, err.Error())
		return
	}

	respondSuccess(c, gin.H{"success": true, "message": "Alert rule updated", "id": id.String()})
}

func (h *Handler) DeleteAlertRule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "MonitorDeleteAlertRule")
	defer span.End()
	tenantID := h.GetTenantID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		respondBadRequest(c, "Invalid alert rule ID")
		return
	}

	if err := h.alertSvc.DeleteAlertRule(ctx, tenantID, id); err != nil {
		h.logger.Error("failed to delete alert rule", zap.String("id", id.String()), zap.Error(err))
		respondNotFound(c, err.Error())
		return
	}

	respondSuccess(c, gin.H{"success": true, "message": "Alert rule deleted", "id": id.String()})
}

func (h *Handler) ToggleAlertRule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "MonitorToggleAlertRule")
	defer span.End()
	tenantID := h.GetTenantID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		respondBadRequest(c, "Invalid alert rule ID")
		return
	}

	enabled, _ := strconv.ParseBool(c.Query("enabled"))
	rule, err := h.alertSvc.GetAlertRule(ctx, tenantID, id)
	if err != nil {
		respondNotFound(c, "Alert rule not found")
		return
	}

	rule.IsEnabled = enabled
	if err := h.alertSvc.UpdateAlertRule(ctx, tenantID, id, models.UpdateAlertRuleRequest{IsEnabled: &enabled}); err != nil {
		respondInternalError(c, "Failed to toggle rule")
		return
	}

	respondSuccess(c, gin.H{"success": true, "data": gin.H{"rule": rule}})
}

func (h *Handler) Count(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "MonitorCount")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	count, err := h.alertSvc.Count(ctx, tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"count": count})
}

// ==================== Notification Channels ====================

func (h *Handler) CreateChannel(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "MonitorCreateChannel")
	defer span.End()
	tenantID := h.GetTenantID(c)

	var req models.CreateNotificationChannelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	channel, err := h.notifSvc.CreateChannel(ctx, tenantID, req)
	if err != nil {
		h.logger.Error("failed to create channel", zap.Error(err))
		respondInternalError(c, "Failed to create channel")
		return
	}

	respondCreated(c, gin.H{"success": true, "data": gin.H{"channel": channel}})
}

func (h *Handler) ListChannels(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "MonitorListChannels")
	defer span.End()
	tenantID := h.GetTenantID(c)

	resp, err := h.notifSvc.ListChannels(ctx, tenantID)
	if err != nil {
		h.logger.Error("failed to list channels", zap.Error(err))
		respondInternalError(c, "Failed to list channels")
		return
	}

	respondSuccess(c, gin.H{"success": true, "data": gin.H{"channels": resp.Data}})
}

func (h *Handler) GetChannel(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "MonitorGetChannel")
	defer span.End()
	tenantID := h.GetTenantID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		respondBadRequest(c, "Invalid channel ID")
		return
	}

	channel, err := h.notifSvc.GetChannel(ctx, tenantID, id)
	if err != nil {
		respondNotFound(c, "Channel not found")
		return
	}

	respondSuccess(c, gin.H{"success": true, "data": gin.H{"channel": channel}})
}

func (h *Handler) ToggleChannel(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "MonitorToggleChannel")
	defer span.End()
	tenantID := h.GetTenantID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		respondBadRequest(c, "Invalid channel ID")
		return
	}

	var body gin.H
	if err := c.ShouldBindJSON(&body); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	enabled := true
	if v, ok := body["enabled"]; ok && v != nil {
		if e, ok := v.(bool); ok {
			enabled = e
		}
	}

	channel, err := h.notifSvc.ToggleChannel(ctx, tenantID, id, enabled)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}

	respondSuccess(c, gin.H{"success": true, "data": gin.H{"channel": channel}})
}

func (h *Handler) DeleteChannel(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "MonitorDeleteChannel")
	defer span.End()
	tenantID := h.GetTenantID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		respondBadRequest(c, "Invalid channel ID")
		return
	}

	if err := h.notifSvc.DeleteChannel(ctx, tenantID, id); err != nil {
		respondNotFound(c, err.Error())
		return
	}

	respondSuccess(c, gin.H{"success": true, "message": "Channel deleted"})
}

// ==================== Escalation Policies ====================

func (h *Handler) CreateEscalationPolicy(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "MonitorCreateEscalationPolicy")
	defer span.End()
	tenantID := h.GetTenantID(c)

	var req models.CreateEscalationPolicyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	policy, err := h.notifSvc.CreateEscalationPolicy(ctx, tenantID, req)
	if err != nil {
		h.logger.Error("failed to create escalation policy", zap.Error(err))
		respondInternalError(c, "Failed to create escalation policy")
		return
	}

	respondCreated(c, gin.H{"success": true, "data": gin.H{"policy": policy}})
}

func (h *Handler) ListEscalationPolicies(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "MonitorListEscalationPolicies")
	defer span.End()
	tenantID := h.GetTenantID(c)

	resp, err := h.notifSvc.ListEscalationPolicies(ctx, tenantID)
	if err != nil {
		h.logger.Error("failed to list escalation policies", zap.Error(err))
		respondInternalError(c, "Failed to list escalation policies")
		return
	}

	respondSuccess(c, gin.H{"success": true, "data": gin.H{"policies": resp.Data}})
}

func (h *Handler) GetEscalationPolicy(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "MonitorGetEscalationPolicy")
	defer span.End()
	tenantID := h.GetTenantID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		respondBadRequest(c, "Invalid policy ID")
		return
	}

	policy, err := h.notifSvc.GetEscalationPolicy(ctx, tenantID, id)
	if err != nil {
		respondNotFound(c, "Escalation policy not found")
		return
	}

	respondSuccess(c, gin.H{"success": true, "data": gin.H{"policy": policy}})
}

// ==================== Notification History ====================

func (h *Handler) ListNotificationHistory(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "MonitorListNotificationHistory")
	defer span.End()
	tenantID := h.GetTenantID(c)

	var req models.NotificationHistoryQueryRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	resp, err := h.notifSvc.ListNotificationHistory(ctx, tenantID, req)
	if err != nil {
		h.logger.Error("failed to list notification history", zap.Error(err))
		respondInternalError(c, "Failed to list notification history")
		return
	}

	respondSuccess(c, gin.H{"success": true, "data": gin.H{"history": resp.Data}})
}

// ==================== Dashboard ====================

func (h *Handler) GetDashboard(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "MonitorGetDashboard")
	defer span.End()
	tenantID := h.GetTenantID(c)

	timeWindow := models.TimeWindow(c.Query("time_window"))
	if timeWindow == "" {
		timeWindow = models.TimeWindow1h
	}

	data, err := h.notifSvc.GetDashboardData(ctx, tenantID, timeWindow)
	if err != nil {
		h.logger.Error("failed to get dashboard data", zap.Error(err))
		respondInternalError(c, "Failed to get dashboard data")
		return
	}

	respondSuccess(c, gin.H{"success": true, "data": gin.H{"dashboard": data}})
}

func (h *Handler) CreateWidgetConfig(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "MonitorCreateWidgetConfig")
	defer span.End()
	tenantID := h.GetTenantID(c)

	var body gin.H
	if err := c.ShouldBindJSON(&body); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	title, ok := body["title"].(string)
	if !ok || title == "" {
		respondBadRequest(c, "Missing required field: title")
		return
	}

	metricsRaw, ok := body["metrics"].([]interface{})
	if !ok || len(metricsRaw) == 0 {
		respondBadRequest(c, "Missing required field: metrics (array)")
		return
	}
	var metrics []string
	for _, m := range metricsRaw {
		if s, ok := m.(string); ok {
			metrics = append(metrics, s)
		}
	}
	if len(metrics) == 0 {
		respondBadRequest(c, "metrics must contain at least one valid string")
		return
	}

	timeWindow := body["time_window"]
	if tw, ok := timeWindow.(string); !ok || tw == "" {
		timeWindow = "1h"
	}

	cfg, err := h.notifSvc.CreateWidgetConfig(ctx, tenantID, title, metrics, timeWindow.(string))
	if err != nil {
		respondInternalError(c, "Failed to create widget config")
		return
	}

	respondCreated(c, gin.H{"success": true, "data": gin.H{"widget": cfg}})
}

func (h *Handler) ListWidgetConfigs(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "MonitorListWidgetConfigs")
	defer span.End()
	tenantID := h.GetTenantID(c)

	widgets, err := h.notifSvc.ListWidgetConfigs(ctx, tenantID)
	if err != nil {
		respondInternalError(c, "Failed to list widget configs")
		return
	}

	respondSuccess(c, gin.H{"success": true, "data": gin.H{"widgets": widgets}})
}

func (h *Handler) DeleteWidgetConfig(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "MonitorDeleteWidgetConfig")
	defer span.End()
	tenantID := h.GetTenantID(c)

	widgetIDStr := c.Param("id")
	widgetID, err := uuid.Parse(widgetIDStr)
	if err != nil {
		respondBadRequest(c, "Invalid widget ID")
		return
	}

	if err := h.notifSvc.DeleteWidgetConfig(ctx, tenantID, widgetID); err != nil {
		respondInternalError(c, "Failed to delete widget config")
		return
	}

	respondSuccess(c, gin.H{"success": true, "message": "Widget config deleted"})
}

func (h *Handler) GetAggregatedMetrics(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "MonitorGetAggregatedMetrics")
	defer span.End()
	tenantID := h.GetTenantID(c)

	metricsParam := c.Query("metrics")
	if metricsParam == "" {
		respondBadRequest(c, "Missing required query param: metrics (comma-separated)")
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

	aggregated, err := h.notifSvc.GetAggregatedMetrics(ctx, tenantID, metrics, timeWindow)
	if err != nil {
		respondInternalError(c, "Failed to get aggregated metrics")
		return
	}

	respondSuccess(c, gin.H{"success": true, "data": gin.H{"aggregated": aggregated}})
}

// ==================== Anomalies ====================

func (h *Handler) DetectAnomalies(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "MonitorDetectAnomalies")
	defer span.End()
	tenantID := h.GetTenantID(c)

	metricName := c.Query("metric")
	if metricName == "" {
		respondBadRequest(c, "Missing required query param: metric")
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

	anomalies, err := h.notifSvc.DetectAnomalies(ctx, tenantID, metricName, timeWindow, threshold)
	if err != nil {
		respondInternalError(c, "Failed to detect anomalies")
		return
	}

	respondSuccess(c, gin.H{"success": true, "data": gin.H{"anomalies": anomalies, "count": len(anomalies)}})
}

func (h *Handler) GetAnomalySummary(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "MonitorGetAnomalySummary")
	defer span.End()
	// Return an empty summary for now
	respondSuccess(c, gin.H{"success": true, "data": gin.H{"summary": gin.H{
		"anomaly_count": 0,
		"total_metrics": 0,
		"last_updated":  time.Now(),
	}}})
}

func (h *Handler) GetAlertStats(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "MonitorGetAlertStats")
	defer span.End()
	tenantID := h.GetTenantID(c)

	// Count by status
	firingResp, _ := h.alertSvc.QueryAlerts(ctx, tenantID, models.AlertQueryRequest{Status: "firing"})
	ackResp, _ := h.alertSvc.QueryAlerts(ctx, tenantID, models.AlertQueryRequest{Status: "acknowledged"})
	silencedResp, _ := h.alertSvc.QueryAlerts(ctx, tenantID, models.AlertQueryRequest{Status: "silenced"})

	respondSuccess(c, gin.H{"success": true, "data": gin.H{"stats": gin.H{
		"firing":       len(firingResp.Data),
		"acknowledged": len(ackResp.Data),
		"silenced":     len(silencedResp.Data),
		"total":        len(firingResp.Data) + len(ackResp.Data) + len(silencedResp.Data),
	}}})
}
