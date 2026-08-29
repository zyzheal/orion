package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/infrastructure/maintenance-window/models"
	"orion/platform-svc-go/internal/infrastructure/maintenance-window/service"

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
	r := rg.Group("/maintenance-windows")
	{
		r.POST("", auth.RequirePermission("maintenance-window", "write"), h.Create)
		r.GET("", auth.RequirePermission("maintenance-window", "read"), h.List)
		r.GET("/:id", auth.RequirePermission("maintenance-window", "read"), h.Get)
		r.DELETE("/:id", auth.RequirePermission("maintenance-window", "delete"), h.Delete)
	}
}

func (h *Handler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateMaintenanceWindow")
	defer span.End()
	var req models.CreateMaintenanceWindowRequest
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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetMaintenanceWindow")
	defer span.End()
	m, err := h.svc.Get(ctx, c.GetString("tenant_id"), c.Param("id"))
	if err != nil {
		respondNotFound(c, "not found")
		return
	}
	respondSuccess(c, m)
}

func (h *Handler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListMaintenanceWindows")
	defer span.End()
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	items, err := h.svc.List(ctx, c.GetString("tenant_id"), limit, offset)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

func (h *Handler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteMaintenanceWindow")
	defer span.End()
	if err := h.svc.Delete(ctx, c.GetString("tenant_id"), c.Param("id")); err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "deleted"})
}
