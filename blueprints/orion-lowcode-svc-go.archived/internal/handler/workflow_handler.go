package handler

import (
	"strconv"
	"orion/lowcode-svc-go/internal/models"
	"orion/lowcode-svc-go/internal/service"
	"orion/go-common/pkg/auth"

	"github.com/gin-gonic/gin"
)

// WorkflowHandler handles all workflow/flow/template/version endpoints.
type WorkflowHandler struct {
	svc *service.Service
}

// NewWorkflowHandler creates a new WorkflowHandler.
func NewWorkflowHandler(svc *service.Service) *WorkflowHandler {
	return &WorkflowHandler{svc: svc}
}

// RegisterRoutes registers all workflow-related routes.
// Prefix /api/v1/lowcode (rg is /api/v1) to match Node.js lowcode-routes.ts.
func (h *WorkflowHandler) RegisterRoutes(rg *gin.RouterGroup) {
	// Flows (alias for workflow definitions)
	r := rg.Group("/lowcode/flows")
	r.GET("", h.ListWorkflows)
	r.GET("/:id", h.GetWorkflow)
	r.POST("", auth.RequirePermission("lowcode", "write"), h.CreateWorkflow)
	r.PUT("/:id", auth.RequirePermission("lowcode", "write"), h.UpdateWorkflow)
	r.DELETE("/:id", auth.RequirePermission("lowcode", "delete"), h.DeleteWorkflow)
	r.POST("/:id/publish", auth.RequirePermission("lowcode", "write"), h.PublishWorkflow)
	r.POST("/:id/execute", auth.RequirePermission("lowcode", "execute"), h.ExecuteWorkflow)

	// Workflows (versions, import, export)
	wf := rg.Group("/lowcode/workflows")
	wf.POST("/:id/versions", auth.RequirePermission("lowcode", "write"), h.CreateVersion)
	wf.GET("/:id/versions", h.ListVersions)
	wf.POST("/import", auth.RequirePermission("lowcode", "write"), h.ImportWorkflow)
	wf.POST("/:id/export", h.ExportWorkflow)

	// Templates
	tpl := rg.Group("/lowcode/templates")
	tpl.GET("", h.ListTemplates)
	tpl.POST("", auth.RequirePermission("lowcode", "write"), h.CreateTemplate)
	tpl.POST("/:id/apply", auth.RequirePermission("lowcode", "write"), h.ApplyTemplate)
}

// =====================================================================
// Flows (Workflow Definitions)
// =====================================================================

// ListWorkflows returns a paginated list of workflow definitions.
func (h *WorkflowHandler) ListWorkflows(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	enabledStr := c.Query("enabled")
	var enabled *bool
	if enabledStr != "" {
		b := enabledStr == "true"
		enabled = &b
	}
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	search := c.Query("search")

	defs, total, err := h.svc.ListWorkflows(c.Request.Context(), tenantID, enabled, offset, limit, search)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"data": defs, "total": total, "limit": limit, "offset": offset})
}

// GetWorkflow returns a single workflow definition.
func (h *WorkflowHandler) GetWorkflow(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	def, err := h.svc.GetWorkflowByID(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	if def == nil {
		respondNotFound(c, "not found")
		return
	}
	respondSuccess(c, def)
}

// CreateWorkflow creates a new workflow definition.
func (h *WorkflowHandler) CreateWorkflow(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	var req models.CreateWorkflowDefinitionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	req.CreatedBy = userID
	def, err := h.svc.CreateWorkflow(c.Request.Context(), tenantID, userID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, def)
}

// UpdateWorkflow updates an existing workflow definition.
func (h *WorkflowHandler) UpdateWorkflow(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.UpdateWorkflowDefinitionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	def, err := h.svc.UpdateWorkflow(c.Request.Context(), tenantID, c.Param("id"), &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	if def == nil {
		respondNotFound(c, "not found")
		return
	}
	respondSuccess(c, def)
}

// DeleteWorkflow deletes a workflow definition.
func (h *WorkflowHandler) DeleteWorkflow(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.DeleteWorkflow(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, map[string]any{"message": "deleted"})
}

// PublishWorkflow publishes (enables) a workflow and bumps its version.
func (h *WorkflowHandler) PublishWorkflow(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	def, err := h.svc.PublishWorkflow(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"data": def, "message": "published"})
}

// ExecuteWorkflow creates a new instance and starts execution.
func (h *WorkflowHandler) ExecuteWorkflow(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	var body map[string]any
	if err := c.ShouldBindJSON(&body); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	input, _ := body["input"].(map[string]any)
	inst, err := h.svc.ExecuteWorkflow(c.Request.Context(), tenantID, c.Param("id"), userID, input)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, gin.H{"data": inst, "message": "execution started"})
}

// =====================================================================
// Workflow Versions
// =====================================================================

// CreateVersion creates a version snapshot.
func (h *WorkflowHandler) CreateVersion(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	var body struct {
		CommitMsg string `json:"commit_message"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	v, err := h.svc.CreateVersion(c.Request.Context(), tenantID, c.Param("id"), userID, body.CommitMsg)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, v)
}

// ListVersions lists version snapshots for a workflow.
func (h *WorkflowHandler) ListVersions(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	versions, total, err := h.svc.ListVersions(c.Request.Context(), tenantID, c.Param("id"), offset, limit)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"data": versions, "total": total, "limit": limit, "offset": offset})
}

// =====================================================================
// Import / Export
// =====================================================================

// ImportWorkflow creates a workflow from imported data.
func (h *WorkflowHandler) ImportWorkflow(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	var req models.ImportWorkflowRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	req.CreatedBy = userID
	def, err := h.svc.ImportWorkflow(c.Request.Context(), tenantID, userID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, gin.H{"data": def, "message": "imported"})
}

// ExportWorkflow exports a workflow definition.
func (h *WorkflowHandler) ExportWorkflow(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	resp, err := h.svc.ExportWorkflow(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, resp)
}

// =====================================================================
// Templates
// =====================================================================

// ListTemplates returns a paginated list of templates.
func (h *WorkflowHandler) ListTemplates(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	templates, total, err := h.svc.ListTemplates(c.Request.Context(), tenantID, offset, limit)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"data": templates, "total": total})
}

// CreateTemplate creates a new workflow template.
func (h *WorkflowHandler) CreateTemplate(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	var req models.CreateTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	req.CreatedBy = userID
	tpl, err := h.svc.CreateTemplate(c.Request.Context(), tenantID, userID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, tpl)
}

// ApplyTemplate creates a workflow from a template.
func (h *WorkflowHandler) ApplyTemplate(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	var req models.ApplyTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	def, err := h.svc.ApplyTemplate(c.Request.Context(), tenantID, c.Param("id"), userID, req.WorkflowName, req.Description)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, gin.H{"data": def, "message": "template applied"})
}
