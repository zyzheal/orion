package handler

import (
	"net/http"

	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/errors"
	"orion/platform-svc-go/internal/user-profile/models"
	"orion/platform-svc-go/internal/user-profile/service"

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
	r := rg.Group("/user-profile")
	r.GET("/me", auth.RequirePermission("user-profile", "read"), h.GetMyProfile)
	r.GET("/:id", auth.RequirePermission("user-profile", "read"), h.GetProfile)
	r.PUT("/me", auth.RequirePermission("user-profile", "write"), h.UpdateMyProfile)
	r.PUT("/:id", auth.RequirePermission("user-profile", "write"), h.UpdateProfile)
}

func (h *Handler) GetMyProfile(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetMyProfile")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	ctx := ctx
	p, err := h.svc.GetProfile(ctx, tenantID, userID)
	if err != nil {
		errors.WriteError(c, errors.ErrNotFound, "profile not found", http.StatusNotFound)
		return
	}
	errors.WriteSuccess(c, p)
}

func (h *Handler) GetProfile(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetProfile")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx := ctx
	p, err := h.svc.GetProfile(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrNotFound, "profile not found", http.StatusNotFound)
		return
	}
	errors.WriteSuccess(c, p)
}

func (h *Handler) UpdateMyProfile(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateMyProfile")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	ctx := ctx
	var req models.UpdateProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, "invalid request", http.StatusBadRequest)
		return
	}
	p, err := h.svc.UpdateProfile(ctx, tenantID, userID, req)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, p)
}

func (h *Handler) UpdateProfile(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateProfile")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx := ctx
	var req models.UpdateProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, "invalid request", http.StatusBadRequest)
		return
	}
	p, err := h.svc.UpdateProfile(ctx, tenantID, c.Param("id"), req)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, p)
}
