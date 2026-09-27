package handler

import (
	"context"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"

	"orion/go-common/pkg/auth"

	"orion/platform-svc-go/internal/pagination"
	"orion/platform-svc-go/internal/visor/models"
	"orion/platform-svc-go/internal/visor/service"
)

// Service defines the methods the handler calls on the service layer. Keeping
// it here rather than in the service package lets the handler be tested with a
// fake and keeps the wiring source-compatible: *service.Service already
// satisfies it.
type Service interface {
	// Dashboards
	CreateDashboard(ctx context.Context, tenantID string, req *models.CreateDashboardRequest) (*models.Dashboard, error)
	ListDashboards(ctx context.Context, tenantID string, offset, limit int) ([]models.Dashboard, error)
	GetDashboard(ctx context.Context, tenantID, id string) (*models.Dashboard, error)
	UpdateDashboard(ctx context.Context, tenantID, id string, req *models.UpdateDashboardRequest) (*models.Dashboard, error)
	DeleteDashboard(ctx context.Context, tenantID, id string) error
	CountDashboards(ctx context.Context, tenantID string) (int, error)

	// Monitor hosts
	CreateHost(ctx context.Context, tenantID string, req *models.CreateHostRequest) (*models.MonitorHost, error)
	ListHosts(ctx context.Context, tenantID string, offset, limit int) ([]models.MonitorHost, error)
	GetHost(ctx context.Context, tenantID, id string) (*models.MonitorHost, error)
	UpdateHost(ctx context.Context, tenantID, id string, req *models.UpdateHostRequest) (*models.MonitorHost, error)
	DeleteHost(ctx context.Context, tenantID, id string) error
	CountHosts(ctx context.Context, tenantID string) (int, error)
	GetHostStatusSummary(ctx context.Context, tenantID string) (map[string]int, error)
	Heartbeat(ctx context.Context, tenantID, hostID string) error

	// Alert rules
	CreateAlertRule(ctx context.Context, tenantID string, req *models.CreateAlertRuleRequest) (*models.AlertRule, error)
	ListAlertRules(ctx context.Context, tenantID string) ([]models.AlertRule, error)
	GetAlertRule(ctx context.Context, tenantID, id string) (*models.AlertRule, error)
	UpdateAlertRule(ctx context.Context, tenantID, id string, req *models.UpdateAlertRuleRequest) (*models.AlertRule, error)
	DeleteAlertRule(ctx context.Context, tenantID, id string) error
	ToggleAlertRule(ctx context.Context, tenantID, id string, enabled bool) (*models.AlertRule, error)

	// Alert instances
	ListAlerts(ctx context.Context, tenantID, status, severity string, offset, limit int) ([]models.AlertInstance, int, error)
	GetAlert(ctx context.Context, tenantID, id string) (*models.AlertInstance, error)
	AcknowledgeAlert(ctx context.Context, tenantID, id, userID string) (*models.AlertInstance, error)
	ResolveAlert(ctx context.Context, tenantID, id string) (*models.AlertInstance, error)
	GetAlertStats(ctx context.Context, tenantID string) (*models.AlertStats, error)

	// Metrics
	RecordMetric(ctx context.Context, tenantID string, req *models.RecordMetricRequest) error
	QueryMetricSeries(ctx context.Context, tenantID, metricName string, start, end time.Time, maxPoints int) ([]models.MetricDataPoint, error)
	GetLatestMetricValue(ctx context.Context, tenantID, metricName string) (*float64, error)
	GetMetricSummary(ctx context.Context, tenantID, metricName string, windowMs int64) (*service.MetricAggregation, error)
	DetectAnomalies(ctx context.Context, tenantID, metricName string, windowMs int64, threshold float64) ([]service.AnomalyResult, error)

	// Rule evaluation
	EvaluateRules(ctx context.Context, tenantID string) ([]models.AlertInstance, error)

	// Notification channels
	CreateChannel(ctx context.Context, tenantID string, req *models.CreateChannelRequest) (*models.NotificationChannel, error)
	ListChannels(ctx context.Context, tenantID string) ([]models.NotificationChannel, error)
	ToggleChannel(ctx context.Context, tenantID, id string, enabled bool) error
	DeleteChannel(ctx context.Context, tenantID, id string) error

	// Notification history
	ListNotificationHistory(ctx context.Context, tenantID, alertID string, limit int) ([]models.NotificationHistory, error)

	// Send notification
	SendNotification(ctx context.Context, tenantID, alertID string, channelIDs []string) ([]models.NotificationHistory, error)
}

