package handler

import (
	"net/http"

	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/errors"
	"orion/platform-svc-go/internal/observability/models"
	"orion/platform-svc-go/internal/observability/service"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel/trace"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	r := rg.Group("/observability")
	r.POST("/metrics", auth.RequirePermission("observability", "write"), h.RecordMetric)
	r.GET("/metrics", auth.RequirePermission("observability", "read"), h.ListMetrics)
	r.GET("/metrics/:name", auth.RequirePermission("observability", "read"), h.GetMetric)
	r.POST("/alerts", auth.RequirePermission("observability", "write"), h.CreateAlert)
	r.GET("/alerts", auth.RequirePermission("observability", "read"), h.ListAlerts)
}

func (h *Handler) RecordMetric(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RecordMetric")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx := ctx
	var m models.Metric
	if err := c.ShouldBindJSON(&m); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, "invalid request", http.StatusBadRequest)
		return
	}
	result, err := h.svc.RecordMetric(ctx, tenantID, &m)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, result)
}

func (h *Handler) ListMetrics(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListMetrics")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx := ctx
	q := models.MetricQuery{
		Name:      c.Query("name"),
		From:      c.Query("from"),
		To:        c.Query("to"),
		Aggregate: c.Query("aggregate"),
	}
	metrics, err := h.svc.ListMetrics(ctx, tenantID, q)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"data": metrics, "total": len(metrics)})
}

func (h *Handler) GetMetric(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetMetric")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx := ctx
	m, err := h.svc.GetMetric(ctx, tenantID, c.Param("name"))
	if err != nil {
		errors.WriteError(c, errors.ErrNotFound, "metric not found", http.StatusNotFound)
		return
	}
	errors.WriteSuccess(c, m)
}

func (h *Handler) CreateAlert(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateAlert")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx := ctx
	var rule models.AlertRule
	if err := c.ShouldBindJSON(&rule); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, "invalid request", http.StatusBadRequest)
		return
	}
	result, err := h.svc.CreateAlertRule(ctx, tenantID, &rule)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, result)
}

func (h *Handler) ListAlerts(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListAlerts")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx := ctx
	rules, err := h.svc.ListAlertRules(ctx, tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"data": rules, "total": len(rules)})
}
