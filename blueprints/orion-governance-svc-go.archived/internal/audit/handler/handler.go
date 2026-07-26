package handler

import (
	"orion/go-common/pkg/errors"
	"net/http"

	"orion/governance-svc-go/internal/audit/models"
	"orion/governance-svc-go/internal/audit/service"

	"orion/go-common/pkg/auth"

	"github.com/gin-gonic/gin"
)

// Handler provides HTTP handlers for audit log operations.
type Handler struct {
	svc *service.Service
}

// NewHandler creates a new Handler instance.
func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all audit log routes under the given router group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	a := rg.Group("/audit-logs")
	a.POST("", auth.RequirePermission("audit_log", "write"), h.Create)
	a.GET("", h.List)
	a.GET("/count", h.Count)
	a.GET("/actions", h.GetActions)
	a.GET("/resource-types", h.GetResourceTypes)
	a.GET("/verify", h.VerifyChain)
	a.PUT("/:id", h.Update)
	a.GET("/:id", h.Get)
	a.DELETE("/:id", auth.RequirePermission("audit_log", "delete"), h.Delete)
}

// Create handles POST /audit-logs — creates a new audit log entry.
func (h *Handler) Create(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateAuditRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	entry, err := h.svc.CreateAuditLog(c.Request.Context(), tenantID, &req)
	if err != nil {
		status := http.StatusInternalServerError
		if se, ok := err.(*service.ServiceError); ok {
			if se.Code == service.ErrCodeInvalidInput {
				status = http.StatusBadRequest
			}
		}
		errors.WriteError(c, errors.ErrInternal, err.Error(), status)
		return
	}

	respondCreated(c, entry)
}

// List handles GET /audit-logs — returns paginated, filtered audit logs.
// Query parameters: page, page_size, user_id, action, resource_type, resource_id.
func (h *Handler) List(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var page models.PaginatedRequest
	if err := c.ShouldBindQuery(&page); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	filters := models.ListAuditLogFilters{
		TenantID:     tenantID,
		UserID:       c.Query("user_id"),
		Action:       c.Query("action"),
		ResourceType: c.Query("resource_type"),
		ResourceID:   c.Query("resource_id"),
		Limit:        page.Limit(),
		Offset:       page.Offset(),
	}

	result, err := h.svc.ListAuditLogs(c.Request.Context(), filters)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, result)
}

// Update handles PUT /audit-logs/:id — updates non-hash-chain fields.
func (h *Handler) Update(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	var req models.UpdateAuditRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	entry, err := h.svc.Update(c.Request.Context(), tenantID, id, &req)
	if err != nil {
		status := http.StatusInternalServerError
		if se, ok := err.(*service.ServiceError); ok {
			if se.Code == service.ErrCodeNotFound {
				status = http.StatusNotFound
			} else if se.Code == service.ErrCodeInvalidInput {
				status = http.StatusBadRequest
			}
		}
		errors.WriteError(c, errors.ErrInternal, err.Error(), status)
		return
	}

	respondSuccess(c, entry)
}

// Get handles GET /audit-logs/:id — returns a single audit log by ID.
func (h *Handler) Get(c *gin.Context) {
	id := c.Param("id")
	entry, err := h.svc.GetAuditLog(c.Request.Context(), id)
	if err != nil {
		if se, ok := err.(*service.ServiceError); ok && se.Code == service.ErrCodeNotFound {
			respondNotFound(c, se.Message)
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, entry)
}

// Delete handles DELETE /audit-logs/:id — removes an audit log entry.
func (h *Handler) Delete(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.Delete(c.Request.Context(), tenantID, id); err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, map[string]any{"message": "deleted"})
}

// Count handles GET /audit-logs/count — returns total count for the tenant.
// Supports optional filters: user_id, action, resource_type.
func (h *Handler) Count(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	count, err := h.svc.Count(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, map[string]any{"count": count})
}

// VerifyChain handles GET /audit-logs/verify — verifies hash chain integrity.
func (h *Handler) VerifyChain(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	result, err := h.svc.VerifyChain(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, result)
}

// GetActions handles GET /audit-logs/actions — returns distinct action values.
func (h *Handler) GetActions(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	actions, err := h.svc.GetActions(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"actions": actions})
}

// GetResourceTypes handles GET /audit-logs/resource-types — returns distinct resource_type values.
func (h *Handler) GetResourceTypes(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	types, err := h.svc.GetResourceTypes(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"resource_types": types})
}

