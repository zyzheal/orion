package handler

import (
	"context"
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/cmdb-validator/models"
	"orion/platform-svc-go/internal/middleware"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
)

// Service defines the methods the handler calls on the service layer.
type Service interface {
	CreateRule(ctx context.Context, tenantID string, req *models.CreateRuleRequest) (*models.CMDBValidationRule, error)
	GetRule(ctx context.Context, tenantID, id string) (*models.CMDBValidationRule, error)
	ListRules(ctx context.Context, tenantID, category string, offset, limit int) ([]models.CMDBValidationRule, error)
	UpdateRule(ctx context.Context, tenantID, id string, req *models.UpdateRuleRequest) (*models.CMDBValidationRule, error)
	DeleteRule(ctx context.Context, tenantID, id string) error
	Validate(ctx context.Context, tenantID, targetType, targetID string, data map[string]interface{}) ([]models.CMDBValidationResult, error)
	ValidateCI(ctx context.Context, tenantID string, ci map[string]interface{}) ([]models.CMDBValidationResult, error)
	ValidateRelationship(ctx context.Context, tenantID string, relation map[string]interface{}) ([]models.CMDBValidationResult, error)
	GetValidationHistory(ctx context.Context, tenantID, targetID string, limit int) ([]models.CMDBValidationResult, error)
}

// Handler exposes HTTP endpoints for CMDB validation.
type Handler struct {
	svc Service
}

// NewHandler creates a new Handler instance.
func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes mounts all CMDB validator routes onto the given router group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	// Rule management
	rg.POST("/validators/rules", auth.RequirePermission("cmdb-validator", "write"), h.CreateRule)
	rg.GET("/validators/rules", auth.RequirePermission("cmdb-validator", "read"), h.ListRules)
	rg.GET("/validators/rules/:id", auth.RequirePermission("cmdb-validator", "read"), h.GetRule)
	rg.PUT("/validators/rules/:id", auth.RequirePermission("cmdb-validator", "write"), h.UpdateRule)
	rg.DELETE("/validators/rules/:id", auth.RequirePermission("cmdb-validator", "delete"), h.DeleteRule)

	// Validation execution
	rg.POST("/validators/validate", auth.RequirePermission("cmdb-validator", "write"), h.Validate)
	rg.POST("/validators/validate-ci", auth.RequirePermission("cmdb-validator", "write"), h.ValidateCI)
	rg.POST("/validators/validate-relationship", auth.RequirePermission("cmdb-validator", "write"), h.ValidateRelationship)

	// Validation history
	rg.GET("/validators/results/:targetId", auth.RequirePermission("cmdb-validator", "read"), h.GetValidationHistory)
}

// CreateRule creates a new validation rule.
func (h *Handler) CreateRule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CMDBValidator.CreateRule")
	defer span.End()
	tenantID := c.GetString("tenant_id")

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

// GetRule retrieves a validation rule by ID.
func (h *Handler) GetRule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CMDBValidator.GetRule")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ruleID := c.Param("id")

	rule, err := h.svc.GetRule(ctx, tenantID, ruleID)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, rule)
}

// ListRules lists validation rules with optional category filter.
func (h *Handler) ListRules(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CMDBValidator.ListRules")
	defer span.End()
	tenantID := c.GetString("tenant_id")

	category := c.Query("category")
	offset := 0
	limit := 100
	if l := c.Query("limit"); l != "" {
		limit, _ = strconv.Atoi(l)
		if limit <= 0 || limit > 500 {
			limit = 100
		}
	}
	if o := c.Query("offset"); o != "" {
		offset, _ = strconv.Atoi(o)
		if offset < 0 {
			offset = 0
		}
	}

	rules, err := h.svc.ListRules(ctx, tenantID, category, offset, limit)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, rules)
}

// UpdateRule updates an existing rule.
func (h *Handler) UpdateRule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CMDBValidator.UpdateRule")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ruleID := c.Param("id")

	var req models.UpdateRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	rule, err := h.svc.UpdateRule(ctx, tenantID, ruleID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, rule)
}

// DeleteRule removes a rule by ID.
func (h *Handler) DeleteRule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CMDBValidator.DeleteRule")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ruleID := c.Param("id")

	if err := h.svc.DeleteRule(ctx, tenantID, ruleID); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondNoContent(c)
}

// Validate runs validation against arbitrary data.
func (h *Handler) Validate(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CMDBValidator.Validate")
	defer span.End()
	tenantID := c.GetString("tenant_id")

	var req models.ValidateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	results, err := h.svc.Validate(ctx, tenantID, req.TargetType, req.TargetID, req.Data)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}

	summary := summarizeResults(results)
	middleware.RespondSuccess(c, summary)
}

// ValidateCI validates a CI record.
func (h *Handler) ValidateCI(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CMDBValidator.ValidateCI")
	defer span.End()
	tenantID := c.GetString("tenant_id")

	var req models.ValidateCIRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	results, err := h.svc.ValidateCI(ctx, tenantID, req.Data)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}

	summary := summarizeResults(results)
	middleware.RespondSuccess(c, summary)
}

// ValidateRelationship validates a CI relationship.
func (h *Handler) ValidateRelationship(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CMDBValidator.ValidateRelationship")
	defer span.End()
	tenantID := c.GetString("tenant_id")

	var req models.ValidateRelationshipRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	results, err := h.svc.ValidateRelationship(ctx, tenantID, req.Data)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}

	summary := summarizeResults(results)
	middleware.RespondSuccess(c, summary)
}

// GetValidationHistory retrieves validation history for a target.
func (h *Handler) GetValidationHistory(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CMDBValidator.GetValidationHistory")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	targetID := c.Param("targetId")

	limit := 50
	if l := c.Query("limit"); l != "" {
		limit, _ = strconv.Atoi(l)
		if limit <= 0 || limit > 200 {
			limit = 50
		}
	}

	history, err := h.svc.GetValidationHistory(ctx, tenantID, targetID, limit)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, history)
}

// summarizeResults aggregates validation results into a summary.
func summarizeResults(results []models.CMDBValidationResult) models.ValidationResultSummary {
	summary := models.ValidationResultSummary{
		Results: results,
	}
	for _, r := range results {
		switch r.Status {
		case "pass":
			summary.Passed++
		case "warning":
			summary.Warning++
		case "fail":
			summary.Failed++
		}
	}
	return summary
}
