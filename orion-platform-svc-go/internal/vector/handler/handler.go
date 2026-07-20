package handler

import (
	"net/http"
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/vector/models"
	"orion/platform-svc-go/internal/vector/service"

	"github.com/gin-gonic/gin"
	"orion/go-common/pkg/errors"
	"go.opentelemetry.io/otel"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	r := rg.Group("/vector")
	r.GET("/stores", auth.RequirePermission("vector", "read"), h.ListStores)
	r.GET("/stores/:id", auth.RequirePermission("vector", "read"), h.GetStore)
r.POST("/stores", auth.RequirePermission("vector", "write"), h.CreateStore)
	r.DELETE("/stores/:id", auth.RequirePermission("vector", "delete"), h.DeleteStore)
r.POST("/stores/:id/vectors", auth.RequirePermission("vector", "write"), h.UpsertVectors)
	r.POST("/stores/:id/search", auth.RequirePermission("vector", "read"), h.SearchVectors)
r.DELETE("/stores/:id/vectors", auth.RequirePermission("vector", "delete"), h.DeleteVectors)
}

func (h *Handler) CreateStore(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateStore")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateStoreRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	result, err := h.svc.CreateStore(ctx, tenantID, req)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteCreated(c, result)
}

func (h *Handler) DeleteStore(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteStore")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.DeleteStore(ctx, tenantID, id); err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *Handler) DeleteVectors(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteVectors")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	storeID := c.Param("id")
	var ids []string
	if err := c.ShouldBindJSON(&ids); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	result, err := h.svc.DeleteVectors(ctx, tenantID, storeID, ids)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, gin.H{"deleted": result})
}

func (h *Handler) GetStore(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetStore")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	result, err := h.svc.GetStore(ctx, tenantID, id)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, result)
}

func (h *Handler) ListStores(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListStores")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
result, err := h.svc.ListStores(ctx, tenantID, limit, offset)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, result)
}

func (h *Handler) SearchVectors(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SearchVectors")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	storeID := c.Param("id")
	var req models.SearchQuery
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	result, err := h.svc.SearchVectors(ctx, tenantID, storeID, req)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, result)
}

func (h *Handler) UpsertVectors(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpsertVectors")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	storeID := c.Param("id")
	var req models.UpsertVectorsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	if err := h.svc.UpsertVectors(ctx, tenantID, storeID, req); err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, gin.H{"ok": true})
}
