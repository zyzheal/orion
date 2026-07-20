package handler

import (
	"context"
	"errors"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/env-lifecycle/models"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
	"go.opentelemetry.io/otel"
	"orion/go-common/pkg/sentinel"
)

// Sentinel errors used by the service layer, copied here for the Service interface.
var (

	ErrBadRequest = errors.New("bad request")
)

// Service defines the contract the handler needs from the service layer (for testability).
type Service interface {
	Create(ctx context.Context, tenantID string, req *models.CreateEnvLifecycleRequest) (*models.EnvLifecycle, error)
	Get(ctx context.Context, tenantID, id string) (*models.EnvLifecycle, error)
	List(ctx context.Context, tenantID string) ([]models.EnvLifecycle, error)
	Update(ctx context.Context, tenantID, id string, req *models.UpdateEnvLifecycleRequest) (*models.EnvLifecycle, error)
	Delete(ctx context.Context, tenantID, id string) error
}

func isNotFound(err error) bool {
	return errors.Is(err, sentinel.NotFound)
}

func isBadRequest(err error) bool {
	return errors.Is(err, ErrBadRequest)
}

type Handler struct {
	svc Service
}

func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/env-lifecycle")

	f.GET("", auth.RequirePermission("env-lifecycle", "read"), h.List)
	f.POST("", auth.RequirePermission("env-lifecycle", "write"), h.Create)
	f.GET("/:id", auth.RequirePermission("env-lifecycle", "read"), h.Get)
	f.PUT("/:id", auth.RequirePermission("env-lifecycle", "write"), h.Update)
	f.DELETE("/:id", auth.RequirePermission("env-lifecycle", "delete"), h.Delete)
}

func (h *Handler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "List")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	result, err := h.svc.List(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Create")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateEnvLifecycleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.Create(ctx, tenantID, &req)
	if err != nil {
		if isBadRequest(err) {
			middleware.RespondBadRequest(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, result)
}

func (h *Handler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Get")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	result, err := h.svc.Get(ctx, tenantID, id)
	if err != nil {
		if isNotFound(err) {
			middleware.RespondNotFound(c, "env-lifecycle not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) Update(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Update")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateEnvLifecycleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.Update(ctx, tenantID, id, &req)
	if err != nil {
		if isNotFound(err) {
			middleware.RespondNotFound(c, "env-lifecycle not found")
			return
		}
		if isBadRequest(err) {
			middleware.RespondBadRequest(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Delete")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	err := h.svc.Delete(ctx, tenantID, id)
	if err != nil {
		if isNotFound(err) {
			middleware.RespondNotFound(c, "env-lifecycle not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "env-lifecycle deleted"})
}
