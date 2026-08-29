package handler

import (
	"go.opentelemetry.io/otel"
	"net/http"
	"strconv"

	"orion/platform-svc-go/internal/infrastructure/middleware-ops/models"
	"orion/platform-svc-go/internal/infrastructure/middleware-ops/service"

	"orion/go-common/pkg/auth"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes mounts all middleware-ops endpoints under the given group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	m := rg.Group("/middleware")

	// Instance CRUD
	m.POST("/instances", auth.RequirePermission("middleware_ops", "write"), h.CreateInstance)
	m.GET("/instances", auth.RequirePermission("middleware_ops", "read"), h.ListInstances)
	m.GET("/instances/:id", auth.RequirePermission("middleware_ops", "read"), h.GetInstance)
	m.PUT("/instances/:id", auth.RequirePermission("middleware_ops", "write"), h.UpdateInstance)
	m.DELETE("/instances/:id", auth.RequirePermission("middleware_ops", "delete"), h.DeleteInstance)
	m.GET("/count", auth.RequirePermission("middleware_ops", "read"), h.Count)

	// Backups
	m.POST("/backups", auth.RequirePermission("middleware_ops", "execute"), h.CreateBackup)
	m.GET("/instances/:id/backups", auth.RequirePermission("middleware_ops", "read"), h.ListBackups)

	// Metrics
	m.POST("/metrics", auth.RequirePermission("middleware_ops", "write"), h.RecordMetric)
	m.GET("/metrics", auth.RequirePermission("middleware_ops", "read"), h.ListMetrics)

	// Connection Pools
	m.POST("/connection-pools", auth.RequirePermission("middleware_ops", "write"), h.RecordConnectionPool)
	m.GET("/connection-pools", auth.RequirePermission("middleware_ops", "read"), h.ListConnectionPools)

	// Message Queue Stats
	m.POST("/mq-stats", auth.RequirePermission("middleware_ops", "write"), h.RecordMqStats)
	m.GET("/mq-stats", auth.RequirePermission("middleware_ops", "read"), h.ListMqStats)

	// Alerts
	m.GET("/alerts", auth.RequirePermission("middleware_ops", "read"), h.ListAlerts)
	m.DELETE("/alerts/:id", auth.RequirePermission("middleware_ops", "delete"), h.DeleteAlert)

	// Health Summary
	m.GET("/health-summary", auth.RequirePermission("middleware_ops", "read"), h.HealthSummary)
}

// ---- Instance handlers ----

func (h *Handler) CreateInstance(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraMiddlewareOpsCreateInstance")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateInstanceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	item, err := h.svc.CreateInstance(ctx, tenantID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, item)
}

func (h *Handler) ListInstances(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraMiddlewareOpsListInstances")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	ps, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	typeFilter := c.Query("type")
	statusFilter := c.Query("status")
	items, err := h.svc.ListInstances(ctx, tenantID, (page-1)*ps, ps, typeFilter, statusFilter)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

func (h *Handler) GetInstance(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraMiddlewareOpsGetInstance")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	item, err := h.svc.GetInstance(ctx, tenantID, c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, item)
}

func (h *Handler) UpdateInstance(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraMiddlewareOpsUpdateInstance")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateInstanceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	item, err := h.svc.UpdateInstance(ctx, tenantID, c.Param("id"), &req)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, item)
}

func (h *Handler) DeleteInstance(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraMiddlewareOpsDeleteInstance")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if err := h.svc.DeleteInstance(ctx, tenantID, c.Param("id")); err != nil {
		respondNotFound(c, err.Error())
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *Handler) Count(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraMiddlewareOpsCount")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	count, err := h.svc.Count(ctx, tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"count": count})
}

// ---- Backup handlers ----

func (h *Handler) CreateBackup(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraMiddlewareOpsCreateBackup")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateBackupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	item, err := h.svc.CreateBackup(ctx, tenantID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, item)
}

func (h *Handler) ListBackups(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraMiddlewareOpsListBackups")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.ListBackupsByInstance(ctx, tenantID, c.Param("id"))
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

// ---- Metric handlers ----

func (h *Handler) RecordMetric(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraMiddlewareOpsRecordMetric")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateMetricRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	item, err := h.svc.RecordMetric(ctx, tenantID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, item)
}

func (h *Handler) ListMetrics(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraMiddlewareOpsListMetrics")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	ps, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	middlewareID := c.Query("middleware_id")
	metricName := c.Query("metric_name")
	items, err := h.svc.ListMetrics(ctx, tenantID, (page-1)*ps, ps, middlewareID, metricName)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

// ---- Connection Pool handlers ----

func (h *Handler) RecordConnectionPool(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraMiddlewareOpsRecordConnectionPool")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateConnectionPoolRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	item, err := h.svc.RecordConnectionPool(ctx, tenantID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, item)
}

func (h *Handler) ListConnectionPools(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraMiddlewareOpsListConnectionPools")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	ps, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	middlewareID := c.Query("middleware_id")
	items, err := h.svc.ListConnectionPools(ctx, tenantID, (page-1)*ps, ps, middlewareID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

// ---- Message Queue Stats handlers ----

func (h *Handler) RecordMqStats(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraMiddlewareOpsRecordMqStats")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateMqStatsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	item, err := h.svc.RecordMqStats(ctx, tenantID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, item)
}

func (h *Handler) ListMqStats(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraMiddlewareOpsListMqStats")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	ps, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	middlewareID := c.Query("middleware_id")
	items, err := h.svc.ListMqStats(ctx, tenantID, (page-1)*ps, ps, middlewareID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

// ---- Alert handlers ----

func (h *Handler) ListAlerts(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraMiddlewareOpsListAlerts")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	ps, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	severity := c.Query("severity")
	alertType := c.Query("alert_type")
	items, err := h.svc.ListAlerts(ctx, tenantID, (page-1)*ps, ps, severity, alertType)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

func (h *Handler) DeleteAlert(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraMiddlewareOpsDeleteAlert")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if err := h.svc.DeleteAlert(ctx, tenantID, c.Param("id")); err != nil {
		respondNotFound(c, err.Error())
		return
	}
	c.Status(http.StatusNoContent)
}

// ---- Health Summary handler ----

func (h *Handler) HealthSummary(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraMiddlewareOpsHealthSummary")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	summary, err := h.svc.GetHealthSummary(ctx, tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, summary)
}
