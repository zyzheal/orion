// HTTP handler for ADR-015 §4.1 Change 三层 SOP.
//
// REST paths follow the natural hierarchical mapping:
//   /change-templates                     (CRUD templates)
//   /change-templates/:tid/sops           (CRUD SOPs scoped by template)
//   /change-sops/:id                      (top-level SOP access — for detail + step attach)
//   /change-sops/:id/steps                (CRUD steps scoped by SOP)
//
// Permission scope: "change-template" for all three layers (unified domain).
// Auth is asserted at the route level; the handler reads tenant_id and
// current user from gin.Context (set by middleware upstream).
package template

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/middleware"
)

// Handler exposes HTTP routes over the ServiceInterface.
type Handler struct {
	svc ServiceInterface
}

// Compile-time: Handler methods satisfy the ServiceInterface signature
// (the svc field does). Kept explicit for reader.
var _ = ServiceInterface(nil)

// NewHandler constructs a Handler. svc must not be nil.
func NewHandler(svc ServiceInterface) *Handler {
	if svc == nil {
		return nil
	}
	return &Handler{svc: svc}
}

// RegisterRoutes attaches all change-template routes under rg.
// Caller decides the parent path; typically rg = api.Group("/v1").
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/change-templates")
	f.GET("", auth.RequirePermission("change-template", "read"), h.ListTemplates)
	f.POST("", auth.RequirePermission("change-template", "write"), h.CreateTemplate)
	f.GET("/:id", auth.RequirePermission("change-template", "read"), h.GetTemplate)
	f.PUT("/:id", auth.RequirePermission("change-template", "write"), h.UpdateTemplate)
	f.DELETE("/:id", auth.RequirePermission("change-template", "delete"), h.DeleteTemplate)
	// Nested SOPs under a template.
	f.GET("/:id/sops", auth.RequirePermission("change-template", "read"), h.ListSOPs)
	f.POST("/:id/sops", auth.RequirePermission("change-template", "write"), h.CreateSOPUnderTemplate)

	sops := rg.Group("/change-sops")
	sops.GET("/:id", auth.RequirePermission("change-template", "read"), h.GetSOPDetail)
	sops.PUT("/:id", auth.RequirePermission("change-template", "write"), h.UpdateSOP)
	sops.DELETE("/:id", auth.RequirePermission("change-template", "delete"), h.DeleteSOP)
	sops.GET("/:id/steps", auth.RequirePermission("change-template", "read"), h.ListSteps)
	sops.POST("/:id/steps", auth.RequirePermission("change-template", "write"), h.CreateStepUnderSOP)

	steps := rg.Group("/change-sop-steps")
	steps.GET("/:id", auth.RequirePermission("change-template", "read"), h.GetStep)
	steps.PUT("/:id", auth.RequirePermission("change-template", "write"), h.UpdateStep)
	steps.DELETE("/:id", auth.RequirePermission("change-template", "delete"), h.DeleteStep)
}

// --- Template handlers ---

