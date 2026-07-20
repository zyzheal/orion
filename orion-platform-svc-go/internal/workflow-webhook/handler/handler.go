package handler

import (
	"errors"
	"strconv"

	"orion/platform-svc-go/internal/workflow-webhook/models"
	"orion/platform-svc-go/internal/workflow-webhook/service"
	workflow_service "orion/platform-svc-go/internal/workflow/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
	"go.opentelemetry.io/otel/trace"
)

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

// Handler provides HTTP handlers for the workflow-webhook module.
type Handler struct {
	svc         *service.Service
	workflowSvc *workflow_service.Service
}

// NewHandler creates a new Handler.
func NewHandler(svc *service.Service, workflowSvc *workflow_service.Service) *Handler {
	return &Handler{svc: svc, workflowSvc: workflowSvc}
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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "HandleWebhook")
	defer span.End()
	webhookPath := c.Param("webhookPath")
	if webhookPath == "" {
		middleware.RespondBadRequest(c, "webhookPath is required")
		return
	}

	body, err := c.GetRawData()
	if err != nil {
		middleware.RespondBadRequest(c, "failed to read request body")
		return
	}

	signatureHeader := c.GetHeader("x-webhook-signature")
	timestampHeader := c.GetHeader("x-webhook-timestamp")

	result, err := h.svc.ProcessWebhook(ctx, webhookPath, body, signatureHeader, timestampHeader)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, err.Error())
			return
		}
		if errors.Is(err, service.ErrInvalidSignature) {
			middleware.RespondForbidden(c, err.Error())
			return
		}
		if errors.Is(err, service.ErrWebhookDisabled) {
			middleware.RespondBadRequest(c, err.Error())
			return
		}
		if errors.Is(err, service.ErrExpiredTimestamp) {
			middleware.RespondBadRequest(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}

	// Create a real workflow instance via the workflow engine.
	ctx := ctx
	if h.workflowSvc == nil {
		// Workflow service not wired — log the event but respond with pending.
		middleware.RespondSuccess(c, models.WebhookResponse{
			InstanceID: result.LogID,
			Status:     "pending",
		})
		return
	}

	// Use the webhook payload as the workflow's initial input.
	exec, err := h.workflowSvc.Execute(ctx, result.Trigger.WorkflowID, result.Trigger.TenantID, "webhook:"+result.Trigger.Name, result.EventPayload)
	if err != nil {
		if errors.Is(err, workflow_service.ErrWorkflowNotFound) {
			middleware.RespondNotFound(c, err.Error())
			return
		}
		if errors.Is(err, workflow_service.ErrWorkflowDisabled) {
			middleware.RespondBadRequest(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}

	resp := models.WebhookResponse{
		InstanceID: exec.ID,
		Status:     exec.Status,
	}
	middleware.RespondSuccess(c, resp)
}

// ---------------------------------------------------------------------------
// CRUD handlers
// ---------------------------------------------------------------------------

// List handles GET /workflow-webhooks
func (h *Handler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "List")
	defer span.End()
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

	items, total, err := h.svc.List(ctx, tenantID, filter, page, pageSize)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, models.PaginatedResponse{
		Data:     items,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	})
}

// Create handles POST /workflow-webhooks
func (h *Handler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Create")
	defer span.End()
	var req models.CreateWebhookTriggerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	userID := h.getUserID(c)
	t, err := h.svc.Create(ctx, tenantID, userID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, t)
}

// Get handles GET /workflow-webhooks/:id
func (h *Handler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Get")
	defer span.End()
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	t, err := h.svc.GetByID(ctx, tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "workflow webhook not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, t)
}

// Update handles PUT /workflow-webhooks/:id
func (h *Handler) Update(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Update")
	defer span.End()
	id := c.Param("id")
	var req models.UpdateWebhookTriggerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	t, err := h.svc.Update(ctx, tenantID, id, &req)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "workflow webhook not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, t)
}

// Delete handles DELETE /workflow-webhooks/:id
func (h *Handler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Delete")
	defer span.End()
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	if err := h.svc.Delete(ctx, tenantID, id); err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "workflow webhook not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "workflow webhook deleted"})
}

// Count handles GET /workflow-webhooks/count
func (h *Handler) Count(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Count")
	defer span.End()
	tenantID := h.getTenantID(c)
	count, err := h.svc.Count(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"count": count})
}

// RotateSecret handles POST /workflow-webhooks/:id/rotate-secret
func (h *Handler) RotateSecret(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RotateSecret")
	defer span.End()
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	secret, err := h.svc.RotateSecret(ctx, tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "workflow webhook not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"secret": secret})
}

// ListLogs handles GET /workflow-webhooks/:id/logs
func (h *Handler) ListLogs(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListLogs")
	defer span.End()
	id := c.Param("id")
	tenantID := h.getTenantID(c)

	// Verify the trigger exists and belongs to the tenant.
	if _, err := h.svc.GetByID(ctx, tenantID, id); err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "workflow webhook not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}

	page, pageSize := parsePagination(c)
	logs, total, err := h.svc.ListLogs(ctx, id, page, pageSize)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{
		"data":     logs,
		"page":     page,
		"pageSize": pageSize,
		"total":    total,
	})
}
