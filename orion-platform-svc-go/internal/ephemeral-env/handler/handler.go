package handler

import (
	"net/http"
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/ephemeral-env/models"
	"orion/platform-svc-go/internal/ephemeral-env/service"

	"github.com/gin-gonic/gin"
	"orion/go-common/pkg/errors"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	r := rg.Group("/ephemeral-env")
r.GET("", auth.RequirePermission("ephemeral-env", "read"), h.ListEnvs)
	r.GET("/:id", auth.RequirePermission("ephemeral-env", "read"), h.GetEnv)
	r.POST("", auth.RequirePermission("ephemeral-env", "write"), h.CreateEnv)
	r.PUT("/:id/extend", auth.RequirePermission("ephemeral-env", "write"), h.ExtendTTL)
	r.DELETE("/:id", auth.RequirePermission("ephemeral-env", "delete"), h.DeleteEnv)
	r.GET("/:id/logs", auth.RequirePermission("ephemeral-env", "read"), h.GetLogs)
	r.POST("/:id/destroy", auth.RequirePermission("ephemeral-env", "delete"), h.DestroyEnv)
}

func (h *Handler) CreateEnv(c *gin.Context) {
	ctx := c.Request.Context()
	tenantID := c.GetString("tenant_id")
	var req models.CreateEphemeralEnvRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	result, err := h.svc.CreateEnv(ctx, tenantID, req)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteCreated(c, result)
}

func (h *Handler) DeleteEnv(c *gin.Context) {
	ctx := c.Request.Context()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.DeleteEnv(ctx, tenantID, id); err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *Handler) DestroyEnv(c *gin.Context) {
	ctx := c.Request.Context()
	tenantID := c.GetString("tenant_id")
id := c.Param("id")
result, err := h.svc.DestroyEnv(ctx, tenantID, id)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
errors.WriteSuccess(c, result)
}

func (h *Handler) ExtendTTL(c *gin.Context) {
	ctx := c.Request.Context()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.ExtendTTLRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	result, err := h.svc.ExtendTTL(ctx, tenantID, id, req)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, result)
}

func (h *Handler) GetEnv(c *gin.Context) {
	ctx := c.Request.Context()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	result, err := h.svc.GetEnv(ctx, tenantID, id)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, result)
}

func (h *Handler) GetLogs(c *gin.Context) {
	ctx := c.Request.Context()
	tenantID := c.GetString("tenant_id")
	envID := c.Param("id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "100"))
	result, err := h.svc.GetLogs(ctx, tenantID, envID, limit)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, result)
}

func (h *Handler) ListEnvs(c *gin.Context) {
	ctx := c.Request.Context()
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	result, err := h.svc.ListEnvs(ctx, tenantID, limit, offset)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, result)
}
