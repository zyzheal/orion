package handler

import (
	"context"
	"errors"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/env-profile/models"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
)

// Sentinel errors used by the service layer.
var (
	ErrNotFound   = errors.New("not found")
	ErrBadRequest = errors.New("bad request")
)

// Service defines the contract the handler needs from the service layer (for testability).
type Service interface {
	Create(ctx context.Context, tenantID string, req *models.CreateEnvProfileRequest) (*models.EnvProfile, error)
	Get(ctx context.Context, tenantID, id string) (*models.EnvProfile, error)
	List(ctx context.Context, tenantID string) ([]models.EnvProfile, error)
	Update(ctx context.Context, tenantID, id string, req *models.UpdateEnvProfileRequest) (*models.EnvProfile, error)
	Delete(ctx context.Context, tenantID, id string) error
}

func isNotFound(err error) bool {
	return errors.Is(err, ErrNotFound)
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
	f := rg.Group("/env-profile")

	f.GET("", auth.RequirePermission("env-profile", "read"), h.List)
	f.POST("", auth.RequirePermission("env-profile", "write"), h.Create)
	f.GET("/:id", auth.RequirePermission("env-profile", "read"), h.Get)
	f.PUT("/:id", auth.RequirePermission("env-profile", "write"), h.Update)
	f.DELETE("/:id", auth.RequirePermission("env-profile", "delete"), h.Delete)
}

func (h *Handler) List(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	result, err := h.svc.List(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) Create(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateEnvProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.Create(c.Request.Context(), tenantID, &req)
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
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	result, err := h.svc.Get(c.Request.Context(), tenantID, id)
	if err != nil {
		if isNotFound(err) {
			middleware.RespondNotFound(c, "env-profile not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) Update(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateEnvProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.Update(c.Request.Context(), tenantID, id, &req)
	if err != nil {
		if isNotFound(err) {
			middleware.RespondNotFound(c, "env-profile not found")
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
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	err := h.svc.Delete(c.Request.Context(), tenantID, id)
	if err != nil {
		if isNotFound(err) {
			middleware.RespondNotFound(c, "env-profile not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "env-profile deleted"})
}
