package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/identity/role/models"
	"orion/platform-svc-go/internal/identity/role/service"
	"orion/go-common/pkg/auth"
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
	roles, err := h.svc.ListRoles(c.Request.Context(), h.GetTenantID(c))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": roles})
}

func (h *RoleHandler) Create(c *gin.Context) {
	var req models.CreateRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": err.Error()})
		return
	}
	role, err := h.svc.CreateRole(c.Request.Context(), h.GetTenantID(c), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"code": 0, "data": role})
}

func (h *RoleHandler) Get(c *gin.Context) {
	role, err := h.svc.GetRole(c.Request.Context(), h.GetTenantID(c), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": role})
}

func (h *RoleHandler) Update(c *gin.Context) {
	var req models.UpdateRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": err.Error()})
		return
	}
	role, err := h.svc.UpdateRole(c.Request.Context(), h.GetTenantID(c), c.Param("id"), &req)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": role})
}

func (h *RoleHandler) Delete(c *gin.Context) {
	if err := h.svc.DeleteRole(c.Request.Context(), h.GetTenantID(c), c.Param("id")); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": err.Error()})
		return
	}
	c.JSON(http.StatusNoContent, nil)
}
