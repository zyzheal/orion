package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/monitoring/models"
	"orion/platform-svc-go/internal/monitoring/service"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all monitoring endpoints.
// Mirrors /api/v1/monitoring routes from the TS source (36 endpoints).
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	m := rg.Group("/monitoring")

	// ==================== Service Control ====================

	// POST /monitoring/start
	m.POST("/start", auth.RequirePermission("monitoring", "write"), h.StartService)
	// POST /monitoring/stop
	m.POST("/stop", auth.RequirePermission("monitoring", "write"), h.StopService)
	// GET /monitoring/health
	m.GET("/health", h.HealthCheck)

	// ==================== Metrics ====================

	// POST /monitoring/metrics (record a data point)
	m.POST("/metrics", auth.RequirePermission("monitoring", "write"), h.RecordMetric)
	// POST /monitoring/metrics/register
	m.POST("/metrics/register", auth.RequirePermission("monitoring", "write"), h.RegisterMetric)
	// GET /monitoring/metrics
	m.GET("/metrics", auth.RequirePermission("monitoring", "read"), h.GetRegisteredMetrics)
	// GET /monitoring/metrics/:name/series
	m.GET("/metrics/:name/series", auth.RequirePermission("monitoring", "read"), h.GetMetricSeries)
	// GET /monitoring/metrics/:name/summary
	m.GET("/metrics/:name/summary", auth.RequirePermission("monitoring", "read"), h.GetMetricSummary)

	// ==================== Alert Rules ====================

	// POST /monitoring/rules
	m.POST("/rules", auth.RequirePermission("monitoring", "write"), h.CreateRule)
	// GET /monitoring/rules
	m.GET("/rules", auth.RequirePermission("monitoring", "read"), h.GetRules)
	// GET /monitoring/rules/:id
	m.GET("/rules/:id", auth.RequirePermission("monitoring", "read"), h.GetRule)
	// PUT /monitoring/rules/:id
	m.PUT("/rules/:id", auth.RequirePermission("monitoring", "write"), h.UpdateRule)
	// DELETE /monitoring/rules/:id
	m.DELETE("/rules/:id", auth.RequirePermission("monitoring", "delete"), h.DeleteRule)
	// PATCH /monitoring/rules/:id/toggle
	m.PATCH("/rules/:id/toggle", auth.RequirePermission("monitoring", "write"), h.ToggleRule)
	// POST /monitoring/rules/:id/suppress
	m.POST("/rules/:id/suppress", auth.RequirePermission("monitoring", "write"), h.SuppressRule)
	// POST /monitoring/rules/:id/unsuppress
	m.POST("/rules/:id/unsuppress", auth.RequirePermission("monitoring", "write"), h.UnsuppressRule)
	// POST /monitoring/rules/evaluate
	m.POST("/rules/evaluate", auth.RequirePermission("monitoring", "write"), h.EvaluateRules)

	// ==================== Alerts ====================

	// GET /monitoring/alerts
	m.GET("/alerts", auth.RequirePermission("monitoring", "read"), h.GetAlerts)
	// GET /monitoring/alerts/active
	m.GET("/alerts/active", auth.RequirePermission("monitoring", "read"), h.GetActiveAlerts)
	// GET /monitoring/alerts/:id
	m.GET("/alerts/:id", auth.RequirePermission("monitoring", "read"), h.GetAlert)
	// POST /monitoring/alerts/:id/acknowledge
	m.POST("/alerts/:id/acknowledge", auth.RequirePermission("monitoring", "write"), h.AcknowledgeAlert)
	// POST /monitoring/alerts/:id/resolve
	m.POST("/alerts/:id/resolve", auth.RequirePermission("monitoring", "write"), h.ResolveAlert)
	// POST /monitoring/alerts/:id/escalate
	m.POST("/alerts/:id/escalate", auth.RequirePermission("monitoring", "write"), h.EscalateAlert)

	// ==================== Notification Channels ====================

	// POST /monitoring/channels
	m.POST("/channels", auth.RequirePermission("monitoring", "write"), h.CreateChannel)
	// GET /monitoring/channels
	m.GET("/channels", auth.RequirePermission("monitoring", "read"), h.GetChannels)
	// PATCH /monitoring/channels/:id/toggle
	m.PATCH("/channels/:id/toggle", auth.RequirePermission("monitoring", "write"), h.ToggleChannel)

	// ==================== Escalation Policies ====================

	// POST /monitoring/escalation
	m.POST("/escalation", auth.RequirePermission("monitoring", "write"), h.CreateEscalationPolicy)
	// GET /monitoring/escalation
	m.GET("/escalation", auth.RequirePermission("monitoring", "read"), h.GetEscalationPolicies)

	// ==================== Notification History ====================

	// GET /monitoring/notifications
	m.GET("/notifications", auth.RequirePermission("monitoring", "read"), h.GetNotificationHistory)

	// ==================== Dashboard ====================

	// GET /monitoring/dashboard
	m.GET("/dashboard", auth.RequirePermission("monitoring", "read"), h.GetDashboard)
	// POST /monitoring/dashboard/widgets
	m.POST("/dashboard/widgets", auth.RequirePermission("monitoring", "write"), h.AddWidgetConfig)
	// GET /monitoring/dashboard/widgets
	m.GET("/dashboard/widgets", auth.RequirePermission("monitoring", "read"), h.GetWidgetConfigs)
	// GET /monitoring/dashboard/aggregated
	m.GET("/dashboard/aggregated", auth.RequirePermission("monitoring", "read"), h.GetAggregatedMetrics)

	// ==================== Anomalies ====================

	// GET /monitoring/anomalies
	m.GET("/anomalies", auth.RequirePermission("monitoring", "read"), h.DetectAnomalies)
	// GET /monitoring/anomalies/summary
	m.GET("/anomalies/summary", auth.RequirePermission("monitoring", "read"), h.GetAnomalySummary)

	// ==================== Collect ====================

	// POST /monitoring/collect
	m.POST("/collect", auth.RequirePermission("monitoring", "write"), h.CollectSystemMetrics)
}

