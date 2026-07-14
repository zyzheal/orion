package handler

import (
	"net/http"
	"strconv"

	"orion/go-common/pkg/errors"
	"orion/platform-svc-go/internal/hook-chain/models"
	"orion/platform-svc-go/internal/hook-chain/service"

	"github.com/gin-gonic/gin"
)

// Handler exposes HTTP endpoints for hook management.
type Handler struct {
	svc *service.Service
}

// NewHandler creates a new Handler instance.
func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes mounts all hook routes onto the given router group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.POST("/hooks", h.Create)
	rg.GET("/hooks", h.List)
	rg.GET("/hooks/count", h.Count)
	rg.GET("/hooks/:id", h.Get)
	rg.PUT("/hooks/:id", h.Update)
	rg.DELETE("/hooks/:id", h.Delete)
}

// Create creates a new hook.
func (h *Handler) Create(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")

	var req models.CreateHookRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), http.StatusBadRequest)
		return
	}

	hook, err := h.svc.Create(c.Request.Context(), tenantID, userID, &req)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteCreated(c, hook)
}

// List retrieves hooks with optional filters and pagination.
func (h *Handler) List(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	filter := &models.ListFilter{}
	if trigger := c.Query("trigger"); trigger != "" {
		filter.Trigger = &trigger
	}
	if enabled := c.Query("enabled"); enabled != "" {
		b := enabled == "true"
		filter.Enabled = &b
	}

	items, err := h.svc.List(c.Request.Context(), tenantID, filter, (page-1)*pageSize, pageSize)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"data": items, "page": page, "page_size": pageSize})
}

// Get retrieves a single hook by id.
func (h *Handler) Get(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	hook, err := h.svc.GetByID(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrNotFound, err.Error(), http.StatusNotFound)
		return
	}
	errors.WriteSuccess(c, hook)
}

// Update modifies an existing hook.
func (h *Handler) Update(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	var req models.UpdateHookRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), http.StatusBadRequest)
		return
	}

	hook, err := h.svc.Update(c.Request.Context(), tenantID, c.Param("id"), &req)
	if err != nil {
		errors.WriteError(c, errors.ErrNotFound, err.Error(), http.StatusNotFound)
		return
	}
	errors.WriteSuccess(c, hook)
}

// Delete removes a hook by id.
func (h *Handler) Delete(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.Delete(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		errors.WriteError(c, errors.ErrNotFound, err.Error(), http.StatusNotFound)
		return
	}
	errors.WriteSuccess(c, gin.H{"message": "deleted"})
}

// Count returns the total number of hooks for the tenant.
func (h *Handler) Count(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	count, err := h.svc.Count(c.Request.Context(), tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"count": count})
}
