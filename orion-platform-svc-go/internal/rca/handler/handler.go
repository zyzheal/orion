package handler

import (
	"go.opentelemetry.io/otel"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/middleware"
	"orion/platform-svc-go/internal/rca/models"
	"orion/platform-svc-go/internal/rca/service"
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

func (h *RCAHandler) RegisterRoutes(rg *gin.RouterGroup) {
	rca := rg.Group("/rca")
	rca.POST("/analyze", auth.RequirePermission("monitor", "execute"), h.Analyze)
	rca.GET("/history", auth.RequirePermission("monitor", "read"), h.ListHistory)
	rca.GET("/:analysis_id", auth.RequirePermission("monitor", "read"), h.GetAnalysis)
	rca.GET("/:analysis_id/timeline", auth.RequirePermission("monitor", "read"), h.GetTimeline)
	rca.GET("/:analysis_id/fixes", auth.RequirePermission("monitor", "read"), h.GetFixes)
}

func (h *RCAHandler) Analyze(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RCAnalyze")
	defer span.End()
	tenantID := h.GetTenantID(c)
	var req models.AnalyzeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	triggeredBy := c.GetString("userId")
	if triggeredBy == "" {
		triggeredBy = "manual"
	}
	analysis, err := h.svc.Analyze(ctx, tenantID, &req, triggeredBy)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, analysis)
}

func (h *RCAHandler) ListHistory(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RCAListHistory")
	defer span.End()
	tenantID := h.GetTenantID(c)
	incidentID := c.Query("incident_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	resp, err := h.svc.QueryAnalysisHistory(ctx, tenantID, incidentID, limit, offset)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondPaginated(c, resp.Data, offset, limit, int(resp.Total))
}

func (h *RCAHandler) GetAnalysis(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RCAGetAnalysis")
	defer span.End()
	tenantID := h.GetTenantID(c)
	id, err := uuid.Parse(c.Param("analysis_id"))
	if err != nil {
		middleware.RespondBadRequest(c, "invalid analysis_id format")
		return
	}
	analysis, err := h.svc.GetAnalysis(ctx, tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, analysis)
}

func (h *RCAHandler) GetTimeline(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RCAGetTimeline")
	defer span.End()
	tenantID := h.GetTenantID(c)
	incidentID := c.Param("analysis_id")
	timeline, err := h.svc.GetTimeline(ctx, tenantID, incidentID)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"incidentId": incidentID, "timeline": timeline})
}

func (h *RCAHandler) GetFixes(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RCAGetFixes")
	defer span.End()
	tenantID := h.GetTenantID(c)
	rootCauseID := c.Param("analysis_id")
	fixes, err := h.svc.SuggestFixes(ctx, tenantID, rootCauseID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"rootCauseId": rootCauseID, "fixes": fixes})
}