// ==================== Service Control ====================

func (h *Handler) StartService(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	result, err := h.svc.StartService(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, result)
}

func (h *Handler) StopService(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	result, err := h.svc.StopService(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, result)
}

func (h *Handler) HealthCheck(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	result, err := h.svc.HealthCheck(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, result)
}

// ==================== Metrics ====================

func (h *Handler) RecordMetric(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.RecordMetricRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	if err := h.svc.RecordMetric(c.Request.Context(), tenantID, req); err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "metric recorded"})
}

func (h *Handler) RegisterMetric(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateMetricRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	m, err := h.svc.CreateMetric(c.Request.Context(), tenantID, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, m)
}

func (h *Handler) GetRegisteredMetrics(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	items, err := h.svc.GetRegisteredMetrics(c.Request.Context(), tenantID, limit, offset)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

func (h *Handler) GetMetricSeries(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	name := c.Param("name")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "100"))
	series, err := h.svc.GetMetricSeries(c.Request.Context(), tenantID, name, nil, nil, limit)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, series)
}

func (h *Handler) GetMetricSummary(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	name := c.Param("name")
	summary, err := h.svc.GetMetricSummary(c.Request.Context(), tenantID, name, nil, nil)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, summary)
}

// ==================== Alert Rules ====================

func (h *Handler) CreateRule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	rule, err := h.svc.CreateRule(c.Request.Context(), tenantID, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, rule)
}

func (h *Handler) GetRules(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	items, err := h.svc.GetRules(c.Request.Context(), tenantID, limit, offset)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

func (h *Handler) GetRule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	rule, err := h.svc.GetRule(c.Request.Context(), tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, "rule not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, rule)
}

func (h *Handler) UpdateRule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	rule, err := h.svc.UpdateRule(c.Request.Context(), tenantID, id, req)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, "rule not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, rule)
}

func (h *Handler) DeleteRule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.DeleteRule(c.Request.Context(), tenantID, id); err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "rule deleted"})
}

func (h *Handler) ToggleRule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.ToggleRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	rule, err := h.svc.ToggleRule(c.Request.Context(), tenantID, id, req.Enabled)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, rule)
}