// The concrete service satisfies the interface. If the service ever drops a
// method or renames a parameter, this fails the build rather than the wiring.
var _ Service = (*service.Service)(nil)

// Handler exposes HTTP endpoints for the visor service.
type Handler struct {
	svc Service
}

// NewHandler creates a new Handler backed by the given Service.
func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all visor API routes under the given router group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	// Dashboards
	dash := rg.Group("/dashboards")
	dash.POST("", auth.RequirePermission("visor", "write"), h.CreateDashboard)
	dash.GET("", auth.RequirePermission("visor", "read"), h.ListDashboards)
	dash.GET("/count", auth.RequirePermission("visor", "read"), h.CountDashboards)
	dash.GET("/:id", auth.RequirePermission("visor", "read"), h.GetDashboard)
	dash.PUT("/:id", auth.RequirePermission("visor", "write"), h.UpdateDashboard)
	dash.DELETE("/:id", auth.RequirePermission("visor", "delete"), h.DeleteDashboard)

	// Monitor Hosts
	hosts := rg.Group("/hosts")
	hosts.POST("", auth.RequirePermission("visor", "write"), h.CreateHost)
	hosts.GET("", auth.RequirePermission("visor", "read"), h.ListHosts)
	hosts.GET("/count", auth.RequirePermission("visor", "read"), h.CountHosts)
	hosts.GET("/status", auth.RequirePermission("visor", "read"), h.HostStatusSummary)
	hosts.GET("/:id", auth.RequirePermission("visor", "read"), h.GetHost)
	hosts.PUT("/:id", auth.RequirePermission("visor", "write"), h.UpdateHost)
	hosts.DELETE("/:id", auth.RequirePermission("visor", "delete"), h.DeleteHost)
	hosts.POST("/:id/heartbeat", auth.RequirePermission("visor", "write"), h.HostHeartbeat)

	// Alert Rules
	rules := rg.Group("/alert-rules")
	rules.POST("", auth.RequirePermission("visor", "write"), h.CreateAlertRule)
	rules.GET("", auth.RequirePermission("visor", "read"), h.ListAlertRules)
	rules.GET("/:id", auth.RequirePermission("visor", "read"), h.GetAlertRule)
	rules.PUT("/:id", auth.RequirePermission("visor", "write"), h.UpdateAlertRule)
	rules.DELETE("/:id", auth.RequirePermission("visor", "delete"), h.DeleteAlertRule)
	rules.PATCH("/:id/toggle", auth.RequirePermission("visor", "write"), h.ToggleAlertRule)

	// Alert Instances
	alerts := rg.Group("/alerts")
	alerts.GET("", auth.RequirePermission("visor", "read"), h.ListAlerts)
	alerts.GET("/stats", auth.RequirePermission("visor", "read"), h.AlertStats)
	alerts.GET("/:id", auth.RequirePermission("visor", "read"), h.GetAlert)
	alerts.POST("/:id/acknowledge", auth.RequirePermission("visor", "execute"), h.AcknowledgeAlert)
	alerts.POST("/:id/resolve", auth.RequirePermission("visor", "execute"), h.ResolveAlert)

	// Metrics
	metrics := rg.Group("/metrics")
	metrics.GET("/:id/series", auth.RequirePermission("visor", "read"), h.QueryMetricSeries)
	metrics.GET("/:id/latest", auth.RequirePermission("visor", "read"), h.GetLatestMetricValue)
	metrics.GET("/:id/summary", auth.RequirePermission("visor", "read"), h.GetMetricSummary)
	metrics.GET("/:id/anomalies", auth.RequirePermission("visor", "read"), h.DetectAnomalies)

	// Rule evaluation
	rg.POST("/evaluate-rules", auth.RequirePermission("visor", "write"), h.EvaluateRules)

	// Notification channels
	channels := rg.Group("/notification-channels")
	channels.POST("", auth.RequirePermission("visor", "write"), h.CreateChannel)
	channels.GET("", auth.RequirePermission("visor", "read"), h.ListChannels)
	channels.PATCH("/:id/toggle", auth.RequirePermission("visor", "write"), h.ToggleChannel)
	channels.DELETE("/:id", auth.RequirePermission("visor", "delete"), h.DeleteChannel)

	// Notification history
	rg.GET("/notification-history", auth.RequirePermission("visor", "read"), h.ListNotificationHistory)

	// Send notification
	rg.POST("/alerts/:id/notify", auth.RequirePermission("visor", "write"), h.SendNotification)
}

