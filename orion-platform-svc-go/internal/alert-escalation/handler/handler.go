package handler

import (
	"fmt"
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/alert-escalation/models"
	"orion/platform-svc-go/internal/alert-escalation/service"
	"orion/platform-svc-go/internal/middleware"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
)

type Handler struct {
	svc service.ServiceInterface
}

func NewHandler(svc service.ServiceInterface) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/alert-escalation")

	f.GET("/policies", auth.RequirePermission("alert", "read"), h.ListPolicies)
	f.POST("/policies", auth.RequirePermission("alert", "write"), h.CreatePolicy)
	f.GET("/policies/:id", auth.RequirePermission("alert", "read"), h.GetPolicy)
	f.PUT("/policies/:id", auth.RequirePermission("alert", "write"), h.UpdatePolicy)
	f.DELETE("/policies/:id", auth.RequirePermission("alert", "delete"), h.DeletePolicy)

	f.POST("/evaluate", auth.RequirePermission("alert", "write"), h.EvaluatePolicy)
	f.GET("/triggers", auth.RequirePermission("alert", "read"), h.ListTriggers)
	f.PUT("/triggers/:id/resolve", auth.RequirePermission("alert", "write"), h.ResolveTrigger)

	f.GET("/closures", auth.RequirePermission("alert", "read"), h.ListClosures)
	f.GET("/closures/:alertId", auth.RequirePermission("alert", "read"), h.GetClosure)
	f.POST("/acknowledge", auth.RequirePermission("alert", "write"), h.AcknowledgeAlert)
	f.POST("/resolve", auth.RequirePermission("alert", "write"), h.ResolveAlert)

	f.GET("/metrics", auth.RequirePermission("alert", "read"), h.GetMetrics)
}

func (h *Handler) getTenantID(c *gin.Context) string {
	tid := c.GetString("tenant_id")
	if tid == "" {
		middleware.RespondUnauthorized(c, "tenant_id required")
		return ""
	}
	return tid
}

func (h *Handler) getOperator(c *gin.Context) string {
	op := c.GetString("user_id")
	if op == "" {
		op = "system"
	}
	return op
}

// --- Policy ---

func (h *Handler) ListPolicies(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AlertEscListPolicies")
	defer span.End()
	policies, err := h.svc.ListPolicies(ctx, h.getTenantID(c))
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, policies)
}

func (h *Handler) CreatePolicy(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AlertEscCreatePolicy")
	defer span.End()
	var req models.CreatePolicyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	p, err := h.svc.CreatePolicy(ctx, &req, h.getTenantID(c), h.getOperator(c))
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondCreated(c, p)
}

func (h *Handler) GetPolicy(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AlertEscGetPolicy")
	defer span.End()
	p, err := h.svc.GetPolicy(ctx, c.Param("id"), h.getTenantID(c))
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, p)
}

func (h *Handler) UpdatePolicy(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AlertEscUpdatePolicy")
	defer span.End()
	var req models.UpdatePolicyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	p, err := h.svc.UpdatePolicy(ctx, c.Param("id"), h.getTenantID(c), &req)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, p)
}

func (h *Handler) DeletePolicy(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AlertEscDeletePolicy")
	defer span.End()
	deleted, err := h.svc.DeletePolicy(ctx, c.Param("id"), h.getTenantID(c))
	if err != nil || !deleted {
		middleware.RespondNotFound(c, "policy not found")
		return
	}
	middleware.RespondSuccess(c, gin.H{"deleted": true})
}

// --- Evaluate & Triggers ---

func (h *Handler) EvaluatePolicy(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AlertEscEvaluatePolicy")
	defer span.End()
	var body struct {
		AlertID  string `json:"alertId" binding:"required"`
		Severity string `json:"severity" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	triggers, err := h.svc.EvaluatePolicy(ctx, body.AlertID, body.Severity, h.getTenantID(c))
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, triggers)
}

func (h *Handler) ListTriggers(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AlertEscListTriggers")
	defer span.End()
	policyID := c.Query("policyId")
	triggers, err := h.svc.ListTriggers(ctx, h.getTenantID(c), policyID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, triggers)
}

func (h *Handler) ResolveTrigger(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AlertEscResolveTrigger")
	defer span.End()
	t, err := h.svc.ResolveTrigger(ctx, c.Param("id"), h.getTenantID(c))
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, t)
}

// --- Closure ---

func (h *Handler) ListClosures(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AlertEscListClosures")
	defer span.End()
	status := c.Query("status")
	closures, err := h.svc.ListClosures(ctx, h.getTenantID(c), status)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, closures)
}

func (h *Handler) GetClosure(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AlertEscGetClosure")
	defer span.End()
	closure, err := h.svc.GetClosure(ctx, c.Param("alertId"), h.getTenantID(c))
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, closure)
}

func (h *Handler) AcknowledgeAlert(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AlertEscAcknowledge")
	defer span.End()
	var req models.AcknowledgeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	closure, err := h.svc.AcknowledgeAlert(ctx, req.AlertID, h.getTenantID(c), req.Operator)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, closure)
}

func (h *Handler) ResolveAlert(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AlertEscResolveAlert")
	defer span.End()
	var req models.ResolveRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	closure, err := h.svc.ResolveAlert(ctx, &req, h.getTenantID(c))
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, closure)
}

// --- Metrics ---

func (h *Handler) GetMetrics(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AlertEscGetMetrics")
	defer span.End()
	closures, err := h.svc.ListClosures(ctx, h.getTenantID(c), "")
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	total := len(closures)
	var ackCount, resolvedCount int
	var totalMTTR int64
	for _, c := range closures {
		if c.AcknowledgedAt != nil {
			ackCount++
		}
		if c.Status == "resolved" {
			resolvedCount++
			totalMTTR += c.MTTRSeconds
		}
	}
	var avgMTTR int64
	if resolvedCount > 0 {
		avgMTTR = totalMTTR / int64(resolvedCount)
	}
	middleware.RespondSuccess(c, gin.H{
		"totalAlerts":       total,
		"acknowledgedCount": ackCount,
		"resolvedCount":     resolvedCount,
		"openCount":         total - ackCount - resolvedCount,
		"avgMTTRSeconds":    avgMTTR,
		"avgMTTRFormatted":  formatSeconds(avgMTTR),
	})
}

func formatSeconds(s int64) string {
	if s < 60 {
		return fmt.Sprintf("%ds", s)
	}
	if s < 3600 {
		return fmt.Sprintf("%dm%ds", s/60, s%60)
	}
	return fmt.Sprintf("%dh%dm", s/3600, (s%3600)/60)
}