func (h *Handler) ListTemplates(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListChangeTemplates")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	onlyActive := c.Query("onlyActive") == "true"
	result, err := h.svc.ListTemplates(ctx, tenantID, onlyActive)
	if err != nil {
		h.respondErr(c, err)
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": result, "total": len(result)})
}

func (h *Handler) GetTemplate(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetChangeTemplate")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	result, err := h.svc.GetTemplate(ctx, tenantID, id)
	if err != nil {
		h.respondErr(c, err)
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) CreateTemplate(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateChangeTemplate")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	var req CreateChangeTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.CreateTemplate(ctx, tenantID, &req, userID)
	if err != nil {
		h.respondErr(c, err)
		return
	}
	middleware.RespondCreated(c, result)
}

func (h *Handler) UpdateTemplate(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateChangeTemplate")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req UpdateChangeTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.UpdateTemplate(ctx, tenantID, id, &req)
	if err != nil {
		h.respondErr(c, err)
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) DeleteTemplate(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteChangeTemplate")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	deleted, err := h.svc.DeleteTemplate(ctx, tenantID, id)
	if err != nil {
		h.respondErr(c, err)
		return
	}
	if !deleted {
		middleware.RespondNotFound(c, "change template not found")
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "deleted"})
}

// --- SOP handlers ---

func (h *Handler) ListSOPs(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListChangeSOPs")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	templateID := c.Param("id")
	onlyActive := c.Query("onlyActive") == "true"
	result, err := h.svc.ListSOPs(ctx, tenantID, templateID, onlyActive)
	if err != nil {
		h.respondErr(c, err)
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": result, "total": len(result)})
}

func (h *Handler) CreateSOPUnderTemplate(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateChangeSOP")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	var req CreateChangeSOPRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	// If body doesn't set TemplateID, fall back to the path param (route context).
	if req.TemplateID == "" {
		req.TemplateID = c.Param("id")
	}
	result, err := h.svc.CreateSOP(ctx, tenantID, &req, userID)
	if err != nil {
		h.respondErr(c, err)
		return
	}
	middleware.RespondCreated(c, result)
}

func (h *Handler) GetSOPDetail(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetChangeSOPDetail")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	result, err := h.svc.GetSOPDetail(ctx, tenantID, id)
	if err != nil {
		h.respondErr(c, err)
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) UpdateSOP(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateChangeSOP")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req UpdateChangeSOPRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.UpdateSOP(ctx, tenantID, id, &req)
	if err != nil {
		h.respondErr(c, err)
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) DeleteSOP(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteChangeSOP")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	deleted, err := h.svc.DeleteSOP(ctx, tenantID, id)
	if err != nil {
		h.respondErr(c, err)
		return
	}
	if !deleted {
		middleware.RespondNotFound(c, "change sop not found")
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "deleted"})
}

// --- Step handlers ---

func (h *Handler) ListSteps(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListChangeSOPSteps")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	sopID := c.Param("id")
	result, err := h.svc.ListSteps(ctx, tenantID, sopID)
	if err != nil {
		h.respondErr(c, err)
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": result, "total": len(result)})
}

func (h *Handler) CreateStepUnderSOP(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateChangeSOPStep")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	var req CreateChangeSopStepRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if req.SOPID == "" {
		req.SOPID = c.Param("id")
	}
	result, err := h.svc.CreateStep(ctx, tenantID, &req, userID)
	if err != nil {
		h.respondErr(c, err)
		return
	}
	middleware.RespondCreated(c, result)
}

func (h *Handler) GetStep(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetChangeSOPStep")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	result, err := h.svc.GetStep(ctx, tenantID, id)
	if err != nil {
		h.respondErr(c, err)
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) UpdateStep(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateChangeSOPStep")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req UpdateChangeSopStepRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.UpdateStep(ctx, tenantID, id, &req)
	if err != nil {
		h.respondErr(c, err)
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) DeleteStep(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteChangeSOPStep")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	deleted, err := h.svc.DeleteStep(ctx, tenantID, id)
	if err != nil {
		h.respondErr(c, err)
		return
	}
	if !deleted {
		middleware.RespondNotFound(c, "change sop step not found")
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "deleted"})
}

// respondErr maps repository sentinels to HTTP responses. Unknown
// errors are returned as 500 with the message — no sensitive
// repository details leak beyond the top-level message.
func (h *Handler) respondErr(c *gin.Context, err error) {
	switch {
	case errors.Is(err, ErrNotFound):
		middleware.RespondNotFound(c, err.Error())
	case errors.Is(err, ErrVersionMismatch):
		middleware.RespondConflict(c, err.Error())
	case errors.Is(err, ErrDuplicate):
		middleware.RespondConflict(c, err.Error())
	case errors.Is(err, ErrValidation), errors.Is(err, ErrInvalidEnumValue):
		middleware.RespondBadRequest(c, err.Error())
	default:
		middleware.RespondInternalError(c, err.Error())
	}
	_ = http.StatusOK // marker for readability of middleware mapping
}
