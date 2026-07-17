package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/artifact-ops/models"
	"orion/platform-svc-go/internal/artifact-ops/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes mounts all artifact-ops endpoints onto the given router group.
// Routes are mounted under /api/v1/artifact-ops/<path>.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	read := auth.RequirePermission("artifact_ops", "read")
	write := auth.RequirePermission("artifact_ops", "write")
	ops := rg.Group("/artifact-ops")

	// ----- Operation Tracking -----
	ops.POST("/track", write, h.TrackOperation)
	ops.GET("/history/:artifactId", read, h.GetOperationHistory)
	ops.GET("/stats", read, h.GetArtifactStats)

	// ----- Cleanup -----
	ops.POST("/cleanup", write, h.Cleanup)

	// ----- Scan -----
	ops.POST("/scan/:artifactId", write, h.ScanArtifact)
	ops.GET("/scan/report/:scanId", read, h.GetScanReport)
	ops.GET("/scan/:artifactId/reports", read, h.GetArtifactScanReports)
	ops.POST("/scan/detect", write, h.DetectMalicious)

	// ----- Retention -----
	ops.POST("/retention", write, h.DefineRetentionPolicy)
	ops.POST("/retention/evaluate", write, h.EvaluateRetention)
	ops.POST("/retention/report", write, h.GetRetentionReport)
	ops.GET("/retention/policies", read, h.ListPolicies)
	ops.DELETE("/retention/policies/:policyId", write, h.DeletePolicy)
}

// ---------- Operation Tracking ----------

func (h *Handler) TrackOperation(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	actorID := c.GetString("user_id")
	var req models.TrackOperationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	op, err := h.svc.TrackOperation(c.Request.Context(), tenantID, actorID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, op)
}

func (h *Handler) GetOperationHistory(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	artifactID := c.Param("artifactId")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	items, err := h.svc.GetOperationHistory(c.Request.Context(), tenantID, artifactID, limit, offset)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": items, "total": len(items)})
}

func (h *Handler) GetArtifactStats(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	artifactID := c.Query("artifactId")
	if artifactID == "" {
		middleware.RespondBadRequest(c, "artifactId is required")
		return
	}
	stats, err := h.svc.GetArtifactStats(c.Request.Context(), tenantID, artifactID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, stats)
}

func (h *Handler) Cleanup(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	result, err := h.svc.Cleanup(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

// ---------- Scan ----------

func (h *Handler) ScanArtifact(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	artifactID := c.Param("artifactId")
	var req models.ScanArtifactRequest
	c.ShouldBindJSON(&req)
	scan, err := h.svc.ScanArtifact(c.Request.Context(), tenantID, artifactID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, scan)
}

func (h *Handler) GetScanReport(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	scanID := c.Param("scanId")
	report, err := h.svc.GetScanReport(c.Request.Context(), tenantID, scanID)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, report)
}

func (h *Handler) GetArtifactScanReports(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	artifactID := c.Param("artifactId")
	reports, err := h.svc.GetArtifactScanReports(c.Request.Context(), tenantID, artifactID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": reports, "total": len(reports)})
}

func (h *Handler) DetectMalicious(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.DetectMaliciousRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.DetectMalicious(c.Request.Context(), tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

// ---------- Retention ----------

func (h *Handler) DefineRetentionPolicy(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.DefineRetentionPolicyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	policy, err := h.svc.DefineRetentionPolicy(c.Request.Context(), tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, policy)
}

func (h *Handler) EvaluateRetention(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.EvaluateRetentionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.EvaluateRetention(c.Request.Context(), tenantID, req)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) GetRetentionReport(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.RetentionReportRequest
	c.ShouldBindJSON(&req)
	report, err := h.svc.GetRetentionReport(c.Request.Context(), tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, report)
}

func (h *Handler) ListPolicies(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	policies, err := h.svc.ListPolicies(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": policies, "total": len(policies)})
}

func (h *Handler) DeletePolicy(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	policyID := c.Param("policyId")
	if err := h.svc.DeletePolicy(c.Request.Context(), tenantID, policyID); err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "retention policy deleted"})
}
