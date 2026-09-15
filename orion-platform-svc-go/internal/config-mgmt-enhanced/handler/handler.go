package handler

import (
	"errors"

	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/config-mgmt-enhanced/models"
	"orion/platform-svc-go/internal/config-mgmt-enhanced/service"

	"orion/platform-svc-go/internal/middleware"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
)

type Handler struct {
	svc service.ServiceInterface
}

func NewHandler(svc service.ServiceInterface) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/config-mgmt")
	f.GET("", auth.RequirePermission("config_mgmt_enhanced", "read"), h.List)
	f.POST("", auth.RequirePermission("config_mgmt_enhanced", "write"), h.Create)
	f.GET("/:id", auth.RequirePermission("config_mgmt_enhanced", "read"), h.Get)
	f.PUT("/:id", auth.RequirePermission("config_mgmt_enhanced", "write"), h.Update)
	f.DELETE("/:id", auth.RequirePermission("config_mgmt_enhanced", "delete"), h.Delete)

	// Change request business endpoints
	crg := f.Group("/change-requests")
	crg.POST("/:id/approve", auth.RequirePermission("config_mgmt_enhanced", "write"), h.ApproveChangeRequest)
	crg.POST("/:id/execute", auth.RequirePermission("config_mgmt_enhanced", "write"), h.ExecuteChangeRequest)
	crg.POST("/:id/rollback", auth.RequirePermission("config_mgmt_enhanced", "delete"), h.RollbackChangeRequest)
	crg.GET("/:id/history", auth.RequirePermission("config_mgmt_enhanced", "read"), h.GetChangeHistory)

	// Drift detection endpoints
	f.POST("/drift-detect", auth.RequirePermission("config_mgmt_enhanced", "read"), h.DriftDetect)
	f.POST("/drift/:id/remediate", auth.RequirePermission("config_mgmt_enhanced", "write"), h.RemediateDrift)
}

// getTenantID returns the caller's tenant. The bool matters:
// RespondUnauthorized does not call c.Abort(), so without it all 13 handlers
// kept running after the 401 with an empty tenant_id and the repository matched
// every row keyed on the empty string.
func (h *Handler) getTenantID(c *gin.Context) (string, bool) {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		middleware.RespondUnauthorized(c, "tenant_id required")
		return "", false
	}
	return tenantID, true
}

// actor is the authenticated identity the service records in the audit trail.
// The service used to write the literal string "system" for approved_by,
// executed_by and rolled_back_by, so the audit columns never named a person.
func actorFromContext(c *gin.Context) string {
	return c.GetString("user_id")
}

// respondServiceError maps service sentinels onto HTTP statuses. Every handler
// used to pick one status for every error: Get answered 500 for a deleted row
// and 400 for a database outage, Update answered 404 for an invalid state
// transition, and Approve/Execute/Rollback answered 400 for a missing row.
func respondServiceError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, sentinel.NotFound):
		middleware.RespondNotFound(c, err.Error())
	case errors.Is(err, service.ErrInvalidState), errors.Is(err, service.ErrInvalidInput):
		middleware.RespondBadRequest(c, err.Error())
	default:
		middleware.RespondInternalError(c, err.Error())
	}
}

func (h *Handler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "List")
	defer span.End()
	tenantID, ok := h.getTenantID(c)
	if !ok {
		return
	}
	entities, err := h.svc.List(ctx, tenantID)
	if err != nil {
		respondServiceError(c, err)
		return
	}
	middleware.RespondSuccess(c, models.PaginatedResponse{Data: entities, Total: len(entities), Page: 1, PageSize: len(entities)})
}

func (h *Handler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Create")
	defer span.End()
	var req models.CreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID, ok := h.getTenantID(c)
	if !ok {
		return
	}
	entity, err := h.svc.Create(ctx, &req, tenantID)
	if err != nil {
		respondServiceError(c, err)
		return
	}
	middleware.RespondCreated(c, entity)
}

