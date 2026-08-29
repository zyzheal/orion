package handler

import (
	"go.opentelemetry.io/otel"
	"orion/platform-svc-go/internal/ci-cd/pipeline/models"
	"orion/platform-svc-go/internal/ci-cd/pipeline/service"

	"github.com/gin-gonic/gin"
)

type RBACHandler struct {
	svc *service.RBACService
}

func NewRBACHandler(svc *service.RBACService) *RBACHandler {
	return &RBACHandler{svc: svc}
}

func (h *RBACHandler) Grant(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PipelineGrant")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	pipelineID := c.Param("pipelineId")

	var req models.GrantAccessRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	if err := h.svc.Grant(ctx, tenantID, pipelineID, req.UserID, req.Role); err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, gin.H{"message": "granted"})
}

func (h *RBACHandler) Revoke(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PipelineRevoke")
	defer span.End()
	pipelineID := c.Param("pipelineId")
	userID := c.Param("userId")

	if err := h.svc.Revoke(ctx, pipelineID, userID); err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, gin.H{"message": "revoked"})
}

func (h *RBACHandler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PipelineList")
	defer span.End()
	pipelineID := c.Param("pipelineId")

	entries, err := h.svc.List(ctx, pipelineID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, entries)
}

func (h *RBACHandler) Check(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PipelineCheck")
	defer span.End()
	pipelineID := c.Param("pipelineId")
	userID := c.Query("user_id")
	role := c.Query("role")

	if userID == "" || role == "" {
		respondBadRequest(c, "user_id and role are required")
		return
	}

	hasAccess, err := h.svc.Check(ctx, pipelineID, userID, role)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, gin.H{"has_access": hasAccess})
}

func (h *RBACHandler) GetUserRole(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PipelineGetUserRole")
	defer span.End()
	pipelineID := c.Param("pipelineId")
	userID := c.Param("userId")

	role, err := h.svc.GetUserRole(ctx, pipelineID, userID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, gin.H{"role": role})
}

func (h *RBACHandler) RegisterRoutes(rg *gin.RouterGroup) {
	rbac := rg.Group("/pipelines/:pipelineId/rbac")
	{
		rbac.POST("", h.Grant)
		rbac.GET("", h.List)
		rbac.GET("/check", h.Check)
		rbac.GET("/:userId", h.GetUserRole)
		rbac.DELETE("/:userId", h.Revoke)
	}
}
