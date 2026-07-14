package handler

import (
	"errors"
	"strconv"

	"orion/platform-svc-go/internal/workflow-webhook/models"
	"orion/platform-svc-go/internal/workflow-webhook/service"

	"github.com/gin-gonic/gin"
)

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

// Handler provides HTTP handlers for the workflow-webhook module.
type Handler struct {
	svc *service.Service
}

// NewHandler creates a new Handler.
func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes wires up all workflow-webhook endpoints.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	// Public endpoint (no auth) — receives external webhook calls.
	rg.POST("/webhooks/:webhookPath", h.HandleWebhook)

	// CRUD management endpoints (with auth — auth middleware applied by caller).
	f := rg.Group("/workflow-webhooks")
	f.GET("", h.List)
	f.POST("", h.Create)
	f.GET("/count", h.Count)
	f.GET("/:id", h.Get)
	f.PUT("/:id", h.Update)
	f.DELETE("/:id", h.Delete)
	f.POST("/:id/rotate-secret", h.RotateSecret)
	f.GET("/:id/logs", h.ListLogs)
}

// getTenantID extracts tenant_id from the Gin context.
func (h *Handler) getTenantID(c *gin.Context) string {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		return "00000000-0000-0000-0000-000000000000"
	}
	return tenantID
}

// getUserID extracts user_id from the Gin context.
func (h *Handler) getUserID(c *gin.Context) string {
	userID := c.GetString("user_id")
	if userID == "" {
		return "00000000-0000-0000-0000-000000000000"
	}
	return userID
}

// parsePagination reads page and pageSize from query parameters.
func parsePagination(c *gin.Context) (int, int) {
	page := 1
	pageSize := 20
	if p, err := strconv.Atoi(c.Query("page")); err == nil && p > 0 {
		page = p
	}
	if ps, err := strconv.Atoi(c.Query("pageSize")); err == nil && ps > 0 {
		pageSize = ps
	}
	if pageSize > 100 {
		pageSize = 100
	}
	return page, pageSize
}

// ---------------------------------------------------------------------------
// Public webhook endpoint (no auth)
// ---------------------------------------------------------------------------

// HandleWebhook handles POST /webhooks/:webhookPath
// This is a public endpoint — no auth middleware. Signature verification
// is done via x-webhook-signature and x-webhook-timestamp headers.
func (h *Handler) HandleWebhook(c *gin.Context) {
	webhookPath := c.Param("webhookPath")
	if webhookPath == "" {
		respondBadRequest(c, "webhookPath is required")
		return
	}

	body, err := c.GetRawData()
	if err != nil {
		respondBadRequest(c, "failed to read request body")
		return
	}

	signatureHeader := c.GetHeader("x-webhook-signature")
	timestampHeader := c.GetHeader("x-webhook-timestamp")

	result, err := h.svc.ProcessWebhook(c.Request.Context(), webhookPath, body, signatureHeader, timestampHeader)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, err.Error())
			return
		}
		if errors.Is(err, service.ErrInvalidSignature) {
			respondUnauthorized(c, err.Error())
			return
		}
		if errors.Is(err, service.ErrWebhookDisabled) {
			respondBadRequest(c, err.Error())
			return
		}
		if errors.Is(err, service.ErrExpiredTimestamp) {
			respondBadRequest(c, err.Error())
			return
		}
		respondInternalError(c, err.Error())
		return
	}

	// TODO: The handler should create a workflow instance using the trigger info.
	// This is a placeholder response. The actual workflow instance creation will
	// be implemented when the workflow engine is integrated.
	resp := models.WebhookResponse{
		InstanceID: result.LogID,
		Status:     "pending",
	}
	respondSuccess(c, resp)
}

// ---------------------------------------------------------------------------
// CRUD handlers
// ---------------------------------------------------------------------------

// List handles GET /workflow-webhooks
func (h *Handler) List(c *gin.Context) {
	tenantID := h.getTenantID(c)
	page, pageSize := parsePagination(c)

	filter := &models.ListFilter{}
	if wp := c.Query("webhookPath"); wp != "" {
		filter.WebhookPath = &wp
	}
	if en := c.Query("enabled"); en != "" {
		enabled := en == "true"
		filter.Enabled = &enabled
	}

	items, total, err := h.svc.List(c.Request.Context(), tenantID, filter, page, pageSize)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, models.PaginatedResponse{
		Data:     items,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	})
}

// Create handles POST /workflow-webhooks
func (h *Handler) Create(c *gin.Context) {
	var req models.CreateWebhookTriggerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	userID := h.getUserID(c)
	t, err := h.svc.Create(c.Request.Context(), tenantID, userID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, t)
}

// Get handles GET /workflow-webhooks/:id
func (h *Handler) Get(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	t, err := h.svc.GetByID(c.Request.Context(), tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, "workflow webhook not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, t)
}

// Update handles PUT /workflow-webhooks/:id
func (h *Handler) Update(c *gin.Context) {
	id := c.Param("id")
	var req models.UpdateWebhookTriggerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	t, err := h.svc.Update(c.Request.Context(), tenantID, id, &req)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, "workflow webhook not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, t)
}

// Delete handles DELETE /workflow-webhooks/:id
func (h *Handler) Delete(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	if err := h.svc.Delete(c.Request.Context(), tenantID, id); err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, "workflow webhook not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "workflow webhook deleted"})
}

// Count handles GET /workflow-webhooks/count
func (h *Handler) Count(c *gin.Context) {
	tenantID := h.getTenantID(c)
	count, err := h.svc.Count(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"count": count})
}

// RotateSecret handles POST /workflow-webhooks/:id/rotate-secret
func (h *Handler) RotateSecret(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	secret, err := h.svc.RotateSecret(c.Request.Context(), tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, "workflow webhook not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"secret": secret})
}

// ListLogs handles GET /workflow-webhooks/:id/logs
func (h *Handler) ListLogs(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.getTenantID(c)

	// Verify the trigger exists and belongs to the tenant.
	if _, err := h.svc.GetByID(c.Request.Context(), tenantID, id); err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, "workflow webhook not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}

	page, pageSize := parsePagination(c)
	logs, total, err := h.svc.ListLogs(c.Request.Context(), id, page, pageSize)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{
		"data":     logs,
		"page":     page,
		"pageSize": pageSize,
		"total":    total,
	})
}