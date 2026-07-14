package handler

import (
	"net/http"
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/errors"
	"orion/platform-svc-go/internal/lowcode/models"
	"orion/platform-svc-go/internal/lowcode/service"

	"github.com/gin-gonic/gin"
)

// Handler exposes HTTP endpoints for the lowcode module.
type Handler struct {
	svc *service.Service
}

// NewHandler creates a new Handler instance.
func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// getTenantID extracts tenant ID from the Gin context.
func getTenantID(c *gin.Context) string {
	return c.GetString("tenant_id")
}

// RegisterRoutes mounts all lowcode endpoints under the given group.
// Mirrors /api/v1/lowcode routes from the TS lowcode-routes.ts source (14 endpoints).
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/lowcode")

	// GET /lowcode/flows - List flows
	f.GET("/flows", auth.RequirePermission("lowcode", "read"), h.ListFlows)
	// GET /lowcode/flows/:id - Get flow detail
	f.GET("/flows/:id", auth.RequirePermission("lowcode", "read"), h.GetFlow)
	// POST /lowcode/flows - Create flow
	f.POST("/flows", auth.RequirePermission("lowcode", "write"), h.CreateFlow)
	// PUT /lowcode/flows/:id - Update flow
	f.PUT("/flows/:id", auth.RequirePermission("lowcode", "write"), h.UpdateFlow)
	// DELETE /lowcode/flows/:id - Delete flow
	f.DELETE("/flows/:id", auth.RequirePermission("lowcode", "delete"), h.DeleteFlow)
	// POST /lowcode/flows/:id/publish - Publish flow
	f.POST("/flows/:id/publish", auth.RequirePermission("lowcode", "write"), h.PublishFlow)
	// POST /lowcode/flows/:id/execute - Execute flow
	f.POST("/flows/:id/execute", auth.RequirePermission("lowcode", "execute"), h.ExecuteFlow)
	// POST /lowcode/workflows/:id/versions - Create version snapshot
	f.POST("/workflows/:id/versions", auth.RequirePermission("lowcode", "write"), h.CreateVersion)
	// GET /lowcode/workflows/:id/versions - List versions
	f.GET("/workflows/:id/versions", auth.RequirePermission("lowcode", "read"), h.ListVersions)
	// POST /lowcode/workflows/import - Import workflow
	f.POST("/workflows/import", auth.RequirePermission("lowcode", "write"), h.ImportWorkflow)
	// POST /lowcode/workflows/:id/export - Export workflow
	f.POST("/workflows/:id/export", auth.RequirePermission("lowcode", "read"), h.ExportWorkflow)
	// GET /lowcode/templates - List templates
	f.GET("/templates", auth.RequirePermission("lowcode", "read"), h.ListTemplates)
	// POST /lowcode/templates - Create template
	f.POST("/templates", auth.RequirePermission("lowcode", "write"), h.CreateTemplate)
	// POST /lowcode/templates/:id/apply - Apply template
	f.POST("/templates/:id/apply", auth.RequirePermission("lowcode", "write"), h.ApplyTemplate)
}

// --- Flow Handlers ---

