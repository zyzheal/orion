package handler

import (

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/environment/models"
	"orion/platform-svc-go/internal/environment/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
	"go.opentelemetry.io/otel"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/environments")
	f.POST("", auth.RequirePermission("environment", "write"), h.Create)
	f.GET("", auth.RequirePermission("environment", "read"), h.List)
	f.GET("/:id", auth.RequirePermission("environment", "read"), h.Get)
	f.PUT("/:id", auth.RequirePermission("environment", "write"), h.Update)
	f.DELETE("/:id", auth.RequirePermission("environment", "delete"), h.Delete)
	f.POST("/:id/status", auth.RequirePermission("environment", "write"), h.UpdateStatus)
	f.POST("/:id/lock", auth.RequirePermission("environment", "manage"), h.Lock)
	f.POST("/:id/unlock", auth.RequirePermission("environment", "manage"), h.Unlock)
	f.GET("/:id/lock-status", auth.RequirePermission("environment", "read"), h.GetLockStatus)
	f.GET("/:id/deployment-allowed", auth.RequirePermission("environment", "read"), h.CheckDeploymentAllowed)
}

func (h *Handler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Create")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	createdBy := c.GetString("user_id")
	var req models.CreateEnvironmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	env, err := h.svc.Create(ctx, tenantID, createdBy, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, env)
}

func (h *Handler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "List")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	projectID := c.Query("projectId")
	envs, err := h.svc.List(ctx, tenantID, projectID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, envs)
}

func (h *Handler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Get")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	env, err := h.svc.GetByID(ctx, tenantID, c.Param("id"))
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, env)
}

func (h *Handler) Update(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Update")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	updatedBy := c.GetString("user_id")
	var req models.UpdateEnvironmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	env, err := h.svc.Update(ctx, tenantID, c.Param("id"), updatedBy, &req)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, env)
}

func (h *Handler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Delete")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if err := h.svc.Delete(ctx, tenantID, c.Param("id")); err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "deleted"})
}

func (h *Handler) UpdateStatus(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateStatus")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.UpdateStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	env, err := h.svc.UpdateStatus(ctx, tenantID, c.Param("id"), req.Status)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, env)
}

func (h *Handler) Lock(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Lock")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	env, err := h.svc.Lock(ctx, tenantID, c.Param("id"))
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, env)
}

func (h *Handler) Unlock(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Unlock")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	env, err := h.svc.Unlock(ctx, tenantID, c.Param("id"))
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, env)
}

func (h *Handler) GetLockStatus(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetLockStatus")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	locked, err := h.svc.GetLockStatus(ctx, tenantID, c.Param("id"))
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"locked": locked})
}

func (h *Handler) CheckDeploymentAllowed(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CheckDeploymentAllowed")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	allowed, err := h.svc.CheckDeploymentAllowed(ctx, tenantID, c.Param("id"))
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"allowed": allowed})
}
