package handler

import (
	"go.opentelemetry.io/otel"
	"orion/go-common/pkg/auth"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/ticket/models"
	"orion/platform-svc-go/internal/ticket/service"
)

type AutomationRuleHandler struct {
	svc *service.AutomationRuleService
}

func NewAutomationRuleHandler(svc *service.AutomationRuleService) *AutomationRuleHandler {
	return &AutomationRuleHandler{svc: svc}
}

func (h *AutomationRuleHandler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.POST("/ticketing/automation/rules", auth.RequirePermission("ticket", "write"), h.CreateRule)
	rg.GET("/ticketing/automation/rules", auth.RequirePermission("ticket", "read"), h.ListRules)
	rg.PUT("/ticketing/automation/rules/:ruleId", auth.RequirePermission("ticket", "write"), h.UpdateRule)
	rg.DELETE("/ticketing/automation/rules/:ruleId", auth.RequirePermission("ticket", "delete"), h.DeleteRule)
	rg.POST("/ticketing/automation/rules/:ruleId/execute", auth.RequirePermission("ticket", "write"), h.ExecuteRule)
}

func (h *AutomationRuleHandler) CreateRule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketCreateRule")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	createdBy := GetUserID(c)

	var req models.CreateAutomationRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	rule, err := h.svc.Create(ctx, tenantID, createdBy, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, rule)
}

func (h *AutomationRuleHandler) ListRules(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketListRules")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	enabled := c.Query("enabled")
	var enabledFilter *bool
	if enabled != "" {
		val := enabled == "true"
		enabledFilter = &val
	}
	rules, err := h.svc.List(ctx, tenantID, enabledFilter)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, rules)
}

func (h *AutomationRuleHandler) GetRule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketGetRule")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ruleID := c.Param("ruleId")
	rule, err := h.svc.Get(ctx, tenantID, ruleID)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, rule)
}

func (h *AutomationRuleHandler) UpdateRule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketUpdateRule")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ruleID := c.Param("ruleId")
	var req models.UpdateAutomationRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	rule, err := h.svc.Update(ctx, tenantID, ruleID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, rule)
}

func (h *AutomationRuleHandler) DeleteRule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketDeleteRule")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ruleID := c.Param("ruleId")
	if err := h.svc.Delete(ctx, tenantID, ruleID); err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "deleted"})
}

func (h *AutomationRuleHandler) ExecuteRule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketExecuteRule")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ruleID := c.Param("ruleId")
	var req models.ExecuteRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	triggeredBy := "manual"
	if req.TriggeredBy != "" {
		triggeredBy = req.TriggeredBy
	}
	execution, err := h.svc.Execute(ctx, tenantID, ruleID, req.TicketID, triggeredBy, req.TicketData)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, execution)
}
