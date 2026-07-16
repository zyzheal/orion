package handler

import (

	"orion/go-common/pkg/auth"
	goerr "orion/go-common/pkg/errors"

	"orion/platform-svc-go/internal/canary-traffic/models"
	"orion/platform-svc-go/internal/canary-traffic/service"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/canary-traffic")
	f.GET("", auth.RequirePermission("canary_traffic", "read"), h.List)
	f.POST("", auth.RequirePermission("canary_traffic", "write"), h.Create)
	f.GET("/:id", auth.RequirePermission("canary_traffic", "read"), h.Get)
	f.PUT("/:id", auth.RequirePermission("canary_traffic", "write"), h.Update)
	f.DELETE("/:id", auth.RequirePermission("canary_traffic", "delete"), h.Delete)
	f.POST("/:id/adjust", auth.RequirePermission("canary_traffic", "write"), h.AdjustWeight)
	f.GET("/:id/split", auth.RequirePermission("canary_traffic", "read"), h.GetTrafficSplit)
}

func (h *Handler) getTenantID(c *gin.Context) string {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		return "00000000-0000-0000-0000-000000000000"
	}
	return tenantID
}

func (h *Handler) List(c *gin.Context) {
	tenantID := h.getTenantID(c)
	entities, err := h.svc.List(c.Request.Context(), tenantID)
	if err != nil {
		goerr.WriteError(c, goerr.ErrInternal, err.Error(), 500)
		return
	}
	goerr.WriteSuccess(c, models.PaginatedResponse{Data: entities, Total: len(entities), Page: 1, PageSize: len(entities)})
}

func (h *Handler) Create(c *gin.Context) {
	var req models.CreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		goerr.WriteError(c, goerr.ErrBadRequest, err.Error(), 400)
		return
	}
	tenantID := h.getTenantID(c)
	entity, err := h.svc.Create(c.Request.Context(), &req, tenantID)
	if err != nil {
		if err == service.ErrInvalidWeights {
			goerr.WriteError(c, goerr.ErrBadRequest, err.Error(), 400)
			return
		}
		goerr.WriteError(c, goerr.ErrInternal, err.Error(), 500)
		return
	}
	goerr.WriteCreated(c, entity)
}

func (h *Handler) Get(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	entity, err := h.svc.Get(c.Request.Context(), id, tenantID)
	if err != nil {
		if err == service.ErrNotFound {
			goerr.WriteError(c, goerr.ErrNotFound, "not found", 404)
			return
		}
		goerr.WriteError(c, goerr.ErrInternal, err.Error(), 500)
		return
	}
	goerr.WriteSuccess(c, entity)
}

func (h *Handler) Update(c *gin.Context) {
	id := c.Param("id")
	var req models.UpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		goerr.WriteError(c, goerr.ErrBadRequest, err.Error(), 400)
		return
	}
	tenantID := h.getTenantID(c)
	entity, err := h.svc.Update(c.Request.Context(), id, tenantID, &req)
	if err != nil {
		if err == service.ErrNotFound {
			goerr.WriteError(c, goerr.ErrNotFound, "not found", 404)
			return
		}
		goerr.WriteError(c, goerr.ErrInternal, err.Error(), 500)
		return
	}
	goerr.WriteSuccess(c, entity)
}

func (h *Handler) Delete(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	deleted, err := h.svc.Delete(c.Request.Context(), id, tenantID)
	if err != nil {
		goerr.WriteError(c, goerr.ErrInternal, err.Error(), 500)
		return
	}
	if !deleted {
		goerr.WriteError(c, goerr.ErrNotFound, "not found", 404)
		return
	}
	goerr.WriteSuccess(c, gin.H{"deleted": true})
}

func (h *Handler) AdjustWeight(c *gin.Context) {
	id := c.Param("id")
	var req models.AdjustWeightRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		goerr.WriteError(c, goerr.ErrBadRequest, err.Error(), 400)
		return
	}
	tenantID := h.getTenantID(c)
	entity, err := h.svc.AdjustWeight(c.Request.Context(), id, tenantID, req.CanaryWeight)
	if err != nil {
		if err == service.ErrNotFound {
			goerr.WriteError(c, goerr.ErrNotFound, "not found", 404)
			return
		}
		if err == service.ErrInvalidWeights {
			goerr.WriteError(c, goerr.ErrBadRequest, err.Error(), 400)
			return
		}
		goerr.WriteError(c, goerr.ErrInternal, err.Error(), 500)
		return
	}
	goerr.WriteSuccess(c, entity)
}

func (h *Handler) GetTrafficSplit(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	split, err := h.svc.GetTrafficSplit(c.Request.Context(), id, tenantID)
	if err != nil {
		if err == service.ErrNotFound {
			goerr.WriteError(c, goerr.ErrNotFound, "not found", 404)
			return
		}
		goerr.WriteError(c, goerr.ErrInternal, err.Error(), 500)
		return
	}
	goerr.WriteSuccess(c, split)
}
