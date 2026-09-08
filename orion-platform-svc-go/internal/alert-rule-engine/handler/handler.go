package handler

import (
	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"orion/go-common/pkg/auth"
	alertruleengine "orion/platform-svc-go/internal/alert-rule-engine"
	"orion/platform-svc-go/internal/alert-rule-engine/handler/models"
	"orion/platform-svc-go/internal/alert-rule-engine/service"
	"orion/platform-svc-go/internal/middleware"
)

type Handler struct{ svc *service.Service }

func NewHandler(svc *service.Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	g := rg.Group("/alert-rules")
	g.POST("/compile", auth.RequirePermission("alert", "write"), h.CompileRule)
	g.POST("/:id/update", auth.RequirePermission("alert", "write"), h.UpdateRule)
	g.GET("/stats", auth.RequirePermission("alert", "read"), h.Stats)
	g.POST("/evaluate", auth.RequirePermission("alert", "execute"), h.Evaluate)
	g.POST("/:id/reset-cooldown", auth.RequirePermission("alert", "write"), h.ResetCooldown)
}

func (h *Handler) CompileRule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AlertRuleCompile")
	defer span.End()
	var req models.RuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	resp, err := h.svc.CompileRule(ctx, c.GetString("tenant_id"), &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, resp)
}

func (h *Handler) UnregisterRule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AlertRuleUnregister")
	defer span.End()
	if err := h.svc.UnregisterRule(ctx, c.GetString("tenant_id"), c.Param("id")); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"status": "deleted"})
}

func (h *Handler) GetRule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AlertRuleGet")
	defer span.End()
	resp, err := h.svc.GetRule(ctx, c.GetString("tenant_id"), c.Param("id"))
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, resp)
}

func (h *Handler) ListRules(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AlertRuleList")
	defer span.End()
	group := c.Query("group")
	rules, err := h.svc.ListRules(ctx, c.GetString("tenant_id"), group)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, rules)
}

func (h *Handler) UpdateRule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AlertRuleUpdate")
	defer span.End()
	var req models.RuleUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if err := h.svc.UpdateRule(ctx, c.GetString("tenant_id"), c.Param("id"), &req); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"status": "updated"})
}

func (h *Handler) Stats(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AlertRuleStats")
	defer span.End()
	stats, err := h.svc.Stats(ctx, c.GetString("tenant_id"))
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, stats)
}

func (h *Handler) Evaluate(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AlertRuleEvaluate")
	defer span.End()
	var req struct {
		Metrics []map[string]interface{} `json:"metrics" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	builder := alertruleengine.NewSnapshotBuilder()
	for _, m := range req.Metrics {
		name, _ := m["name"].(string)
		val, _ := m["value"].(float64)
		builder.AddMetric(name, val)
	}
	snapshot := builder.Build()
	results, err := h.svc.Evaluate(ctx, c.GetString("tenant_id"), snapshot)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, results)
}

func (h *Handler) ResetCooldown(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AlertRuleResetCooldown")
	defer span.End()
	if err := h.svc.ResetCooldown(ctx, c.GetString("tenant_id"), c.Param("id")); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"status": "reset"})
}
