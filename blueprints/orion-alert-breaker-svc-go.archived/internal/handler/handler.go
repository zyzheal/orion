package handler

import (
	"net/http"

	"orion-alert-breaker-svc-go/internal/models"
	"orion-alert-breaker-svc-go/internal/service"

	"orion/go-common/pkg/auth"

	"github.com/gin-gonic/gin"
)

// Handler exposes HTTP endpoints for alert breaker rules.
type Handler struct {
	svc *service.AlertBreakerService
}

// NewHandler creates a new Handler.
func NewHandler(svc *service.AlertBreakerService) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes mounts all alert-breaker endpoints.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	ab := rg.Group("/alert-breakers")
	{
		ab.GET("", h.ListRules)
		ab.POST("", auth.RequirePermission("alert-breaker", "write"), h.CreateRule)
		ab.GET("/:id", h.GetRule)
		ab.PUT("/:id", auth.RequirePermission("alert-breaker", "write"), h.UpdateRule)
		ab.DELETE("/:id", auth.RequirePermission("alert-breaker", "delete"), h.DeleteRule)
		ab.POST("/evaluate", auth.RequirePermission("alert-breaker", "execute"), h.Evaluate)
	}
}

func (h *Handler) CreateRule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		respondBadRequest(c, "tenant_id is required")
		return
	}
	var req models.CreateRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	actor := c.GetString("user_id")
	rule, err := h.svc.CreateRule(c.Request.Context(), tenantID, &req, actor)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, rule)
}

func (h *Handler) GetRule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	rule, err := h.svc.GetRule(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		respondNotFound(c, "rule not found")
		return
	}
	respondSuccess(c, rule)
}

func (h *Handler) ListRules(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	rules, err := h.svc.ListRules(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, rules)
}

func (h *Handler) UpdateRule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.UpdateRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	rule, err := h.svc.UpdateRule(c.Request.Context(), tenantID, c.Param("id"), &req)
	if err != nil {
		respondNotFound(c, "rule not found")
		return
	}
	respondSuccess(c, rule)
}

func (h *Handler) DeleteRule(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.DeleteRule(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		respondNotFound(c, "rule not found")
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *Handler) Evaluate(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.EvaluateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.EvaluateRule(c.Request.Context(), tenantID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, result)
}
