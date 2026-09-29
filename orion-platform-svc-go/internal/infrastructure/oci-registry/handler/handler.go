package handler

import (
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/infrastructure/oci-registry/models"
	"orion/platform-svc-go/internal/infrastructure/oci-registry/service"
	"orion/platform-svc-go/internal/pagination"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	r := rg.Group("/oci-registrys")
	{
		r.POST("", auth.RequirePermission("oci-registry", "write"), h.Create)
		r.GET("", auth.RequirePermission("oci-registry", "read"), h.List)
		r.GET("/:id", auth.RequirePermission("oci-registry", "read"), h.Get)
		r.DELETE("/:id", auth.RequirePermission("oci-registry", "delete"), h.Delete)
	}
}

func (h *Handler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateOCIRegistry")
	defer span.End()
	var req models.CreateOCIRegistryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	m, err := h.svc.Create(ctx, c.GetString("tenant_id"), req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, m)
}

func (h *Handler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetOCIRegistry")
	defer span.End()
	m, err := h.svc.Get(ctx, c.GetString("tenant_id"), c.Param("id"))
	if err != nil {
		respondNotFound(c, "not found")
		return
	}
	respondSuccess(c, m)
}

func (h *Handler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListOCIRegistrys")
	defer span.End()
	limit := pagination.Limit(c.Query("limit"), 50)
	if limit > 100 {
		limit = 100
	}
	offset := pagination.Offset(c.Query("offset"))

	items, err := h.svc.List(ctx, c.GetString("tenant_id"), limit, offset)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

func (h *Handler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteOCIRegistry")
	defer span.End()
	if err := h.svc.Delete(ctx, c.GetString("tenant_id"), c.Param("id")); err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "deleted"})
}
