package handler

import (
	"net/http"
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/middleware"
	"orion/platform-svc-go/internal/sso/models"
	"orion/platform-svc-go/internal/sso/service"

	"orion/go-common/pkg/errors"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	r := rg.Group("/sso")
	r.GET("/providers", auth.RequirePermission("sso", "read"), h.ListProviders)
	r.GET("/providers/:id", auth.RequirePermission("sso", "read"), h.GetProvider)
	r.POST("/providers", auth.RequirePermission("sso", "write"), h.CreateProvider)
	r.PUT("/providers/:id", auth.RequirePermission("sso", "write"), h.UpdateProvider)
	r.POST("/login", auth.RequirePermission("sso", "write"), h.InitiateLogin)
	r.GET("/callback/:id", auth.RequirePermission("sso", "read"), h.HandleCallback)
}

func (h *Handler) CreateProvider(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateProvider")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var provider models.SSOProvider
	if err := c.ShouldBindJSON(&provider); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	result, err := h.svc.CreateProvider(ctx, tenantID, &provider)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteCreated(c, result)
}

func (h *Handler) GetProvider(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetProvider")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	result, err := h.svc.GetProvider(ctx, tenantID, id)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, result)
}

func (h *Handler) HandleCallback(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "HandleCallback")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	_ = c.Param("id")
	state := c.Query("state")
	userID := c.Query("userID")
	result, err := h.svc.HandleCallback(ctx, tenantID, state, userID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, result)
}

func (h *Handler) InitiateLogin(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InitiateLogin")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.SSOLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	result, err := h.svc.InitiateLogin(ctx, tenantID, &req)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, result)
}

func (h *Handler) ListProviders(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListProviders")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	q := models.ListProvidersQuery{Limit: limit, Offset: offset}
	result, total, err := h.svc.ListProviders(ctx, tenantID, q)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	middleware.RespondPaginated(c, result, 0, 0, total)
}

func (h *Handler) UpdateProvider(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateProvider")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	if err := h.svc.UpdateProvider(ctx, tenantID, id, updates); err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	c.Status(http.StatusNoContent)
}
