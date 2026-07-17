package handler

import (
	"net/http"
	"strconv"
	"orion/platform-svc-go/internal/middleware"

	"orion/go-common/pkg/errors"
	"orion/platform-svc-go/internal/event-trigger/models"
	"orion/platform-svc-go/internal/event-trigger/service"

	"github.com/gin-gonic/gin"
)

// ---------------------------------------------------------------------------
// Canonical response helpers (mirrors per-service response_writer.go files).
// ---------------------------------------------------------------------------

func respondSuccess(c *gin.Context, data any) {
	errors.WriteSuccess(c, data)
}

func respondCreated(c *gin.Context, data any) {
	errors.WriteCreated(c, data)
}

func respondBadRequest(c *gin.Context, message string) {
	errors.WriteError(c, errors.ErrBadRequest, message, http.StatusBadRequest)
}

func respondNotFound(c *gin.Context, message string) {
	errors.WriteError(c, errors.ErrNotFound, message, http.StatusNotFound)
}

func respondInternalError(c *gin.Context, message string) {
	errors.WriteError(c, errors.ErrInternal, message, http.StatusInternalServerError)
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

// Handler provides HTTP handlers for the event-trigger module.
type Handler struct {
	svc *service.Service
}

// NewHandler creates a new Handler.
func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes wires up all event-trigger endpoints.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.POST("/event-triggers", h.Create)
	rg.GET("/event-triggers", h.List)
	rg.GET("/event-triggers/count", h.Count)
	rg.GET("/event-triggers/:id", h.Get)
	rg.PUT("/event-triggers/:id", h.Update)
	rg.DELETE("/event-triggers/:id", h.Delete)
}

// Create handles POST /event-triggers.
func (h *Handler) Create(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	var req models.CreateTriggerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	t, err := h.svc.Create(c.Request.Context(), tenantID, userID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, t)
}

// List handles GET /event-triggers.
func (h *Handler) List(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	ps, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if ps > 100 {
		ps = 100
	}
	offset := (page - 1) * ps
	if offset < 0 {
		offset = 0
	}

	filter := &models.ListFilter{}
	if eventType := c.Query("event_type"); eventType != "" {
		filter.EventType = &eventType
	}
	if enabled := c.Query("enabled"); enabled != "" {
		b, err := strconv.ParseBool(enabled)
		if err == nil {
			filter.Enabled = &b
		}
	}

	items, err := h.svc.List(c.Request.Context(), tenantID, filter, offset, ps)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	total, _ := h.svc.Count(c.Request.Context(), tenantID)
	middleware.RespondSuccess(c, gin.H{"records": items, "total": total})
}

// Count handles GET /event-triggers/count.
func (h *Handler) Count(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	count, err := h.svc.Count(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"count": count})
}

// Get handles GET /event-triggers/:id.
func (h *Handler) Get(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	t, err := h.svc.GetByID(c.Request.Context(), tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, t)
}

// Update handles PUT /event-triggers/:id.
func (h *Handler) Update(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateTriggerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	updated, err := h.svc.Update(c.Request.Context(), tenantID, id, &req)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, updated)
}

// Delete handles DELETE /event-triggers/:id.
func (h *Handler) Delete(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.Delete(c.Request.Context(), tenantID, id); err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "deleted"})
}