// ==================== Dashboard Handlers ====================

func (h *Handler) CreateDashboard(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "VisorCreateDashboard")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateDashboardRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	d, err := h.svc.CreateDashboard(ctx, tenantID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, d)
}

func (h *Handler) ListDashboards(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "VisorListDashboards")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	page := pagination.Page(c.Query("page"), 1)
	ps := pagination.Limit(c.Query("page_size"), 20)
	// The cap must land before the offset is derived: deriving from the
	// requested size and capping the limit afterwards makes
	// page=3&page_size=1000 return rows 2001-2100 while every reader of the
	// URL expects rows 201-300.
	//
	// These three handlers used to read both params with a bare strconv.Atoi,
	// so page=-5, page=0 and page=abc each reached Postgres as a negative
	// OFFSET - an error instead of a page, turning a GET into a 500. page=abc
	// was the worst of them: one mistyped character, Atoi returning 0 and
	// throwing its error away. Nothing in the handler capped the size either,
	// so page_size=100000 went straight into LIMIT.
	//
	// The sharpest one was ListAlerts below: it divides total by ps to build
	// total_pages, and a bare Atoi leaves ps at 0 for page_size=0, so
	// ?page_size=0 did not return a 500 - it divided by zero and panicked.
	//
	// The module already has a helper shaped exactly like this:
	// models.PaginatedRequest owns the same two floors and the same 100 cap.
	// It is dead code - zero production callers and zero tests - and its
	// Offset derives before Limit caps, so it would have answered
	// page=3&page_size=250 with offset 500 and limit 100. It was not worth
	// routing three call sites through a field on a request struct to reuse
	// it, so the arithmetic stays here. The cap below is that same 100.
	if ps > 100 {
		ps = 100
	}
	offset := pagination.OffsetFromPage(page, ps)
	limit := ps

	items, err := h.svc.ListDashboards(ctx, tenantID, offset, limit)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	if items == nil {
		items = []models.Dashboard{}
	}
	respondSuccess(c, items)
}

func (h *Handler) GetDashboard(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "VisorGetDashboard")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	d, err := h.svc.GetDashboard(ctx, tenantID, c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, d)
}

func (h *Handler) UpdateDashboard(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "VisorUpdateDashboard")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.UpdateDashboardRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	d, err := h.svc.UpdateDashboard(ctx, tenantID, c.Param("id"), &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, d)
}

func (h *Handler) DeleteDashboard(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "VisorDeleteDashboard")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if err := h.svc.DeleteDashboard(ctx, tenantID, c.Param("id")); err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "deleted"})
}

func (h *Handler) CountDashboards(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "VisorCountDashboards")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	count, err := h.svc.CountDashboards(ctx, tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"count": count})
}

// ==================== Monitor Host Handlers ====================

func (h *Handler) CreateHost(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "VisorCreateHost")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateHostRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	host, err := h.svc.CreateHost(ctx, tenantID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, host)
}

func (h *Handler) ListHosts(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "VisorListHosts")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	page := pagination.Page(c.Query("page"), 1)
	ps := pagination.Limit(c.Query("page_size"), 20)
	// Same floors and cap as ListDashboards, and the cap before the derivation:
	// the three list endpoints share the pagination package for this reason.
	if ps > 100 {
		ps = 100
	}
	offset := pagination.OffsetFromPage(page, ps)
	limit := ps

	items, err := h.svc.ListHosts(ctx, tenantID, offset, limit)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	if items == nil {
		items = []models.MonitorHost{}
	}
	respondSuccess(c, items)
}

