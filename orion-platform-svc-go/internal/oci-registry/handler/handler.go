package handler

import (
	"net/http"
	"orion/platform-svc-go/internal/middleware"

	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/errors"
	"orion/platform-svc-go/internal/oci-registry/models"
	"orion/platform-svc-go/internal/oci-registry/service"

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
	r := rg.Group("/oci-registry")
	r.GET("", auth.RequirePermission("oci_registry", "read"), h.List)
	r.GET("/:id", auth.RequirePermission("oci_registry", "read"), h.Get)
	r.POST("", auth.RequirePermission("oci_registry", "write"), h.Create)
	r.PUT("/:id", auth.RequirePermission("oci_registry", "write"), h.Update)
	r.DELETE("/:id", auth.RequirePermission("oci_registry", "delete"), h.Delete)
	// Business endpoints
	r.PATCH("/:registryId/enable", auth.RequirePermission("oci_registry", "write"), h.ToggleRegistry)
	r.GET("/repositories/:registryId/:name/tags", auth.RequirePermission("oci_registry", "read"), h.ListTags)
	r.DELETE("/images/:registryId/:name/:digest", auth.RequirePermission("oci_registry", "delete"), h.DeleteImage)
}

func (h *Handler) getTenantID(c *gin.Context) string {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		return "00000000-0000-0000-0000-000000000000"
	}
	return tenantID
}

func (h *Handler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "List")
	defer span.End()
	tenantID := h.getTenantID(c)
	items, err := h.svc.List(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, "internal server error")
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": items, "total": len(items)})
}

func (h *Handler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Get")
	defer span.End()
	tenantID := h.getTenantID(c)
	id := c.Param("id")
	item, err := h.svc.Get(ctx, tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, "not found")
		return
	}
	middleware.RespondSuccess(c, item)
}

func (h *Handler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Create")
	defer span.End()
	tenantID := h.getTenantID(c)
	var req models.CreateOciRegistryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	item, err := h.svc.Create(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, "internal server error")
		return
	}
	errors.WriteCreated(c, item)
}

func (h *Handler) Update(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Update")
	defer span.End()
	tenantID := h.getTenantID(c)
	id := c.Param("id")
	var req models.UpdateOciRegistryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
item, err := h.svc.Update(ctx, tenantID, id, req)
	if err != nil {
		middleware.RespondInternalError(c, "internal server error")
		return
	}
	middleware.RespondSuccess(c, item)
}

func (h *Handler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Delete")
	defer span.End()
	tenantID := h.getTenantID(c)
	id := c.Param("id")
	if err := h.svc.Delete(ctx, tenantID, id); err != nil {
		middleware.RespondInternalError(c, "internal server error")
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "deleted"})
}

func (h *Handler) ToggleRegistry(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ToggleRegistry")
	defer span.End()
	registryID := c.Param("registryId")
	var req models.ToggleRegistryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	result, err := h.svc.ToggleRegistry(ctx, tenantID, registryID, &req)
	if err != nil {
		middleware.RespondInternalError(c, "internal server error")
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) ListTags(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListTags")
	defer span.End()
	registryID := c.Param("registryId")
	name := c.Param("name")
	var q models.TagsQuery
	if err := c.ShouldBindQuery(&q); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	result, err := h.svc.ListTags(ctx, tenantID, registryID, name, &q)
	if err != nil {
		middleware.RespondInternalError(c, "internal server error")
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) DeleteImage(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteImage")
	defer span.End()
	registryID := c.Param("registryId")
	name := c.Param("name")
	digest := c.Param("digest")
	tenantID := h.getTenantID(c)
	if err := h.svc.DeleteImage(ctx, tenantID, registryID, name, digest); err != nil {
		middleware.RespondInternalError(c, "internal server error")
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "image deleted"})
}

func respondSuccess(c *gin.Context, data any) {
	errors.WriteSuccess(c, data)
}

func respondBadRequest(c *gin.Context, message string) {
errors.WriteError(c, errors.ErrBadRequest, message, http.StatusBadRequest)
}

func respondInternalError(c *gin.Context) {
	errors.WriteError(c, errors.ErrInternal, "internal server error", http.StatusInternalServerError)
}

func respondNotFound(c *gin.Context) {
	errors.WriteError(c, errors.ErrNotFound, "resource not found", http.StatusNotFound)
}
