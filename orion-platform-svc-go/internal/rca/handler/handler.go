package handler

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.opentelemetry.io/otel"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/middleware"
	"orion/platform-svc-go/internal/rca/models"
	"orion/platform-svc-go/internal/rca/service"
)

// tenantKey and userKey are the exact context keys that
// orion-go-common/pkg/auth's JWT middleware writes (middleware.go: c.Set("user_id", …),
// c.Set("tenant_id", …)). Nothing in the platform copies them into camelCase.
//
// This handler used to read "tenantId" and "userId". c.GetString on a missing key
// returns "", and uuid.Parse("") yields the zero UUID with no error, so every
// request silently ran as tenant 00000000-0000-0000-0000-000000000000. All tenants
// then shared one rca_analyses bucket, so any caller holding monitor:read could read
// every other tenant's RCA history, and triggered_by was hardcoded to "manual".
const (
	tenantKey = "tenant_id"
	userKey   = "user_id"
)

type RCAHandler struct {
	svc *service.RCAService
}

func NewRCAHandler(svc *service.RCAService) *RCAHandler {
	return &RCAHandler{svc: svc}
}

// tenantID returns the caller's tenant from the auth middleware's context. It
// fails closed: a missing or unparsable tenant is a 401, never the zero UUID.
// Returning the zero UUID would have routed every query through the shared
// bucket described in the package comment.
func (h *RCAHandler) tenantID(c *gin.Context) (uuid.UUID, bool) {
	raw := c.GetString(tenantKey)
	if raw == "" {
		return uuid.UUID{}, false
	}
	id, err := uuid.Parse(raw)
	if err != nil {
		return uuid.UUID{}, false
	}
	return id, true
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
	tenantID, ok := h.tenantID(c)
	if !ok {
		middleware.RespondUnauthorized(c, "tenant_id required")
		return
	}
	var req models.AnalyzeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	// The acting user comes from the auth middleware, not from the request body:
	// the body is untrusted and triggered_by is an audit field.
	triggeredBy := c.GetString(userKey)
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
	tenantID, ok := h.tenantID(c)
	if !ok {
		middleware.RespondUnauthorized(c, "tenant_id required")
		return
	}
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
	tenantID, ok := h.tenantID(c)
	if !ok {
		middleware.RespondUnauthorized(c, "tenant_id required")
		return
	}
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
	tenantID, ok := h.tenantID(c)
	if !ok {
		middleware.RespondUnauthorized(c, "tenant_id required")
		return
	}
	analysisID, err := uuid.Parse(c.Param("analysis_id"))
	if err != nil {
		middleware.RespondBadRequest(c, "invalid analysis_id format")
		return
	}
	// The path parameter is an analysis id. The timeline table is keyed by
	// incident_id, so the analysis must be loaded first to resolve the incident;
	// passing the analysis id straight into the incident_id predicate never
	// matched anything.
	timeline, err := h.svc.GetTimeline(ctx, tenantID, analysisID)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"analysisId": c.Param("analysis_id"), "timeline": timeline})
}

func (h *RCAHandler) GetFixes(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RCAGetFixes")
	defer span.End()
	tenantID, ok := h.tenantID(c)
	if !ok {
		middleware.RespondUnauthorized(c, "tenant_id required")
		return
	}
	analysisID, err := uuid.Parse(c.Param("analysis_id"))
	if err != nil {
		middleware.RespondBadRequest(c, "invalid analysis_id format")
		return
	}
	// The path parameter is an analysis id, not a root-cause id: looking it up
	// against rca_root_causes.id never matched. The fixes come from the
	// analysis's own root causes, loaded through the tenant-scoped lookup.
	fixes, err := h.svc.SuggestFixes(ctx, tenantID, analysisID)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"analysisId": c.Param("analysis_id"), "fixes": fixes})
}
