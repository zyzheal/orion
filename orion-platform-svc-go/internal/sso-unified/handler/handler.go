package handler

import (
        "orion/go-common/pkg/auth"
        "orion/platform-svc-go/internal/middleware"
        "orion/platform-svc-go/internal/sso-unified/models"
        "orion/platform-svc-go/internal/sso-unified/service"

        "github.com/gin-gonic/gin"
	"orion/go-common/pkg/errors"
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
        f := rg.Group("/sso-unified")

        f.POST("", auth.RequirePermission("sso-unified", "write"), h.CreateConfig)
        f.GET("", auth.RequirePermission("sso-unified", "read"), h.ListConfigs)
        f.GET("/:provider", auth.RequirePermission("sso-unified", "read"), h.GetConfig)
        f.PUT("/:provider", auth.RequirePermission("sso-unified", "write"), h.UpdateConfig)
        f.DELETE("/:provider", auth.RequirePermission("sso-unified", "delete"), h.DeleteConfig)
}

func (h *Handler) CreateConfig(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateConfig")
	defer span.End()
        tenantID := c.GetString("tenant_id")
        var req models.CreateSSOConfigRequest
        if err := c.ShouldBindJSON(&req); err != nil {
                errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
                return
        }
        result, err := h.svc.Create(ctx, tenantID, &req)
        if err != nil {
                errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
                return
        }
        middleware.RespondCreated(c, result)
}

func (h *Handler) ListConfigs(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListConfigs")
	defer span.End()
        tenantID := c.GetString("tenant_id")
        configs, err := h.svc.GetAll(ctx, tenantID)
        if err != nil {
                errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
                return
        }
        errors.WriteSuccess(c, configs)
}

func (h *Handler) GetConfig(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetConfig")
	defer span.End()
        tenantID := c.GetString("tenant_id")
        provider := c.Param("provider")
        config, err := h.svc.Get(ctx, tenantID, provider)
        if err != nil {
                errors.WriteError(c, errors.ErrNotFound, "config not found", 404)
                return
        }
        middleware.RespondSuccess(c, config)
}

func (h *Handler) UpdateConfig(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateConfig")
	defer span.End()
        tenantID := c.GetString("tenant_id")
        provider := c.Param("provider")
        var req models.UpdateSSOConfigRequest
        if err := c.ShouldBindJSON(&req); err != nil {
                errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
                return
        }
        result, err := h.svc.Update(ctx, tenantID, provider, &req)
        if err != nil {
                errors.WriteError(c, errors.ErrNotFound, "config not found", 404)
                return
        }
        middleware.RespondSuccess(c, result)
}

func (h *Handler) DeleteConfig(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteConfig")
	defer span.End()
        tenantID := c.GetString("tenant_id")
        provider := c.Param("provider")
        deleted, err := h.svc.Delete(ctx, tenantID, provider)
        if err != nil {
                errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
                return
        }
        if !deleted {
                errors.WriteError(c, errors.ErrNotFound, "config not found", 404)
                return
        }
        errors.WriteSuccess(c, gin.H{"message": "config deleted"})
}
