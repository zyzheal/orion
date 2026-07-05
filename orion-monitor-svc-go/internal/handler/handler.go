package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/orion-platform/orion-monitor-svc-go/internal/models"
	"github.com/orion-platform/orion-monitor-svc-go/internal/service"
	"go.uber.org/zap"
)

type Handler struct {
	metricSvc *service.MetricService
	alertSvc  *service.AlertService
	logger    *zap.Logger
}

func New(metricSvc *service.MetricService, alertSvc *service.AlertService, logger *zap.Logger) *Handler {
	return &Handler{
		metricSvc: metricSvc,
		alertSvc:  alertSvc,
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
	traceID := c.Param("trace_id")

	traces, err := h.metricSvc.GetTraceDetail(c.Request.Context(), tenantID, traceID)
	if err != nil {
		h.logger.Error("failed to get trace detail", zap.String("traceId", traceID), zap.Error(err))
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

	c.JSON(http.StatusCreated, rule)
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

	c.JSON(http.StatusOK, rule)
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

	c.JSON(http.StatusOK, gin.H{"message": "Alert rule updated", "id": id.String()})
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

	c.JSON(http.StatusOK, gin.H{"message": "Alert rule deleted", "id": id.String()})
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