func (h *Handler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Get")
	defer span.End()
	id := c.Param("id")
	tenantID, ok := h.getTenantID(c)
	if !ok {
		return
	}
	entity, err := h.svc.Get(ctx, id, tenantID)
	if err != nil {
		respondServiceError(c, err)
		return
	}
	middleware.RespondSuccess(c, entity)
}

func (h *Handler) Update(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Update")
	defer span.End()
	id := c.Param("id")
	var req models.UpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID, ok := h.getTenantID(c)
	if !ok {
		return
	}
	entity, err := h.svc.Update(ctx, id, tenantID, &req)
	if err != nil {
		respondServiceError(c, err)
		return
	}
	middleware.RespondSuccess(c, entity)
}

func (h *Handler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Delete")
	defer span.End()
	id := c.Param("id")
	tenantID, ok := h.getTenantID(c)
	if !ok {
		return
	}
	deleted, err := h.svc.Delete(ctx, id, tenantID)
	if err != nil {
		respondServiceError(c, err)
		return
	}
	if !deleted {
		middleware.RespondNotFound(c, "not found")
		return
	}
	middleware.RespondSuccess(c, gin.H{"deleted": true})
}

// ==================== Change Request Handlers ====================

func (h *Handler) ApproveChangeRequest(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ApproveChangeRequest")
	defer span.End()
	var req models.ApproveRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID, ok := h.getTenantID(c)
	if !ok {
		return
	}
	// The identity comes from the authenticated context, never the body: an
	// Approver field here would let a client approve another user's change and
	// claim someone else's signature.
	cr, err := h.svc.ApproveChangeRequest(ctx, tenantID, c.Param("id"), actorFromContext(c), &req)
	if err != nil {
		respondServiceError(c, err)
		return
	}
	middleware.RespondSuccess(c, cr)
}

func (h *Handler) ExecuteChangeRequest(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ExecuteChangeRequest")
	defer span.End()
	tenantID, ok := h.getTenantID(c)
	if !ok {
		return
	}
	cr, err := h.svc.ExecuteChangeRequest(ctx, tenantID, c.Param("id"), actorFromContext(c))
	if err != nil {
		respondServiceError(c, err)
		return
	}
	middleware.RespondSuccess(c, cr)
}

func (h *Handler) RollbackChangeRequest(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RollbackChangeRequest")
	defer span.End()
	var req models.RollbackRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID, ok := h.getTenantID(c)
	if !ok {
		return
	}
	cr, err := h.svc.RollbackChangeRequest(ctx, tenantID, c.Param("id"), actorFromContext(c), &req)
	if err != nil {
		respondServiceError(c, err)
		return
	}
	middleware.RespondSuccess(c, cr)
}

func (h *Handler) GetChangeHistory(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetChangeHistory")
	defer span.End()
	tenantID, ok := h.getTenantID(c)
	if !ok {
		return
	}
	entries, err := h.svc.GetChangeHistory(ctx, tenantID, c.Param("id"))
	if err != nil {
		respondServiceError(c, err)
		return
	}
	middleware.RespondSuccess(c, entries)
}

// ==================== Drift Handlers ====================

func (h *Handler) DriftDetect(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DriftDetect")
	defer span.End()
	var req models.DriftDetectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID, ok := h.getTenantID(c)
	if !ok {
		return
	}
	result, err := h.svc.DriftDetect(ctx, tenantID, &req)
	if err != nil {
		respondServiceError(c, err)
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) RemediateDrift(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RemediateDrift")
	defer span.End()
	var req models.RemediateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID, ok := h.getTenantID(c)
	if !ok {
		return
	}
	dr, err := h.svc.RemediateDrift(ctx, tenantID, c.Param("id"), &req)
	if err != nil {
		respondServiceError(c, err)
		return
	}
	middleware.RespondSuccess(c, dr)
}
