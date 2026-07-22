package handler

import (
	"strconv"
	"time"

	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/errors"
	"orion/platform-svc-go/internal/logging/models"
	"orion/platform-svc-go/internal/logging/service"
	"orion/platform-svc-go/internal/middleware"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	r := rg.Group("/logs")
	r.POST("", auth.RequirePermission("logs", "write"), h.Ingest)
	r.POST("/batch", auth.RequirePermission("logs", "write"), h.IngestBatch)
	r.GET("/trace/:traceId", auth.RequirePermission("logs", "read"), h.GetByTrace)
	r.GET("/aggregate", auth.RequirePermission("logs", "read"), h.Aggregation)
	r.GET("/search", auth.RequirePermission("logs", "read"), h.Search)
	r.DELETE("/cleanup", auth.RequirePermission("logs", "delete"), h.CleanupOld)
}

func (h *Handler) getTenantID(c *gin.Context) string {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		middleware.RespondUnauthorized(c, "tenant_id required")
		return ""
	}
	return tenantID
}

func (h *Handler) Ingest(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "IngestLog")
	defer span.End()
	tenantID := h.getTenantID(c)
	var req models.IngestLogRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	entry, err := h.svc.Ingest(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, "internal server error")
		return
	}
	errors.WriteCreated(c, entry)
}

func (h *Handler) IngestBatch(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "IngestLogBatch")
	defer span.End()
	tenantID := h.getTenantID(c)
	var req []models.IngestLogRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	n, err := h.svc.IngestBatch(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, "internal server error")
		return
	}
	errors.WriteCreated(c, gin.H{"ingested": n})
}

func (h *Handler) GetByTrace(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetLogsByTrace")
	defer span.End()
	tenantID := h.getTenantID(c)
	entries, err := h.svc.GetByTrace(ctx, tenantID, c.Param("traceId"))
	if err != nil {
		middleware.RespondInternalError(c, "internal server error")
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": entries, "total": len(entries)})
}

// queryLogParams builds a LogQuery from GET parameters.
func (h *Handler) queryLogParams(c *gin.Context, tenantID string) *models.LogQuery {
	q := &models.LogQuery{TenantID: tenantID}
	q.Service = c.Query("service")
	q.Level = c.Query("level")
	q.TraceID = c.Query("traceId")

	if p := c.Query("page"); p != "" {
		if v, err := strconv.Atoi(p); err == nil && v > 0 {
			q.Page = v
		}
	}
	if p := c.Query("pageSize"); p != "" {
		if v, err := strconv.Atoi(p); err == nil && v > 0 && v <= 100 {
			q.PageSize = v
		}
	}

	if ts := c.Query("timeFrom"); ts != "" {
		if t, err := time.Parse(time.RFC3339, ts); err == nil {
			q.TimeFrom = t
		} else if t, err := time.Parse("2006-01-02", ts); err == nil {
			q.TimeFrom = t
		}
	}
	if ts := c.Query("timeTo"); ts != "" {
		if t, err := time.Parse(time.RFC3339, ts); err == nil {
			q.TimeTo = t
		} else if t, err := time.Parse("2006-01-02", ts); err == nil {
			// Parse as start of day, treat as end-of-day for range
			q.TimeTo = t.Add(24*time.Hour - time.Second)
		}
	}
	return q
}

func (h *Handler) queryLogs(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "QueryLogs")
	defer span.End()
	tenantID := h.getTenantID(c)
	q := h.queryLogParams(c, tenantID)

	entries, total, err := h.svc.Query(ctx, q)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": entries, "total": total, "page": q.Page, "pageSize": q.PageSize})
}

func (h *Handler) Aggregation(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AggregateLogs")
	defer span.End()
	tenantID := h.getTenantID(c)
	q := h.queryLogParams(c, tenantID)
	agg, err := h.svc.Aggregation(ctx, q)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, agg)
}

func (h *Handler) Search(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SearchLogs")
	defer span.End()
	tenantID := h.getTenantID(c)
	keywords := c.QueryArray("keyword")
	entries, err := h.svc.Search(ctx, tenantID, keywords)
	if err != nil {
		middleware.RespondInternalError(c, "internal server error")
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": entries, "total": len(entries)})
}

func (h *Handler) CleanupOld(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CleanupOldLogs")
	defer span.End()
	tenantID := h.getTenantID(c)
	n, err := h.svc.CleanupOld(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, "internal server error")
		return
	}
	middleware.RespondSuccess(c, gin.H{"deleted": n})
}