func (h *Handler) GetHost(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "VisorGetHost")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	host, err := h.svc.GetHost(ctx, tenantID, c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, host)
}

func (h *Handler) UpdateHost(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "VisorUpdateHost")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.UpdateHostRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	host, err := h.svc.UpdateHost(ctx, tenantID, c.Param("id"), &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, host)
}

func (h *Handler) DeleteHost(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "VisorDeleteHost")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if err := h.svc.DeleteHost(ctx, tenantID, c.Param("id")); err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "deleted"})
}

func (h *Handler) CountHosts(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "VisorCountHosts")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	count, err := h.svc.CountHosts(ctx, tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"count": count})
}

func (h *Handler) HostStatusSummary(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "VisorHostStatusSummary")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	summary, err := h.svc.GetHostStatusSummary(ctx, tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, summary)
}

func (h *Handler) HostHeartbeat(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "VisorHostHeartbeat")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if err := h.svc.Heartbeat(ctx, tenantID, c.Param("id")); err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "heartbeat recorded"})
}

// ==================== Alert Rule Handlers ====================

func (h *Handler) CreateAlertRule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "VisorCreateAlertRule")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateAlertRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	rule, err := h.svc.CreateAlertRule(ctx, tenantID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, rule)
}

func (h *Handler) ListAlertRules(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "VisorListAlertRules")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.ListAlertRules(ctx, tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

func (h *Handler) GetAlertRule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "VisorGetAlertRule")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	rule, err := h.svc.GetAlertRule(ctx, tenantID, c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, rule)
}

func (h *Handler) UpdateAlertRule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "VisorUpdateAlertRule")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.UpdateAlertRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	rule, err := h.svc.UpdateAlertRule(ctx, tenantID, c.Param("id"), &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, rule)
}

func (h *Handler) DeleteAlertRule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "VisorDeleteAlertRule")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if err := h.svc.DeleteAlertRule(ctx, tenantID, c.Param("id")); err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "deleted"})
}

