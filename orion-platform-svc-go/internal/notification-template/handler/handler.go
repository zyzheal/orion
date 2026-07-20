package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/notification-template/models"
	"orion/platform-svc-go/internal/notification-template/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
	"go.opentelemetry.io/otel/trace"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all notification-template endpoints under the given group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/notification-templates")

	// GET /notification-templates - List notification templates
	f.GET("", auth.RequirePermission("notification", "read"), h.List)
	// POST /notification-templates - Create notification template
	f.POST("", auth.RequirePermission("notification", "write"), h.Create)
	// GET /notification-templates/count - Count notification templates
	f.GET("/count", auth.RequirePermission("notification", "read"), h.Count)
	// POST /notification-templates/render - Render a template
	f.POST("/render", auth.RequirePermission("notification", "read"), h.Render)
	// GET /notification-templates/:id - Get notification template by ID
	f.GET("/:id", auth.RequirePermission("notification", "read"), h.Get)
	// PUT /notification-templates/:id - Update notification template
	f.PUT("/:id", auth.RequirePermission("notification", "write"), h.Update)
	// DELETE /notification-templates/:id - Delete notification template
	f.DELETE("/:id", auth.RequirePermission("notification", "delete"), h.Delete)
	// POST /notification-templates/:id/preview - Preview a template
	f.POST("/:id/preview", auth.RequirePermission("notification", "read"), h.Preview)
	// POST /notification-templates/:id/duplicate - Duplicate a template
	f.POST("/:id/duplicate", auth.RequirePermission("notification", "write"), h.Duplicate)
}

// getTenantID extracts tenant_id from Gin context, falling back to a zero UUID.
func (h *Handler) getTenantID(c *gin.Context) string {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		return "00000000-0000-0000-0000-000000000000"
	}
	return tenantID
}

// getUserID extracts user_id from Gin context.
func (h *Handler) getUserID(c *gin.Context) string {
	userID := c.GetString("user_id")
	if userID == "" {
		return "00000000-0000-0000-0000-000000000000"
	}
	return userID
}

// List handles GET /notification-templates
func (h *Handler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "List")
	defer span.End()
	tenantID := h.getTenantID(c)

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))

	filter := models.ListFilter{}
	if ch := c.Query("channel"); ch != "" {
		filter.Channel = &ch
	}
	if en := c.Query("enabled"); en != "" {
		enabled := en == "true"
		filter.Enabled = &enabled
	}

	templates, total, _, err := h.svc.List(ctx, tenantID, filter, page, pageSize)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, models.PaginatedResponse{
		Data:     templates,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	})
}

// Create handles POST /notification-templates
func (h *Handler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Create")
	defer span.End()
	var req models.CreateTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	userID := h.getUserID(c)
	tpl, err := h.svc.Create(ctx, tenantID, userID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, tpl)
}

// Get handles GET /notification-templates/:id
func (h *Handler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Get")
	defer span.End()
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	tpl, err := h.svc.Get(ctx, tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "notification template not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, tpl)
}

// Update handles PUT /notification-templates/:id
func (h *Handler) Update(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Update")
	defer span.End()
	id := c.Param("id")
	var req models.UpdateTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	tpl, err := h.svc.Update(ctx, tenantID, id, &req)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "notification template not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, tpl)
}

// Delete handles DELETE /notification-templates/:id
func (h *Handler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Delete")
	defer span.End()
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	deleted, err := h.svc.Delete(ctx, tenantID, id)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if !deleted {
		middleware.RespondNotFound(c, "notification template not found")
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "notification template deleted"})
}

// Count handles GET /notification-templates/count
func (h *Handler) Count(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Count")
	defer span.End()
	tenantID := h.getTenantID(c)
	count, err := h.svc.Count(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"count": count})
}

// Render handles POST /notification-templates/render
func (h *Handler) Render(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Render")
	defer span.End()
	var req models.RenderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	result, err := h.svc.Render(ctx, tenantID, &req)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "notification template not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

// Preview handles POST /notification-templates/:id/preview
func (h *Handler) Preview(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Preview")
	defer span.End()
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	result, err := h.svc.Preview(ctx, tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "notification template not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

// Duplicate handles POST /notification-templates/:id/duplicate
func (h *Handler) Duplicate(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Duplicate")
	defer span.End()
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	userID := h.getUserID(c)
	tpl, err := h.svc.Duplicate(ctx, tenantID, userID, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "notification template not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, tpl)
}
