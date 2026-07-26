package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"orion/monitor-svc-go/internal/response_writer"
	"orion/monitor-svc-go/internal/rca/models"
	"orion/monitor-svc-go/internal/rca/service"
	"orion/go-common/pkg/auth"
)

type RCAHandler struct {
	svc *service.RCAService
}

func NewRCAHandler(svc *service.RCAService) *RCAHandler {
	return &RCAHandler{svc: svc}
}

func (h *RCAHandler) GetTenantID(c *gin.Context) uuid.UUID {
	tenantID, _ := uuid.Parse(c.GetString("tenantId"))
	return tenantID
}

// RegisterRoutes registers RCA routes.
func (h *RCAHandler) RegisterRoutes(rg *gin.RouterGroup) {
	rca := rg.Group("/rca")

	rca.POST("/analyze", auth.RequirePermission("monitor", "execute"), h.Analyze)
	rca.GET("/history", auth.RequirePermission("monitor", "read"), h.ListHistory)
	rca.GET("/:analysis_id", auth.RequirePermission("monitor", "read"), h.GetAnalysis)
	rca.GET("/:incident_id/timeline", auth.RequirePermission("monitor", "read"), h.GetTimeline)
	rca.GET("/:root_cause_id/fixes", auth.RequirePermission("monitor", "read"), h.GetFixes)
}

// Analyze triggers root cause analysis.
func (h *RCAHandler) Analyze(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	var req models.AnalyzeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response_writer.RespondBadRequest(c, err.Error())
		return
	}

	triggeredBy := c.GetString("userId")
	if triggeredBy == "" {
		triggeredBy = "manual"
	}

	analysis, err := h.svc.Analyze(c.Request.Context(), tenantID, &req, triggeredBy)
	if err != nil {
		response_writer.RespondInternalError(c, err.Error())
		return
	}
	response_writer.Respond(c, http.StatusAccepted, analysis)
}

// ListHistory returns paginated analysis history.
func (h *RCAHandler) ListHistory(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	incidentID := c.Query("incident_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	resp, err := h.svc.QueryAnalysisHistory(c.Request.Context(), tenantID, incidentID, limit, offset)
	if err != nil {
		response_writer.RespondInternalError(c, err.Error())
		return
	}
	response_writer.Respond(c, http.StatusOK, gin.H{
		"total": resp.Total,
		"data":  resp.Data,
	})
}

// GetAnalysis returns an analysis by ID.
func (h *RCAHandler) GetAnalysis(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	id, err := uuid.Parse(c.Param("analysis_id"))
	if err != nil {
		response_writer.RespondBadRequest(c, "invalid analysis_id format")
		return
	}

	analysis, err := h.svc.GetAnalysis(c.Request.Context(), tenantID, id)
	if err != nil {
		response_writer.RespondNotFound(c, err.Error())
		return
	}
	response_writer.Respond(c, http.StatusOK, analysis)
}

// GetTimeline returns the timeline for an incident.
func (h *RCAHandler) GetTimeline(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	incidentID := c.Param("incident_id")

	timeline, err := h.svc.GetTimeline(c.Request.Context(), tenantID, incidentID)
	if err != nil {
		response_writer.RespondNotFound(c, err.Error())
		return
	}
	response_writer.Respond(c, http.StatusOK, gin.H{
		"incidentId": incidentID,
		"timeline":   timeline,
	})
}

// GetFixes returns suggested fixes for a root cause.
func (h *RCAHandler) GetFixes(c *gin.Context) {
	tenantID := h.GetTenantID(c)
	rootCauseID := c.Param("root_cause_id")

	fixes, err := h.svc.SuggestFixes(c.Request.Context(), tenantID, rootCauseID)
	if err != nil {
		response_writer.RespondInternalError(c, err.Error())
		return
	}
	response_writer.Respond(c, http.StatusOK, gin.H{
		"rootCauseId": rootCauseID,
		"fixes":       fixes,
	})
}
