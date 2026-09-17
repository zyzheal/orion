package handler

import (
	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"orion/platform-svc-go/internal/middleware"
	"orion/platform-svc-go/internal/ticketing/models"
)

// AddAssignmentRule adds a new assignment rule.
func (h *Handler) AddAssignmentRule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AddAssignmentRule")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateAssignmentRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	r, err := h.svc.AddAssignmentRule(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, r)
}

// GetAssignmentRules lists all assignment rules for the tenant.
func (h *Handler) GetAssignmentRules(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetAssignmentRules")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	rules, err := h.svc.GetAssignmentRules(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, rules)
}

// RemoveAssignmentRule removes an assignment rule by its UUID.
// ticketing_assignment_rules.id is UUID PRIMARY KEY in 655, so the numeric
// coercion that used to sit here turned every id the database actually holds
// into a 400 "invalid rule id" before the delete could run.
func (h *Handler) RemoveAssignmentRule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RemoveAssignmentRule")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if id == "" {
		middleware.RespondBadRequest(c, "missing rule id")
		return
	}
	if err := h.svc.RemoveAssignmentRule(ctx, tenantID, id); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "assignment rule removed"})
}