func (h *Handler) ToggleAlertRule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "VisorToggleAlertRule")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req struct {
		Enabled bool `json:"enabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	rule, err := h.svc.ToggleAlertRule(ctx, tenantID, c.Param("id"), req.Enabled)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, rule)
}

// ==================== Alert Instance Handlers ====================

func (h *Handler) ListAlerts(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "VisorListAlerts")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	status := c.Query("status")
	severity := c.Query("severity")
	page := pagination.Page(c.Query("page"), 1)
	ps := pagination.Limit(c.Query("page_size"), 20)
	// Same floors and cap as ListDashboards, and the cap before the derivation:
	// the three list endpoints share the pagination package for this reason.
	//
	// This handler is the one that owns a paginated envelope, so it also has to
	// keep the envelope honest. page_size used to reach the envelope raw, so
	// the query could fetch a different window than the response reported, and
	// total_pages was derived from the uncapped size. Floor and cap land here,
	// once, and everything downstream - the service call, page_size and
	// total_pages - reuses the same two values.
	if ps > 100 {
		ps = 100
	}
	offset := pagination.OffsetFromPage(page, ps)
	limit := ps

	items, total, err := h.svc.ListAlerts(ctx, tenantID, status, severity, offset, limit)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	if items == nil {
		items = []models.AlertInstance{}
	}
	// limit is already floored by pagination.Limit, so this division cannot
	// divide by zero. limit was 0 for page_size=0 before the floor existed.
	totalPages := total / limit
	if total%limit > 0 {
		totalPages++
	}
	respondSuccess(c, models.PaginatedResult{
		Data:       items,
		Total:      total,
		Page:       page,
		PageSize:   limit,
		TotalPages: totalPages,
	})
}

func (h *Handler) GetAlert(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "VisorGetAlert")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	alert, err := h.svc.GetAlert(ctx, tenantID, c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, alert)
}

func (h *Handler) AcknowledgeAlert(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "VisorAcknowledgeAlert")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	if userID == "" {
		userID = "anonymous"
	}
	alert, err := h.svc.AcknowledgeAlert(ctx, tenantID, c.Param("id"), userID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, alert)
}

func (h *Handler) ResolveAlert(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "VisorResolveAlert")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	alert, err := h.svc.ResolveAlert(ctx, tenantID, c.Param("id"))
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, alert)
}

func (h *Handler) AlertStats(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "VisorAlertStats")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	stats, err := h.svc.GetAlertStats(ctx, tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, stats)
}

// ==================== Metric Handlers ====================

func (h *Handler) RecordMetric(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "VisorRecordMetric")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.RecordMetricRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	if err := h.svc.RecordMetric(ctx, tenantID, &req); err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, gin.H{"message": "recorded"})
}

func (h *Handler) QueryMetricSeries(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "VisorQueryMetricSeries")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	metricName := c.Param("id")
	startStr := c.DefaultQuery("start", time.Now().Add(-1*time.Hour).Format(time.RFC3339))
	endStr := c.DefaultQuery("end", time.Now().Format(time.RFC3339))
	maxPoints, _ := strconv.Atoi(c.DefaultQuery("max_points", "500"))

	start, err := time.Parse(time.RFC3339, startStr)
	if err != nil {
		respondBadRequest(c, "invalid start time")
		return
	}
	end, err := time.Parse(time.RFC3339, endStr)
	if err != nil {
		respondBadRequest(c, "invalid end time")
		return
	}

	points, err := h.svc.QueryMetricSeries(ctx, tenantID, metricName, start, end, maxPoints)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, points)
}

func (h *Handler) GetLatestMetricValue(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "VisorGetLatestMetricValue")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	val, err := h.svc.GetLatestMetricValue(ctx, tenantID, c.Param("id"))
	if err != nil {
		respondNotFound(c, "no data")
		return
	}
	respondSuccess(c, gin.H{"value": val})
}

func (h *Handler) GetMetricSummary(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "VisorGetMetricSummary")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	metricName := c.Param("id")
	windowMs, _ := strconv.ParseInt(c.DefaultQuery("window_ms", "3600000"), 10, 64)

	summary, err := h.svc.GetMetricSummary(ctx, tenantID, metricName, windowMs)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, summary)
}

func (h *Handler) DetectAnomalies(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "VisorDetectAnomalies")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	metricName := c.Param("id")
	windowMs, _ := strconv.ParseInt(c.DefaultQuery("window_ms", "3600000"), 10, 64)
	threshold, _ := strconv.ParseFloat(c.DefaultQuery("threshold", "2.5"), 64)

	anomalies, err := h.svc.DetectAnomalies(ctx, tenantID, metricName, windowMs, threshold)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, anomalies)
}

// ==================== Rule Evaluation ====================

func (h *Handler) EvaluateRules(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "VisorEvaluateRules")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	alerts, err := h.svc.EvaluateRules(ctx, tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"triggered": len(alerts), "alerts": alerts})
}

// ==================== Notification Channel Handlers ====================

func (h *Handler) CreateChannel(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "VisorCreateChannel")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateChannelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	ch, err := h.svc.CreateChannel(ctx, tenantID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, ch)
}

func (h *Handler) ListChannels(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "VisorListChannels")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.ListChannels(ctx, tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

func (h *Handler) ToggleChannel(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "VisorToggleChannel")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req struct {
		Enabled bool `json:"enabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	if err := h.svc.ToggleChannel(ctx, tenantID, c.Param("id"), req.Enabled); err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "toggled"})
}

func (h *Handler) DeleteChannel(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "VisorDeleteChannel")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if err := h.svc.DeleteChannel(ctx, tenantID, c.Param("id")); err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "deleted"})
}

// ==================== Notification History ====================

func (h *Handler) ListNotificationHistory(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "VisorListNotificationHistory")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	alertID := c.Query("alert_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))

	items, err := h.svc.ListNotificationHistory(ctx, tenantID, alertID, limit)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

func (h *Handler) SendNotification(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "VisorSendNotification")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req struct {
		ChannelIDs []string `json:"channel_ids" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	records, err := h.svc.SendNotification(ctx, tenantID, c.Param("id"), req.ChannelIDs)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, records)
}
