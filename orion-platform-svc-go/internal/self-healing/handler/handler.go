package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/self-healing/models"
	"orion/platform-svc-go/internal/self-healing/service"

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

// RegisterRoutes registers the self-healing endpoints.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	r := rg.Group("/self-healing")

	// Incidents
	r.POST("/incidents",
		auth.RequirePermission("self-healing", "write"),
		h.CreateIncident)
	r.GET("/incidents/:id",
		auth.RequirePermission("self-healing", "read"),
		h.GetIncident)

	// History
	r.GET("/history",
		auth.RequirePermission("self-healing", "read"),
		h.ListHistory)

	// Effectiveness
	r.GET("/effectiveness",
		auth.RequirePermission("self-healing", "read"),
		h.GetEffectiveness)

	// Strategies
	r.GET("/strategies",
		auth.RequirePermission("self-healing", "read"),
		h.ListStrategies)
	r.GET("/strategies/:id",
		auth.RequirePermission("self-healing", "read"),
		h.GetStrategy)
	r.POST("/strategies/:id/toggle",
		auth.RequirePermission("self-healing", "write"),
		h.ToggleStrategy)
	r.POST("/strategies",
		auth.RequirePermission("self-healing", "write"),
		h.RegisterStrategy)

	// Approvals
	r.GET("/approvals",
		auth.RequirePermission("self-healing", "read"),
		h.ListApprovals)
	r.GET("/approvals/:id",
		auth.RequirePermission("self-healing", "read"),
		h.GetApproval)
	r.POST("/approvals/:id/respond",
		auth.RequirePermission("self-healing", "approve"),
		h.RespondApproval)
}

// === Incidents ===

func (h *Handler) CreateIncident(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateIncident")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx = middleware.TimeoutContext(c)

	var req models.CreateIncidentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	incident, err := h.svc.CreateIncident(ctx, tenantID, req)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondCreated(c, incident)
}

func (h *Handler) GetIncident(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetIncident")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx = middleware.TimeoutContext(c)

	incident, err := h.svc.GetIncident(ctx, tenantID, c.Param("id"))
	if err != nil {
		middleware.RespondNotFound(c, "incident not found")
		return
	}
	middleware.RespondSuccess(c, incident)
}

// === History ===

func (h *Handler) ListHistory(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListHistory")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx = middleware.TimeoutContext(c)

	q := models.HistoryQuery{
		AppName:     c.Query("appName"),
		Environment: c.Query("environment"),
		Type:        c.Query("type"),
		Status:      c.Query("status"),
		Severity:    c.Query("severity"),
	}
	if p := c.Query("page"); p != "" {
		q.Page, _ = strconv.Atoi(p)
	}
	if l := c.Query("limit"); l != "" {
		q.Limit, _ = strconv.Atoi(l)
	}
	if q.Page <= 0 {
		q.Page = 1
	}
	if q.Limit <= 0 || q.Limit > 100 {
		q.Limit = 20
	}

	incidents, total, err := h.svc.ListHistory(ctx, tenantID, q)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{
		"data":  incidents,
		"total": total,
	})
}

// === Effectiveness ===

func (h *Handler) GetEffectiveness(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetEffectiveness")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx = middleware.TimeoutContext(c)

	q := models.EffectivenessQuery{
		AppName:     c.Query("appName"),
		Environment: c.Query("environment"),
	}

	eff, err := h.svc.GetEffectiveness(ctx, tenantID, q)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, eff)
}

// === Strategies ===

func (h *Handler) ListStrategies(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListStrategies")
	defer span.End()
	ctx = middleware.TimeoutContext(c)

	strategies, err := h.svc.ListStrategies(ctx)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{
		"data":  strategies,
		"total": len(strategies),
	})
}

func (h *Handler) GetStrategy(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetStrategy")
	defer span.End()
	ctx = middleware.TimeoutContext(c)

	strategy, err := h.svc.GetStrategy(ctx, c.Param("id"))
	if err != nil {
		middleware.RespondNotFound(c, "strategy not found")
		return
	}
	middleware.RespondSuccess(c, strategy)
}

func (h *Handler) ToggleStrategy(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ToggleStrategy")
	defer span.End()
	ctx = middleware.TimeoutContext(c)

	var req models.ToggleStrategyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	err := h.svc.ToggleStrategy(ctx, c.Param("id"), req.Enabled)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{
		"id":      c.Param("id"),
		"enabled": req.Enabled,
	})
}

func (h *Handler) RegisterStrategy(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RegisterStrategy")
	defer span.End()
	ctx = middleware.TimeoutContext(c)

	var req models.RegisterStrategyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	strategy, err := h.svc.RegisterStrategy(ctx, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, strategy)
}

// === Approvals ===

func (h *Handler) ListApprovals(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListApprovals")
	defer span.End()
	ctx = middleware.TimeoutContext(c)
	status := c.Query("status")

	approvals, err := h.svc.ListApprovals(ctx, status)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{
		"data":  approvals,
		"total": len(approvals),
	})
}

func (h *Handler) GetApproval(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetApproval")
	defer span.End()
	ctx = middleware.TimeoutContext(c)

	approval, err := h.svc.GetApproval(ctx, c.Param("id"))
	if err != nil {
		middleware.RespondNotFound(c, "approval request not found")
		return
	}
	middleware.RespondSuccess(c, approval)
}

func (h *Handler) RespondApproval(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RespondApproval")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx = middleware.TimeoutContext(c)

	var req models.RespondApprovalRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	incident, err := h.svc.RespondApproval(ctx, tenantID, c.Param("id"), req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	message := "Healing execution started"
	if !req.Approved {
		message = "Approval rejected"
	}
	middleware.RespondSuccess(c, gin.H{
		"incidentId":     incident.ID,
		"status":         incident.Status,
		"approvalStatus": incident.ApprovalStatus,
		"message":        message,
	})
}
