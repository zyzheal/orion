package handler

import (
	"errors"

	"orion/platform-svc-go/internal/condition/models"
	"orion/platform-svc-go/internal/condition/service"
	"orion/platform-svc-go/internal/middleware"

	"orion/go-common/pkg/auth"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
)

// Handler handles HTTP requests for the condition module.
type Handler struct {
	eng *service.ConditionEngine
}

// NewHandler creates a new condition handler.
func NewHandler(eng *service.ConditionEngine) *Handler {
	return &Handler{eng: eng}
}

// RegisterRoutes registers all condition endpoints under the /conditions group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/conditions")

	// === Group CRUD ===
	f.POST("/groups", auth.RequirePermission("condition", "write"), h.CreateGroup)
	f.GET("/groups", auth.RequirePermission("condition", "read"), h.ListGroups)
	f.GET("/groups/:id", auth.RequirePermission("condition", "read"), h.GetGroup)
	f.DELETE("/groups/:id", auth.RequirePermission("condition", "delete"), h.DeleteGroup)

	// === Expression CRUD ===
	f.POST("/groups/:id/expressions", auth.RequirePermission("condition", "write"), h.CreateExpression)
	f.GET("/groups/:id/expressions", auth.RequirePermission("condition", "read"), h.ListExpressions)

	// === Evaluation ===
	f.POST("/evaluate", auth.RequirePermission("condition", "write"), h.Evaluate)
}

// ==================== Group CRUD ====================

func (h *Handler) CreateGroup(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateGroup")
	defer span.End()
	tenantID := c.GetString("tenant_id")

	var req models.CreateGroupRequest
	if bindErr := c.ShouldBindJSON(&req); bindErr != nil {
		middleware.RespondBadRequest(c, bindErr.Error())
		return
	}
	group, createErr := h.eng.CreateGroup(ctx, tenantID, req.Name, req.Type, req.Children)
	if createErr != nil {
		if errors.Is(createErr, service.ErrInvalidGroupType) {
			middleware.RespondBadRequest(c, createErr.Error())
			return
		}
		middleware.RespondInternalError(c, createErr.Error())
		return
	}
	middleware.RespondCreated(c, group)
}

func (h *Handler) GetGroup(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetGroup")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	group, err := h.eng.GetGroup(ctx, tenantID, id)
	if err != nil {
		if err == service.ErrGroupNotFound {
			middleware.RespondNotFound(c, "group not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, group)
}

func (h *Handler) ListGroups(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListGroups")
	defer span.End()
	tenantID := c.GetString("tenant_id")

	groups, err := h.eng.ListGroups(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"groups": groups, "total": len(groups)})
}

func (h *Handler) DeleteGroup(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteGroup")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	if err := h.eng.DeleteGroup(ctx, tenantID, id); err != nil {
		if err == service.ErrGroupNotFound {
			middleware.RespondNotFound(c, "group not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "group deleted"})
}

// ==================== Expression CRUD ====================

func (h *Handler) CreateExpression(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateExpression")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	groupID := c.Param("id")

	var req models.CreateExpressionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	expr, err := h.eng.CreateExpression(ctx, tenantID, groupID, req.Field, req.Operator, req.Value)
	if err != nil {
		if errors.Is(err, service.ErrInvalidOperator) || errors.Is(err, service.ErrInvalidField) {
			middleware.RespondBadRequest(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, expr)
}

func (h *Handler) ListExpressions(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListExpressions")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	groupID := c.Param("id")

	exprs, err := h.eng.ListExpressions(ctx, tenantID, groupID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"expressions": exprs, "total": len(exprs)})
}

// ==================== Evaluation ====================

func (h *Handler) Evaluate(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Evaluate")
	defer span.End()
	tenantID := c.GetString("tenant_id")

	var req models.EvaluateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	group, err := h.eng.GetGroup(ctx, tenantID, req.GroupID)
	if err != nil {
		if err == service.ErrGroupNotFound {
			middleware.RespondNotFound(c, "group not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}

	result, err := h.eng.Evaluate(ctx, group, req.Variables)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}

	middleware.RespondSuccess(c, models.EvaluateResult{
		GroupID: req.GroupID,
		Result:  result,
	})
}
