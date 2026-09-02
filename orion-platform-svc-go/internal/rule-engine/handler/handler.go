package handler

import (
	"go.opentelemetry.io/otel"

	"github.com/gin-gonic/gin"
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/middleware"
	"orion/platform-svc-go/internal/rule-engine/models"
	"orion/platform-svc-go/internal/rule-engine/service"
)

type RuleEngineHandler struct {
	svc *service.RuleEngineService
}

func NewRuleEngineHandler(svc *service.RuleEngineService) *RuleEngineHandler {
	return &RuleEngineHandler{svc: svc}
}

func (h *RuleEngineHandler) GetTenantID(c *gin.Context) string {
	return c.GetString("tenantId")
}

func (h *RuleEngineHandler) RegisterRoutes(rg *gin.RouterGroup) {
	rules := rg.Group("/rule-engine/rules")
	rules.GET("", auth.RequirePermission("ai", "read"), h.ListRules)
	rules.POST("", auth.RequirePermission("ai", "write"), h.CreateRule)
	rules.GET("/:id", auth.RequirePermission("ai", "read"), h.GetRule)
	rules.PUT("/:id", auth.RequirePermission("ai", "write"), h.UpdateRule)
	rules.DELETE("/:id", auth.RequirePermission("ai", "delete"), h.DeleteRule)
	rg.POST("/rule-engine/evaluate", auth.RequirePermission("ai", "execute"), h.Evaluate)
}

func (h *RuleEngineHandler) ListRules(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListRuleEngineRules")
	defer span.End()
	tenantID := h.GetTenantID(c)
	resp, err := h.svc.QueryRules(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"total": resp.Total, "data": resp.Data})
}

func (h *RuleEngineHandler) CreateRule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateRuleEngineRule")
	defer span.End()
	tenantID := h.GetTenantID(c)
	var req models.CreateRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	rule, err := h.svc.CreateRule(ctx, tenantID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, rule)
}

func (h *RuleEngineHandler) GetRule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetRuleEngineRule")
	defer span.End()
	tenantID := h.GetTenantID(c)
	id := c.Param("id")
	rule, err := h.svc.GetRule(ctx, tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, rule)
}

func (h *RuleEngineHandler) UpdateRule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateRuleEngineRule")
	defer span.End()
	tenantID := h.GetTenantID(c)
	id := c.Param("id")
	var req struct {
		Name        *string `json:"name"`
		Description *string `json:"description"`
		Priority    *int    `json:"priority"`
		IsEnabled   *bool   `json:"is_enabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	rule, err := h.svc.UpdateRule(ctx, tenantID, id, req.Name, req.Description, req.Priority, req.IsEnabled)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, rule)
}

func (h *RuleEngineHandler) DeleteRule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteRuleEngineRule")
	defer span.End()
	tenantID := h.GetTenantID(c)
	id := c.Param("id")
	if err := h.svc.DeleteRule(ctx, tenantID, id); err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondNoContent(c)
}

func (h *RuleEngineHandler) Evaluate(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "EvaluateRuleEngine")
	defer span.End()
	tenantID := h.GetTenantID(c)
	var req models.EvaluateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.Evaluate(ctx, tenantID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}
