package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/errors"
	"orion/platform-svc-go/internal/sla/models"
	"orion/platform-svc-go/internal/sla/service"

	"github.com/gin-gonic/gin"
)

// Handler exposes the SLA module HTTP endpoints.
type Handler struct {
	svc *service.Service
}

// NewHandler creates a new Handler bound to the SLA service.
func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all SLA endpoints under the given group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/sla")

	// === Definition CRUD ===
	f.GET("/definitions", auth.RequirePermission("sla", "read"), h.ListDefinitions)
	f.POST("/definitions", auth.RequirePermission("sla", "write"), h.CreateDefinition)
	f.GET("/definitions/:id", auth.RequirePermission("sla", "read"), h.GetDefinition)
	f.PUT("/definitions/:id", auth.RequirePermission("sla", "write"), h.UpdateDefinition)
	f.DELETE("/definitions/:id", auth.RequirePermission("sla", "delete"), h.DeleteDefinition)

	// === Tracking ===
	f.POST("/tracking", auth.RequirePermission("sla", "write"), h.StartTracking)
	f.GET("/tracking", auth.RequirePermission("sla", "read"), h.ListTracking)
	f.GET("/tracking/:id", auth.RequirePermission("sla", "read"), h.GetTracking)
	f.POST("/tracking/:id/met", auth.RequirePermission("sla", "manage"), h.MarkMet)
	f.POST("/tracking/:id/breached", auth.RequirePermission("sla", "manage"), h.MarkBreached)
	f.POST("/tracking/:id/pause", auth.RequirePermission("sla", "manage"), h.PauseTracking)
	f.POST("/tracking/:id/resume", auth.RequirePermission("sla", "manage"), h.ResumeTracking)
	f.GET("/tracking/:id/breaches", auth.RequirePermission("sla", "read"), h.GetBreachEvents)

	// === Breaches ===
	f.GET("/breaches", auth.RequirePermission("sla", "read"), h.ListBreachEvents)

	// === Detection / Stats ===
	f.POST("/detect", auth.RequirePermission("sla", "manage"), h.DetectBreaches)
	f.GET("/stats", auth.RequirePermission("sla", "read"), h.GetStats)
}

// ==================== Definition CRUD ====================

func (h *Handler) ListDefinitions(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	q := models.DefinitionListQuery{
		Limit:  20,
		Offset: 0,
	}
	if l := c.DefaultQuery("limit", "20"); l != "" {
		q.Limit, _ = strconv.Atoi(l)
	}
	if o := c.DefaultQuery("offset", "0"); o != "" {
		q.Offset, _ = strconv.Atoi(o)
	}
	if typ := c.Query("type"); typ != "" {
		q.Type = typ
	}
	if status := c.Query("status"); status != "" {
		q.Status = status
	}
	if category := c.Query("category"); category != "" {
		q.Category = category
	}
	result, err := h.svc.ListDefinitions(c.Request.Context(), tenantID, q)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, result)
}

func (h *Handler) CreateDefinition(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateDefinitionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	result, err := h.svc.CreateDefinition(c.Request.Context(), tenantID, req)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteCreated(c, result)
}

func (h *Handler) GetDefinition(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	def, err := h.svc.GetDefinition(c.Request.Context(), tenantID, id)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	if def == nil {
		errors.WriteError(c, errors.ErrNotFound, "SLA definition not found", 404)
		return
	}
	errors.WriteSuccess(c, def)
}

func (h *Handler) UpdateDefinition(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateDefinitionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	result, err := h.svc.UpdateDefinition(c.Request.Context(), tenantID, id, req)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, result)
}

func (h *Handler) DeleteDefinition(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.DeleteDefinition(c.Request.Context(), tenantID, id); err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, gin.H{"message": "SLA definition deleted"})
}

// ==================== Tracking ====================

func (h *Handler) StartTracking(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.StartTrackingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	result, err := h.svc.StartTracking(c.Request.Context(), tenantID, req)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteCreated(c, result)
}

func (h *Handler) ListTracking(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	q := models.TrackingListQuery{
		Limit:  20,
		Offset: 0,
	}
	if l := c.DefaultQuery("limit", "20"); l != "" {
		q.Limit, _ = strconv.Atoi(l)
	}
	if o := c.DefaultQuery("offset", "0"); o != "" {
		q.Offset, _ = strconv.Atoi(o)
	}
	if status := c.Query("status"); status != "" {
		q.Status = status
	}
	if et := c.Query("entity_type"); et != "" {
		q.EntityType = et
	}
	if eid := c.Query("entity_id"); eid != "" {
		q.EntityID = eid
	}
	result, err := h.svc.ListTracking(c.Request.Context(), tenantID, q)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, result)
}

func (h *Handler) GetTracking(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	tracking, err := h.svc.GetTracking(c.Request.Context(), tenantID, id)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	if tracking == nil {
		errors.WriteError(c, errors.ErrNotFound, "SLA tracking not found", 404)
		return
	}
	errors.WriteSuccess(c, tracking)
}

func (h *Handler) MarkMet(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	trackingID := c.Param("id")
	result, err := h.svc.MarkMet(c.Request.Context(), tenantID, trackingID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, result)
}

func (h *Handler) MarkBreached(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	trackingID := c.Param("id")
	var body struct {
		Details string `json:"details"`
	}
	c.ShouldBindJSON(&body)
	result, err := h.svc.MarkBreached(c.Request.Context(), tenantID, trackingID, body.Details)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, result)
}

func (h *Handler) PauseTracking(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	trackingID := c.Param("id")
	var body struct {
		Reason string `json:"reason"`
	}
	c.ShouldBindJSON(&body)
	result, err := h.svc.PauseTracking(c.Request.Context(), tenantID, trackingID, body.Reason)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, result)
}

func (h *Handler) ResumeTracking(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	trackingID := c.Param("id")
	result, err := h.svc.ResumeTracking(c.Request.Context(), tenantID, trackingID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, result)
}

func (h *Handler) GetBreachEvents(c *gin.Context) {
	trackingID := c.Param("id")
	events, err := h.svc.GetBreachEvents(c.Request.Context(), trackingID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, gin.H{"events": events})
}

// ==================== Breaches ====================

func (h *Handler) ListBreachEvents(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	limit := 20
	offset := 0
	if l := c.DefaultQuery("limit", "20"); l != "" {
		limit, _ = strconv.Atoi(l)
	}
	if o := c.DefaultQuery("offset", "0"); o != "" {
	offset, _ = strconv.Atoi(o)
	}
	result, err := h.svc.ListBreachEvents(c.Request.Context(), tenantID, limit, offset)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, result)
}

// ==================== Detection / Stats ====================

func (h *Handler) DetectBreaches(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	result, err := h.svc.DetectBreaches(c.Request.Context(), tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, result)
}

func (h *Handler) GetStats(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	result, err := h.svc.GetStats(c.Request.Context(), tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, result)
}
