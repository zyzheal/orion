package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"

	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/errors"
	"orion/platform-svc-go/internal/user-role/models"
	"orion/platform-svc-go/internal/user-role/service"
)

// Handler 暴露 user_role 的 HTTP 端点。
type Handler struct {
	svc service.ServiceInterface
}

// NewHandler 创建新的 Handler 实例。
func NewHandler(svc service.ServiceInterface) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes 挂载 user_role 全部路由。
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.POST("/user-roles", auth.RequirePermission("user-role", "write"), h.Grant)
	rg.GET("/user-roles", auth.RequirePermission("user-role", "read"), h.List)
	rg.GET("/user-roles/:id", auth.RequirePermission("user-role", "read"), h.Get)
	rg.PATCH("/user-roles/:id", auth.RequirePermission("user-role", "write"), h.Patch)
	rg.DELETE("/user-roles/:id", auth.RequirePermission("user-role", "write"), h.Delete)
	rg.POST("/users/:user_id/roles", auth.RequirePermission("user-role", "write"), h.BatchGrant)
}

// Grant POST /api/v1/user-roles
func (h *Handler) Grant(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UserRole.Grant")
	defer span.End()

	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	var id *string
	if userID != "" {
		id = &userID
	}

	var req models.GrantRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), http.StatusBadRequest)
		return
	}
	if req.TenantID == "" {
		req.TenantID = tenantID
	}
	if req.GrantedBy == nil {
		req.GrantedBy = id
	}

	ur, err := h.svc.Grant(ctx, &req, id)
	if err != nil {
		switch {
		case err == service.ErrAlreadyExists:
			errors.WriteError(c, errors.ErrConflict, err.Error(), http.StatusConflict)
		case err == service.ErrGrantBySelf:
			errors.WriteError(c, errors.ErrForbidden, err.Error(), http.StatusForbidden)
		default:
			errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		}
		return
	}
	errors.WriteCreated(c, ur)
}

// List GET /api/v1/user-roles
func (h *Handler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UserRole.List")
	defer span.End()

	tenantID := c.GetString("tenant_id")

	filter := &models.ListFilter{}
	if v := c.Query("user_id"); v != "" {
		filter.UserID = &v
	}
	if v := c.Query("role"); v != "" {
		filter.Role = &v
	}
	if v := c.Query("status"); v != "" {
		filter.Status = &v
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "50"))

	result, err := h.svc.List(ctx, tenantID, filter, page, pageSize)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": result})
}

// Get GET /api/v1/user-roles/:id
func (h *Handler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UserRole.Get")
	defer span.End()

	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	ur, err := h.svc.GetByID(ctx, tenantID, id)
	if err != nil {
		if err == service.ErrNotFound {
			errors.WriteError(c, errors.ErrNotFound, err.Error(), http.StatusNotFound)
			return
		}
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": ur})
}

// Patch PATCH /api/v1/user-roles/:id
func (h *Handler) Patch(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UserRole.Patch")
	defer span.End()

	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	var req models.PatchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), http.StatusBadRequest)
		return
	}

	ur, err := h.svc.Patch(ctx, tenantID, id, &req)
	if err != nil {
		if err == service.ErrInvalidStatus {
			errors.WriteError(c, errors.ErrBadRequest, err.Error(), http.StatusBadRequest)
			return
		}
		if err == service.ErrNotFound {
			errors.WriteError(c, errors.ErrNotFound, err.Error(), http.StatusNotFound)
			return
		}
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": ur})
}

// Delete DELETE /api/v1/user-roles/:id
func (h *Handler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UserRole.Delete")
	defer span.End()

	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	if err := h.svc.Delete(ctx, tenantID, id); err != nil {
		if err == service.ErrNotFound || err == service.ErrRevoked {
			errors.WriteError(c, errors.ErrNotFound, err.Error(), http.StatusNotFound)
			return
		}
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"id": id, "status": models.StatusRevoked}})
}

// BatchGrant POST /api/v1/users/:user_id/roles
func (h *Handler) BatchGrant(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UserRole.BatchGrant")
	defer span.End()

	tenantID := c.GetString("tenant_id")
	userID := c.Param("user_id")

	var body struct {
		Req    models.BatchGrantRequest `json:"grants"`
		ByUser string                   `json:"granted_by"`
		Reason *string                  `json:"reason"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), http.StatusBadRequest)
		return
	}

	var by *string
	if body.ByUser != "" {
		by = &body.ByUser
	}

	var results []gin.H
	for _, item := range body.Req.Grants {
		req := &models.GrantRequest{
			UserID:    userID,
			Role:      item.Role,
			TenantID:  tenantID,
			GrantedBy: by,
			ExpiresAt: item.ExpiresAt,
			Reason:    body.Reason,
		}
		ur, err := h.svc.Grant(ctx, req, by)
		if err != nil {
			results = append(results, gin.H{"role": item.Role, "status": "failed", "error": err.Error()})
			continue
		}
		results = append(results, gin.H{"role": item.Role, "status": "ok", "id": ur.ID})
	}

	c.JSON(http.StatusMultiStatus, gin.H{"data": results})
}
