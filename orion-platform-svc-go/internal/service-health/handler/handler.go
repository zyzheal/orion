package handler

import (
	"net/http"
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/errors"
	"orion/platform-svc-go/internal/service-health/models"
	"orion/platform-svc-go/internal/service-health/service"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"orion/go-common/pkg/sentinel"
)

// Handler wires the service-health service to gin routes.
type Handler struct {
	svc *service.Service
}

// NewHandler creates a new Handler.
func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes mounts all service-health routes under /service-health.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	r := rg.Group("/service-health")

	// CRUD
	r.GET("", auth.RequirePermission("service_health", "read"), h.List)
	r.GET("/:id", auth.RequirePermission("service_health", "read"), h.Get)
	r.POST("", auth.RequirePermission("service_health", "write"), h.Create)
	r.PUT("/:id", auth.RequirePermission("service_health", "write"), h.Update)
	r.DELETE("/:id", auth.RequirePermission("service_health", "delete"), h.Delete)

	// Results
	r.POST("/:id/record", auth.RequirePermission("service_health", "write"), h.RecordResult)
	r.GET("/:id/results", auth.RequirePermission("service_health", "read"), h.GetResults)

	// Summaries
	r.GET("/summary/:serviceName", auth.RequirePermission("service_health", "read"), h.GetServiceHealth)
	r.GET("/summaries", auth.RequirePermission("service_health", "read"), h.GetAllSummaries)
	r.GET("/degraded", auth.RequirePermission("service_health", "read"), h.DegradedServices)
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

func (h *Handler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "List")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.List(ctx, tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"data": items, "total": len(items)})
}

func (h *Handler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Get")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	item, err := h.svc.Get(ctx, tenantID, id)
	if err != nil {
		errors.WriteError(c, errors.ErrNotFound, err.Error(), http.StatusNotFound)
		return
	}
	errors.WriteSuccess(c, item)
}

func (h *Handler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Create")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateHealthCheckRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), http.StatusBadRequest)
		return
	}
	item, err := h.svc.Create(ctx, tenantID, req)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteCreated(c, item)
}

func (h *Handler) Update(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Update")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	// Detect whether any field was sent so we can pass *bool for Enabled
	// when the caller explicitly provided it.
	var reqRaw models.UpdateHealthCheckRequest
	if err := c.ShouldBindJSON(&reqRaw); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), http.StatusBadRequest)
		return
	}

	// The original stub used an `Enabled *bool` field so that the handler could
	// distinguish "not sent" from "false". The caller must use the
	// enabled pointer when toggling. We keep that semantic here.
	req := reqRaw
	id := c.Param("id")
	item, err := h.svc.Update(ctx, tenantID, id, req)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, item)
}

func (h *Handler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Delete")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.Delete(ctx, tenantID, id); err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"message": "deleted"})
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

// RecordResult records a new health check result for an existing check.
func (h *Handler) RecordResult(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RecordResult")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	checkID := c.Param("id")

	// Verify the check exists and belongs to the tenant first.
	_, err := h.svc.Get(ctx, tenantID, checkID)
	if err != nil {
		errors.WriteError(c, errors.ErrNotFound, err.Error(), http.StatusNotFound)
		return
	}

	var req models.RecordHealthResultRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), http.StatusBadRequest)
		return
	}
	if !validStatus(req.Status) {
		errors.WriteError(c, errors.ErrBadRequest, "invalid status: must be UP, DOWN or UNKNOWN", http.StatusBadRequest)
		return
	}

	updated, err := h.svc.RecordHealthResult(ctx, checkID, req.Status, req.ResponseTimeMs, req.Error)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, updated)
}

// GetResults returns the recent results for a check.
func (h *Handler) GetResults(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetResults")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	checkID := c.Param("id")

	// Verify ownership.
	_, err := h.svc.Get(ctx, tenantID, checkID)
	if err != nil {
		errors.WriteError(c, errors.ErrNotFound, err.Error(), http.StatusNotFound)
		return
	}

	limit := 20
	if l := c.Query("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 {
			limit = parsed
		}
	}

	results, err := h.svc.GetRecentResults(ctx, checkID, limit)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, results)
}

// ---------------------------------------------------------------------------
// Summaries
// ---------------------------------------------------------------------------

// GetServiceHealth returns the aggregated health summary for a single service.
func (h *Handler) GetServiceHealth(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetServiceHealth")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	serviceName := c.Param("serviceName")
	summary, err := h.svc.GetServiceHealth(ctx, tenantID, serviceName)
	if err != nil {
		errors.WriteError(c, errors.ErrNotFound, "service health summary not found", http.StatusNotFound)
		return
	}
	errors.WriteSuccess(c, summary)
}

// GetAllSummaries returns health summaries for every service within the tenant.
func (h *Handler) GetAllSummaries(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetAllSummaries")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	summaries, err := h.svc.GetAllHealthSummaries(ctx, tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, summaries)
}

// DegradedServices returns summaries for services whose 24h uptime falls below
// the given threshold (query param: threshold_uptime).
func (h *Handler) DegradedServices(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DegradedServices")
	defer span.End()
	tenantID := c.GetString("tenant_id")

	threshold := 99.0
	if t := c.Query("threshold_uptime"); t != "" {
		if parsed, err := parseFloatOrDefault(t); err == nil {
			threshold = parsed
		}
	}

	summaries, err := h.svc.DetectDegradedServices(ctx, tenantID, threshold)
	if err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), http.StatusBadRequest)
		return
	}
	errors.WriteSuccess(c, summaries)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func validStatus(s models.LastStatus) bool {
	return s == models.StatusUP || s == models.StatusDOWN || s == models.StatusUNKNOWN
}

func parseFloatOrDefault(s string) (float64, error) {
	v, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return 0, err
	}
	return v, nil
}
