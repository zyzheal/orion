package handler

import (
	"orion/platform-svc-go/internal/ai-agent-run/models"
	"orion/platform-svc-go/internal/ai-agent-run/service"
	"orion/platform-svc-go/internal/middleware"
	"strconv"

	"orion/go-common/pkg/auth"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
)

// Handler exposes agent-run endpoints.
type Handler struct {
	svc *service.Service
}

// NewHandler creates a new Handler.
func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all agent-runs endpoints.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/agent-runs")

	// POST /agent-runs — trigger a new run
	f.POST("", auth.RequirePermission("ai-agent-run", "write"), h.TriggerRun)
	// GET /agent-runs — paginated list
	f.GET("", auth.RequirePermission("ai-agent-run", "read"), h.List)
	// GET /agent-runs/stats — aggregated statistics
	f.GET("/stats", auth.RequirePermission("ai-agent-run", "read"), h.GetStats)

	id := f.Group("/:id")
	{
		// GET /agent-runs/:id — detail
		id.GET("", auth.RequirePermission("ai-agent-run", "read"), h.GetByID)
		// POST /agent-runs/:id/step — execute a step
		id.POST("/step", auth.RequirePermission("ai-agent-run", "write"), h.ExecuteStep)
		// POST /agent-runs/:id/cancel — cancel a running run
		id.POST("/cancel", auth.RequirePermission("ai-agent-run", "write"), h.Cancel)
		// POST /agent-runs/:id/retry — retry a failed/cancelled run
		id.POST("/retry", auth.RequirePermission("ai-agent-run", "write"), h.Retry)
		// GET /agent-runs/:id/decisions — decision log
		id.GET("/decisions", auth.RequirePermission("ai-agent-run", "read"), h.GetDecisions)
	}
}

// getTenantID extracts tenant_id from the Gin context.
func (h *Handler) getTenantID(c *gin.Context) string {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		middleware.RespondUnauthorized(c, "tenant_id required")
		return ""
	}
	return tenantID
}

// ---- TriggerRun: POST /agent-runs ----

func (h *Handler) TriggerRun(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TriggerRun")
	defer span.End()
	tenantID := h.getTenantID(c)
	if tenantID == "" {
		return
	}

	var req models.TriggerRunRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	run, err := h.svc.TriggerRun(ctx, tenantID, &req)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	info, err := h.svc.RunToInfo(run)
	if err != nil {
		middleware.RespondInternalError(c, "failed to serialize agent run")
		return
	}
	middleware.RespondCreated(c, info)
}

// ---- GetByID: GET /agent-runs/:id ----

func (h *Handler) GetByID(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetByID")
	defer span.End()
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	if tenantID == "" {
		return
	}

	run, err := h.svc.GetByID(ctx, id, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "Agent run not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}

	info, err := h.svc.RunToInfo(run)
	if err != nil {
		middleware.RespondInternalError(c, "failed to serialize agent run")
		return
	}
	middleware.RespondSuccess(c, info)
}

// ---- List: GET /agent-runs ----

func (h *Handler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "List")
	defer span.End()
	tenantID := h.getTenantID(c)
	if tenantID == "" {
		return
	}

	offset, limit := getPaginationParams(c)
	filter := &models.ListFilter{
		Limit:  &limit,
		Offset: &offset,
	}
	if v := c.Query("agentProfileId"); v != "" {
		filter.AgentProfileID = &v
	}
	if v := c.Query("status"); v != "" {
		filter.Status = &v
	}

	runs, err := h.svc.List(ctx, tenantID, filter)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}

	infoList := make([]models.AgentRunInfo, 0, len(runs))
	for i := range runs {
		info, err := h.svc.RunToInfo(&runs[i])
		if err != nil {
			middleware.RespondInternalError(c, "failed to serialize agent run")
			return
		}
		infoList = append(infoList, *info)
	}

	middleware.RespondSuccess(c, gin.H{
		"data":   infoList,
		"total":  len(infoList),
		"offset": offset,
		"limit":  limit,
	})
}

// ---- ExecuteStep: POST /agent-runs/:id/step ----

func (h *Handler) ExecuteStep(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ExecuteStep")
	defer span.End()
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	if tenantID == "" {
		return
	}

	var req models.ExecuteStepRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	decision, err := h.svc.ExecuteStep(ctx, id, tenantID, &req)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "Agent run not found")
			return
		}
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	resp := h.svc.DecisionToResponse(decision)
	middleware.RespondSuccess(c, resp)
}

// ---- Cancel: POST /agent-runs/:id/cancel ----

func (h *Handler) Cancel(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Cancel")
	defer span.End()
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	if tenantID == "" {
		return
	}

	run, err := h.svc.Cancel(ctx, id, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "Agent run not found")
			return
		}
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	info, err := h.svc.RunToInfo(run)
	if err != nil {
		middleware.RespondInternalError(c, "failed to serialize agent run")
		return
	}
	middleware.RespondSuccess(c, gin.H{
		"data":    info,
		"message": "Agent run cancelled",
	})
}

// ---- Retry: POST /agent-runs/:id/retry ----

func (h *Handler) Retry(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Retry")
	defer span.End()
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	if tenantID == "" {
		return
	}

	run, err := h.svc.Retry(ctx, id, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "Agent run not found")
			return
		}
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	info, err := h.svc.RunToInfo(run)
	if err != nil {
		middleware.RespondInternalError(c, "failed to serialize agent run")
		return
	}
	middleware.RespondCreated(c, gin.H{
		"data":    info,
		"message": "Agent run retried",
	})
}

// ---- GetDecisions: GET /agent-runs/:id/decisions ----

func (h *Handler) GetDecisions(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetDecisions")
	defer span.End()
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	if tenantID == "" {
		return
	}

	decisions, err := h.svc.GetDecisions(ctx, id, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "Agent run not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}

	respList := make([]models.AgentDecisionResponse, 0, len(decisions))
	for i := range decisions {
		respList = append(respList, *h.svc.DecisionToResponse(&decisions[i]))
	}

	middleware.RespondSuccess(c, gin.H{
		"data":  respList,
		"total": len(respList),
	})
}

// ---- GetStats: GET /agent-runs/stats ----

func (h *Handler) GetStats(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetStats")
	defer span.End()
	tenantID := h.getTenantID(c)
	if tenantID == "" {
		return
	}

	stats, err := h.svc.GetStats(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, stats)
}

// ---- Helpers ----

func getPaginationParams(c *gin.Context) (offset, limit int) {
	offset = 0
	limit = 20
	if o := c.Query("offset"); o != "" {
		if v, err := strconv.Atoi(o); err == nil && v >= 0 {
			offset = v
		}
	}
	if l := c.Query("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil && v >= 1 {
			limit = v
			if limit > 100 {
				limit = 100
			}
		}
	}
	return
}
