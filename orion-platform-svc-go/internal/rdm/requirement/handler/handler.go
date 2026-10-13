package handler

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"orion/platform-svc-go/internal/middleware"
	"orion/platform-svc-go/internal/rdm/requirement/models"
	"orion/platform-svc-go/internal/rdm/requirement/service"
	"orion/platform-svc-go/internal/repository"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	g := rg.Group("/rdm/requirements")
	g.POST("", h.Create)
	g.GET("", h.List)
	g.GET("/:id", h.Get)
	g.PUT("/:id", h.Update)
	g.DELETE("/:id", h.Delete)
}

func (h *Handler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateRequirement")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx = repository.WithTenant(ctx, tenantID)

	var req models.CreateRequirementRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	item, err := h.svc.Create(ctx, tenantID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, item)
}

func (h *Handler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListRequirements")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx = repository.WithTenant(ctx, tenantID)

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	if page < 1 {
		page = 1
	}
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	if pageSize < 1 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}

	q := &models.ListRequirementsRequest{
		Status:   c.Query("status"),
		Priority: c.Query("priority"),
		Type:     c.Query("type"),
		SprintID: c.Query("sprintId"),
		Page:     page,
		PageSize: pageSize,
	}
	items, total, err := h.svc.List(ctx, tenantID, q)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"items": items, "total": total})
}

func (h *Handler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetRequirement")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx = repository.WithTenant(ctx, tenantID)

	id := c.Param("id")
	item, err := h.svc.Get(ctx, tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, "not found")
		return
	}
	middleware.RespondSuccess(c, item)
}

func (h *Handler) Update(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateRequirement")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx = repository.WithTenant(ctx, tenantID)

	id := c.Param("id")
	var req models.UpdateRequirementRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	item, err := h.svc.Update(ctx, tenantID, id, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, item)
}

func (h *Handler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteRequirement")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx = repository.WithTenant(ctx, tenantID)

	id := c.Param("id")
	ok, err := h.svc.Delete(ctx, tenantID, id)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if !ok {
		middleware.RespondNotFound(c, "not found")
		return
	}
	middleware.RespondSuccess(c, gin.H{"deleted": true})
}
