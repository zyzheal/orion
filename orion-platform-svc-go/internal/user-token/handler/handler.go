package handler

import (
	"net/http"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/middleware"
	"orion/go-common/pkg/errors"
	"orion/platform-svc-go/internal/user-token/models"
	"orion/platform-svc-go/internal/user-token/service"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel/trace"
	"orion/go-common/pkg/sentinel"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	r := rg.Group("/user-token")
	r.GET("/:id/tokens", auth.RequirePermission("user-token", "read"), h.GetTokens)
	r.POST("/:id/tokens", auth.RequirePermission("user-token", "write"), h.CreateToken)
	r.DELETE("/:id/tokens/:tokenId", auth.RequirePermission("user-token", "delete"), h.DeleteToken)
}

func (h *Handler) GetTokens(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetTokens")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx := ctx
	userID := c.Param("id")
	tokens, err := h.svc.GetTokens(ctx, tenantID, userID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, "failed to get tokens", http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, tokens)
}

func (h *Handler) CreateToken(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateToken")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx := ctx
	var req models.CreateTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, "invalid request body", http.StatusBadRequest)
		return
	}
	req.UserID = c.Param("id")
	resp, err := h.svc.CreateToken(ctx, tenantID, req)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	middleware.RespondCreated(c, gin.H{"success": true, "data": resp})
}

func (h *Handler) DeleteToken(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteToken")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx := ctx
	tokenID := c.Param("tokenId")
	err := h.svc.DeleteToken(ctx, tenantID, tokenID)
	if err != nil {
		errors.WriteError(c, errors.ErrNotFound, "token not found", http.StatusNotFound)
		return
	}
	errors.WriteSuccess(c, nil)
}
