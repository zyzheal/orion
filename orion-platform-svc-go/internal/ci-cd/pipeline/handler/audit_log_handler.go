package handler

import (
	"strconv"

	"orion/platform-svc-go/internal/ci-cd/pipeline/models"
	"orion/platform-svc-go/internal/ci-cd/pipeline/service"
	"orion/go-common/pkg/auth"

	"github.com/gin-gonic/gin"
)

// AuditLogHandler provides HTTP handlers for pipeline audit log operations.
type AuditLogHandler struct {
	svc *service.AuditLogService
}

func NewAuditLogHandler(svc *service.AuditLogService) *AuditLogHandler {
	return &AuditLogHandler{svc: svc}
}

func (h *AuditLogHandler) RegisterRoutes(rg *gin.RouterGroup) {
	audit := rg.Group("/pipeline-audit")
	{
		audit.POST("", auth.RequirePermission("pipeline", "write"), h.RecordAudit)
		audit.POST("/batch", auth.RequirePermission("pipeline", "write"), h.BatchRecordAudit)
		audit.GET("", h.QueryAudit)
		audit.GET("/trail", h.AuditTrail)
		audit.DELETE("", auth.RequirePermission("pipeline", "admin"), h.CleanupAudit)
	}
}

// RecordAudit records a single audit log entry.
func (h *AuditLogHandler) RecordAudit(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	var req models.RecordAuditRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	// Default actor from context if not provided
	if req.Actor == "" {
		req.Actor = c.GetString("user_id")
	}

	log, err := h.svc.Record(c.Request.Context(), tenantID, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondCreated(c, log)
}

// BatchRecordAudit records multiple audit log entries.
func (h *AuditLogHandler) BatchRecordAudit(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	var reqs []models.RecordAuditRequest
	if err := c.ShouldBindJSON(&reqs); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	if len(reqs) == 0 {
		respondBadRequest(c, "at least one record is required")
		return
	}

	for i := range reqs {
		if reqs[i].Actor == "" {
			reqs[i].Actor = c.GetString("user_id")
		}
	}

	count, err := h.svc.BatchRecord(c.Request.Context(), tenantID, reqs)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondCreated(c, gin.H{"recorded": count})
}

// QueryAudit queries audit logs with optional filters.
func (h *AuditLogHandler) QueryAudit(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	if limit <= 0 || limit > 100 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	filter := models.AuditLogFilter{
		PipelineID: c.Query("pipeline_id"),
		RunID:      c.Query("run_id"),
		Actor:      c.Query("actor"),
		Action:     c.Query("action"),
		StartTime:  c.Query("start_time"),
		EndTime:    c.Query("end_time"),
		Limit:      limit,
		Offset:     offset,
	}

	logs, total, err := h.svc.List(c.Request.Context(), tenantID, filter)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, gin.H{"logs": logs, "total": total})
}

// AuditTrail returns audit trail with enriched context.
func (h *AuditLogHandler) AuditTrail(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	if limit <= 0 || limit > 100 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	pipelineID := c.Query("pipeline_id")
	runID := c.Query("run_id")

	entries, total, err := h.svc.GetTrail(c.Request.Context(), tenantID, pipelineID, runID, limit, offset)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, gin.H{"entries": entries, "total": total})
}

// CleanupAudit deletes audit logs older than the specified timestamp.
func (h *AuditLogHandler) CleanupAudit(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	before := c.Query("before")
	if before == "" {
		respondBadRequest(c, "before (ISO 8601 timestamp) is required")
		return
	}

	count, err := h.svc.Cleanup(c.Request.Context(), tenantID, before)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, gin.H{"message": "audit logs cleaned up",
		"deleted": count,})
}