func (h *Handler) SuppressRule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.SuppressRuleRequest
	c.ShouldBindJSON(&req)
	rule, err := h.svc.SuppressRule(c.Request.Context(), tenantID, id, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, rule)
}

func (h *Handler) UnsuppressRule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	rule, err := h.svc.UnsuppressRule(c.Request.Context(), tenantID, id)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, rule)
}

func (h *Handler) EvaluateRules(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.EvaluateRulesRequest
	c.ShouldBindJSON(&req)
	result, err := h.svc.EvaluateRules(c.Request.Context(), tenantID, req.RuleIDs)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, result)
}

// ==================== Alerts ====================

func (h *Handler) GetAlerts(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	items, err := h.svc.GetAlerts(c.Request.Context(), tenantID, limit, offset)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

func (h *Handler) GetActiveAlerts(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	items, err := h.svc.GetActiveAlerts(c.Request.Context(), tenantID, limit, offset)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

func (h *Handler) GetAlert(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	alert, err := h.svc.GetAlert(c.Request.Context(), tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, "alert not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, alert)
}

func (h *Handler) AcknowledgeAlert(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	ackBy := c.GetString("user_id")
	var req models.AcknowledgeAlertRequest
	c.ShouldBindJSON(&req)
	alert, err := h.svc.AcknowledgeAlert(c.Request.Context(), tenantID, id, ackBy, req.Comment)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, alert)
}

func (h *Handler) ResolveAlert(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.ResolveAlertRequest
	c.ShouldBindJSON(&req)
	alert, err := h.svc.ResolveAlert(c.Request.Context(), tenantID, id, req.Comment)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, alert)
}

func (h *Handler) EscalateAlert(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.EscalateAlertRequest
	c.ShouldBindJSON(&req)
	alert, err := h.svc.EscalateAlert(c.Request.Context(), tenantID, id, req.Comment)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, alert)
}

// ==================== Notification Channels ====================

func (h *Handler) CreateChannel(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateChannelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	ch, err := h.svc.CreateChannel(c.Request.Context(), tenantID, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, ch)
}

func (h *Handler) GetChannels(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	items, err := h.svc.GetChannels(c.Request.Context(), tenantID, limit, offset)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

func (h *Handler) ToggleChannel(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.ToggleChannelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	ch, err := h.svc.ToggleChannel(c.Request.Context(), tenantID, id, req.Enabled)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, ch)
}

// ==================== Escalation Policies ====================

func (h *Handler) CreateEscalationPolicy(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateEscalationPolicyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	ep, err := h.svc.CreateEscalationPolicy(c.Request.Context(), tenantID, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, ep)
}

func (h *Handler) GetEscalationPolicies(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	items, err := h.svc.GetEscalationPolicies(c.Request.Context(), tenantID, limit, offset)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

// ==================== Notification History ====================

func (h *Handler) GetNotificationHistory(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	items, err := h.svc.GetNotificationHistory(c.Request.Context(), tenantID, limit, offset)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

// ==================== Dashboard ====================

func (h *Handler) GetDashboard(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	dash, err := h.svc.GetDashboard(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, dash)
}

func (h *Handler) AddWidgetConfig(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.AddWidgetConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	w, err := h.svc.AddWidgetConfig(c.Request.Context(), tenantID, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, w)
}

func (h *Handler) GetWidgetConfigs(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	items, err := h.svc.GetWidgetConfigs(c.Request.Context(), tenantID, limit, offset)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

func (h *Handler) GetAggregatedMetrics(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	aggregated, err := h.svc.GetAggregatedMetrics(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, aggregated)
}

// ==================== Anomalies ====================

func (h *Handler) DetectAnomalies(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	items, err := h.svc.DetectAnomalies(c.Request.Context(), tenantID, limit, offset)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

func (h *Handler) GetAnomalySummary(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	summary, err := h.svc.GetAnomalySummary(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, summary)
}

// ==================== Collect ====================

func (h *Handler) CollectSystemMetrics(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CollectSystemMetricsRequest
	c.ShouldBindJSON(&req)
	sm, err := h.svc.CollectSystemMetrics(c.Request.Context(), tenantID, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, sm)
}