// ListFlows handles GET /flows
func (h *Handler) ListFlows(c *gin.Context) {
	tenantID := getTenantID(c)

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	filter := &models.ListFlowFilters{}
	if enabledStr := c.Query("enabled"); enabledStr != "" {
		enabled := enabledStr == "true"
		filter.Enabled = &enabled
	}
	if search := c.Query("search"); search != "" {
		filter.Search = &search
	}

	items, total, err := h.svc.ListFlows(c.Request.Context(), tenantID, filter, page, pageSize)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}

	errors.WriteSuccess(c, gin.H{
		"data":      items,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

// GetFlow handles GET /flows/:id
func (h *Handler) GetFlow(c *gin.Context) {
	tenantID := getTenantID(c)
	flow, err := h.svc.GetFlow(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		if err == service.ErrFlowNotFound {
			respondNotFound(c, "flow not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, flow)
}

// CreateFlow handles POST /flows
func (h *Handler) CreateFlow(c *gin.Context) {
	tenantID := getTenantID(c)
	userID := c.GetString("user_id")

	var req models.CreateFlowRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	flow, err := h.svc.CreateFlow(c.Request.Context(), tenantID, userID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, flow)
}

// UpdateFlow handles PUT /flows/:id
func (h *Handler) UpdateFlow(c *gin.Context) {
	tenantID := getTenantID(c)

	var req models.UpdateFlowRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	flow, err := h.svc.UpdateFlow(c.Request.Context(), tenantID, c.Param("id"), &req)
	if err != nil {
		if err == service.ErrFlowNotFound {
			respondNotFound(c, "flow not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, flow)
}

// DeleteFlow handles DELETE /flows/:id
func (h *Handler) DeleteFlow(c *gin.Context) {
	tenantID := getTenantID(c)
	if err := h.svc.DeleteFlow(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		if err == service.ErrFlowNotFound {
			respondNotFound(c, "flow not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "deleted"})
}

// PublishFlow handles POST /flows/:id/publish
func (h *Handler) PublishFlow(c *gin.Context) {
	tenantID := getTenantID(c)
	flow, err := h.svc.PublishFlow(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		if err == service.ErrFlowNotFound {
			respondNotFound(c, "flow not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, flow)
}

// ExecuteFlow handles POST /flows/:id/execute
func (h *Handler) ExecuteFlow(c *gin.Context) {
	tenantID := getTenantID(c)
	userID := c.GetString("user_id")

	var input struct {
		Input string `json:"input"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		input.Input = ""
	}

	inst, err := h.svc.ExecuteFlow(c.Request.Context(), tenantID, userID, c.Param("id"), input.Input)
	if err != nil {
		if err == service.ErrFlowNotFound {
			respondNotFound(c, "flow not found")
			return
		}
		if err == service.ErrFlowNotEnabled {
			errors.WriteError(c, errors.ErrBadRequest, err.Error(), http.StatusBadRequest)
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, inst)
}

// --- Version Handlers ---

// CreateVersion handles POST /workflows/:id/versions
func (h *Handler) CreateVersion(c *gin.Context) {
	tenantID := getTenantID(c)
	userID := c.GetString("user_id")

	snap, err := h.svc.CreateVersion(c.Request.Context(), tenantID, userID, c.Param("id"))
	if err != nil {
		if err == service.ErrFlowNotFound {
			respondNotFound(c, "flow not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, snap)
}

// ListVersions handles GET /workflows/:id/versions
func (h *Handler) ListVersions(c *gin.Context) {
	tenantID := getTenantID(c)
	snapshots, err := h.svc.ListVersions(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		if err == service.ErrFlowNotFound {
			respondNotFound(c, "flow not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, snapshots)
}

// --- Import / Export Handlers ---

// ImportWorkflow handles POST /workflows/import
func (h *Handler) ImportWorkflow(c *gin.Context) {
	tenantID := getTenantID(c)
	userID := c.GetString("user_id")

	var req models.ImportWorkflowRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	flow, err := h.svc.ImportWorkflow(c.Request.Context(), tenantID, userID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, flow)
}

// ExportWorkflow handles POST /workflows/:id/export
func (h *Handler) ExportWorkflow(c *gin.Context) {
	tenantID := getTenantID(c)
	resp, err := h.svc.ExportWorkflow(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		if err == service.ErrFlowNotFound {
			respondNotFound(c, "flow not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, resp)
}

// --- Template Handlers ---

// ListTemplates handles GET /templates
func (h *Handler) ListTemplates(c *gin.Context) {
	items, err := h.svc.ListTemplates(c.Request.Context())
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

// CreateTemplate handles POST /templates
func (h *Handler) CreateTemplate(c *gin.Context) {
	userID := c.GetString("user_id")

	var req models.CreateTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	tmpl, err := h.svc.CreateTemplate(c.Request.Context(), userID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, tmpl)
}

// ApplyTemplate handles POST /templates/:id/apply
func (h *Handler) ApplyTemplate(c *gin.Context) {
	tenantID := getTenantID(c)
	userID := c.GetString("user_id")

	var req models.ApplyTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	flow, err := h.svc.ApplyTemplate(c.Request.Context(), tenantID, userID, c.Param("id"), &req)
	if err != nil {
		if err == service.ErrTemplateNotFound {
			respondNotFound(c, "template not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, flow)
}