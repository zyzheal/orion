package handler

import (
	"net/http"
	"orion/platform-svc-go/internal/middleware"
	"strconv"
	"time"

	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/errors"
	"orion/platform-svc-go/internal/pipeline-audit-log/models"
	"orion/platform-svc-go/internal/pipeline-audit-log/service"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all pipeline audit log endpoints under the given group.
// Mirrors /api/v1/audit-logs routes from the TS source (5 endpoints).
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/audit-logs")

	// POST /audit-logs — Record single event
	f.POST("", auth.RequirePermission("audit-log", "write"), h.Record)
	// POST /audit-logs/batch — Batch record events
	f.POST("/batch", auth.RequirePermission("audit-log", "write"), h.RecordBatch)
	// GET /audit-logs — Query with filters
	f.GET("", auth.RequirePermission("audit-log", "read"), h.Query)
	// GET /runs/:runId/audit-trail — Full audit trail for a run
	f.GET("/runs/:runId/audit-trail", auth.RequirePermission("audit-log", "read"), h.GetRunAuditTrail)
	// POST /audit-logs/cleanup — Cleanup expired logs
	f.POST("/cleanup", auth.RequirePermission("audit-log", "delete"), h.CleanupExpired)
}

// getTenantID extracts tenant_id from Gin context, falling back to a zero UUID.
func (h *Handler) getTenantID(c *gin.Context) string {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		middleware.RespondUnauthorized(c, "tenant_id required")
		return ""
	}
	return tenantID
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

func (h *Handler) Record(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Record")
	defer span.End()
	var req models.AuditLogRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	log, err := h.svc.Record(ctx, &req, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, log)
}

func (h *Handler) RecordBatch(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RecordBatch")
	defer span.End()
	var req models.AuditLogBatchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if len(req.Logs) == 0 {
		middleware.RespondBadRequest(c, "logs array is required")
		return
	}
	tenantID := h.getTenantID(c)
	logs, err := h.svc.RecordBatch(ctx, req.Logs, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, logs)
}

func (h *Handler) Query(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Query")
	defer span.End()
	tenantID := h.getTenantID(c)

	runID := c.Query("runId")
	stageID := c.Query("stageId")
	taskID := c.Query("taskId")
	action := c.Query("action")
	actor := c.Query("actor")
	outcome := c.Query("outcome")
	limit, _ := strconv.Atoi(c.Query("limit"))
	offset, _ := strconv.Atoi(c.Query("offset"))

	var q models.AuditLogQuery
	if runID != "" {
		q.RunID = &runID
	}
	if stageID != "" {
		q.StageID = &stageID
	}
	if taskID != "" {
		q.TaskID = &taskID
	}
	if action != "" {
		q.Action = &action
	}
	if actor != "" {
		q.Actor = &actor
	}
	if outcome != "" {
		q.Outcome = &outcome
	}
	if startTime := c.Query("startTime"); startTime != "" {
		t, ok := parseTimeParam(startTime)
		if ok {
			q.StartTime = &t
		}
	}
	if endTime := c.Query("endTime"); endTime != "" {
		t, ok := parseTimeParam(endTime)
		if ok {
			q.EndTime = &t
		}
	}
	q.Limit = limit
	q.Offset = offset

	logs, total, err := h.svc.Query(ctx, &q, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{
		"data":     logs,
		"total":    total,
		"page":     q.Offset,
		"pageSize": q.Limit,
	})
}

func (h *Handler) GetRunAuditTrail(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetRunAuditTrail")
	defer span.End()
	runID := c.Param("runId")
	tenantID := h.getTenantID(c)
	limit, _ := strconv.Atoi(c.Query("limit"))
	if limit <= 0 {
		limit = 100
	}
	trail, err := h.svc.GetRunAuditTrail(ctx, tenantID, runID, limit)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "pipeline run not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, trail)
}

func (h *Handler) CleanupExpired(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CleanupExpired")
	defer span.End()
	var req models.CleanupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		req.RetentionDays = nil // use default on bad JSON
	}
	tenantID := h.getTenantID(c)
	deleted, err := h.svc.CleanupExpired(ctx, tenantID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{
		"deleted": deleted,
	})
}

// parseTimeParam attempts to parse a time parameter from a query string,
// returning the parsed time.Time and whether it succeeded.
func parseTimeParam(s string) (time.Time, bool) {
	for _, layout := range []string{
		"2006-01-02T15:04:05Z",
		"2006-01-02T15:04:05.999Z",
		"2006-01-02T15:04:05-07:00",
		"2006-01-02",
	} {
		if t, err := time.Parse(layout, s); err == nil {
			return t, true
		}
	}
	return time.Time{}, false
}

func respondSuccess(c *gin.Context, data interface{}) {
	errors.WriteSuccess(c, data)
}

func respondCreated(c *gin.Context, data interface{}) {
	errors.WriteCreated(c, data)
}

func respondNotFound(c *gin.Context, message string) {
	errors.WriteError(c, errors.ErrNotFound, message, http.StatusNotFound)
}

func respondBadRequest(c *gin.Context, message string) {
	errors.WriteError(c, errors.ErrBadRequest, message, http.StatusBadRequest)
}

func respondInternalError(c *gin.Context, message string) {
	errors.WriteError(c, errors.ErrInternal, message, http.StatusInternalServerError)
}
