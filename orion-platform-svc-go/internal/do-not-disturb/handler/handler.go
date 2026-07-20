package handler

import (
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/middleware"
	"orion/platform-svc-go/internal/do-not-disturb/models"
	"orion/platform-svc-go/internal/do-not-disturb/service"

	"github.com/gin-gonic/gin"
	"orion/go-common/pkg/errors"
	"go.opentelemetry.io/otel"
	"orion/go-common/pkg/sentinel"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/do-not-disturb")

	f.POST("", auth.RequirePermission("do-not-disturb", "write"), h.Create)
	f.GET("", auth.RequirePermission("do-not-disturb", "read"), h.Get)
	f.PUT("", auth.RequirePermission("do-not-disturb", "write"), h.Update)
	f.GET("/active", h.IsActive)
}

func (h *Handler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Create")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	var req models.CreateDoNotDisturbRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	result, err := h.svc.Create(ctx, tenantID, userID, &req)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	middleware.RespondCreated(c, result)
}

func (h *Handler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Get")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	result, err := h.svc.Get(ctx, tenantID, userID)
	if err != nil {
		errors.WriteError(c, errors.ErrNotFound, "dnd schedule not found", 404)
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) Update(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Update")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	var req models.UpdateDoNotDisturbRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	result, err := h.svc.Update(ctx, tenantID, userID, &req)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) IsActive(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "IsActive")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	active, err := h.svc.IsActive(ctx, tenantID, userID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, gin.H{"active": active})
}