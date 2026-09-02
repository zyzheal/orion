package handler

import (
	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/identity/role/models"
	"orion/platform-svc-go/internal/identity/role/service"
	"orion/platform-svc-go/internal/middleware"
)

type RoleHandler struct{ svc *service.RoleService }

func NewRoleHandler(svc *service.RoleService) *RoleHandler {
	return &RoleHandler{svc: svc}
}

func (h *RoleHandler) GetTenantID(c *gin.Context) string { return c.GetString("tenantId") }

func (h *RoleHandler) RegisterRoutes(rg *gin.RouterGroup) {
	r := rg.Group("/roles")
	r.GET("", auth.RequirePermission("identity", "read"), h.List)
	r.POST("", auth.RequirePermission("identity", "write"), h.Create)
	r.GET("/:id", auth.RequirePermission("identity", "read"), h.Get)
	r.PUT("/:id", auth.RequirePermission("identity", "write"), h.Update)
	r.DELETE("/:id", auth.RequirePermission("identity", "delete"), h.Delete)
}

func (h *RoleHandler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListRoles")
	defer span.End()
	roles, err := h.svc.ListRoles(ctx, h.GetTenantID(c))
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, roles)
}

func (h *RoleHandler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateRole")
	defer span.End()
	var req models.CreateRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	role, err := h.svc.CreateRole(ctx, h.GetTenantID(c), &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, role)
}

func (h *RoleHandler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetRole")
	defer span.End()
	role, err := h.svc.GetRole(ctx, h.GetTenantID(c), c.Param("id"))
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, role)
}

func (h *RoleHandler) Update(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateRole")
	defer span.End()
	var req models.UpdateRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	role, err := h.svc.UpdateRole(ctx, h.GetTenantID(c), c.Param("id"), &req)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, role)
}

func (h *RoleHandler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteRole")
	defer span.End()
	if err := h.svc.DeleteRole(ctx, h.GetTenantID(c), c.Param("id")); err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondNoContent(c)
}
