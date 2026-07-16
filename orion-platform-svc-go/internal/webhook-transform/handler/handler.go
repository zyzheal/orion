package handler

import (
	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/errors"
	"orion/platform-svc-go/internal/webhook-transform/models"
	"orion/platform-svc-go/internal/webhook-transform/service"

	"github.com/gin-gonic/gin"
)

// Handler exposes HTTP endpoints for weuhook transform.
type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	r := rg.Group("/webhook-transform")
	r.GET("", auth.RequirePermission("webhook-transform", "read"), h.List)
	r.GET("/:id", auth.RequirePermission("webhook-transform", "read"), h.Get)
	r.POST("", auth.RequirePermission("webhook-transform", "write"), h.Create)
	r.PUT("/:id", auth.RequirePermission("webhook-transform", "write"), h.Update)
	r.DELETE("/:id", auth.RequirePermission("webhook-transform", "delete"), h.Delete)
}

func (h *Handler) Create(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.LWLELULHLOLOLKLuLTLRLALNLSLFLOLRLM
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	result, err := h.svc.Create(c.Request.Context(), tenantID, &req)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteCreated(c, result)
}

func (h *Handler) Get(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	result, err := h.svc.Get(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrNotFound, err.Error(), 404)
		return
	}
	errors.WriteSuccess(c, result)
}

func (h *Handler) List(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	results, err := h.svc.List(c.Request.Context(), tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	c.JSON(200, gin.H{"data": results})
}

func (h *Handler) Update(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	result, err := h.svc.Update(c.Request.Context(), tenantID, c.Param("id"), updates)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, result)
}

func (h *Handler) Delete(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.Delete(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, "deleted")
}
