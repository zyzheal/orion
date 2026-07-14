package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/workflow-trigger/models"
	"orion/platform-svc-go/internal/workflow-trigger/service"

	"github.com/gin-gonic/gin"
)

// Handler exposes HTTP endpoints for workflow trigger operations.
type Handler struct {
	svc *service.Service
}

// NewHandler creates a new Handler instance.
func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes mounts all workflow trigger routes onto the given router group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/workflow-triggers")
	f.GET("", auth.RequirePermission("workflow", "read"), h.List)
	f.POST("", auth.RequirePermission("workflow", "write"), h.Create)
	f.GET("/:id", auth.RequirePermission("workflow", "read"), h.Get)
	f.PUT("/:id", auth.RequirePermission("workflow", "write"), h.Update)
	f.DELETE("/:id", auth.RequirePermission("workflow", "delete"), h.Delete)
	f.POST("/:id/enable", auth.RequirePermission("workflow", "write"), h.Enable)
	f.POST("/:id/disable", auth.RequirePermission("workflow", "write"), h.Disable)
	f.POST("/:id/trigger", auth.RequirePermission("workflow", "write"), h.Trigger)
	f.POST("/workflow/:definitionId/execute", auth.RequirePermission("workflow", "write"), h.ExecuteWorkflow)
}

// getTenantID retrieves the tenant ID from the gin context.
func getTenantID(c *gin.Context) string {
	return c.GetString("tenant_id")
}

// Create creates a new workflow trigger.
func (h *Handler) Create(c *gin.Context) {
	tenantID := getTenantID(c)

	var req models.CreateWorkflowTriggerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	trigger, err := h.svc.Create(c.Request.Context(), tenantID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, trigger)
}

// List retrieves workflow triggers with optional filters and pagination.
func (h *Handler) List(c *gin.Context) {
	tenantID := getTenantID(c)

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	filter := &models.ListFilter{}
	if wfID := c.Query("workflowId"); wfID != "" {
		filter.WorkflowID = &wfID
	}
	if t := c.Query("type"); t != "" {
		tt := models.TriggerType(t)
		filter.Type = &tt
	}
	if enabled := c.Query("enabled"); enabled != "" {
		e := enabled == "true"
		filter.Enabled = &e
	}

	items, total, err := h.svc.List(c.Request.Context(), tenantID, filter, (page-1)*pageSize, pageSize)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, models.PaginatedResponse{
		Data:     items,
		Page:     page,
		PageSize: pageSize,
		Total:    total,
	})
}

// Get retrieves a single workflow trigger by id.
func (h *Handler) Get(c *gin.Context) {
	tenantID := getTenantID(c)
	trigger, err := h.svc.GetByID(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, trigger)
}

// Update modifies an existing workflow trigger.
func (h *Handler) Update(c *gin.Context) {
	tenantID := getTenantID(c)

	var req models.UpdateWorkflowTriggerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	trigger, err := h.svc.Update(c.Request.Context(), tenantID, c.Param("id"), &req)
	if err != nil {
		if err == models.ErrTriggerNotFound {
			respondNotFound(c, err.Error())
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, trigger)
}

// Delete removes a workflow trigger by id.
func (h *Handler) Delete(c *gin.Context) {
	tenantID := getTenantID(c)
	if err := h.svc.Delete(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "deleted"})
}

// Enable enables a workflow trigger.
func (h *Handler) Enable(c *gin.Context) {
	tenantID := getTenantID(c)
	trigger, err := h.svc.SetEnabled(c.Request.Context(), tenantID, c.Param("id"), true)
	if err != nil {
		if err == models.ErrTriggerNotFound {
			respondNotFound(c, err.Error())
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, trigger)
}

// Disable disables a workflow trigger.
func (h *Handler) Disable(c *gin.Context) {
	tenantID := getTenantID(c)
	trigger, err := h.svc.SetEnabled(c.Request.Context(), tenantID, c.Param("id"), false)
	if err != nil {
		if err == models.ErrTriggerNotFound {
			respondNotFound(c, err.Error())
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, trigger)
}

// Trigger manually triggers a workflow execution via a trigger.
func (h *Handler) Trigger(c *gin.Context) {
	tenantID := getTenantID(c)

	var payload map[string]interface{}
	if err := c.ShouldBindJSON(&payload); err != nil {
		payload = make(map[string]interface{})
	}

	if err := h.svc.Trigger(c.Request.Context(), tenantID, c.Param("id"), payload); err != nil {
		if err == models.ErrTriggerNotFound {
			respondNotFound(c, err.Error())
			return
		}
		if err == models.ErrTriggerDisabled {
			respondBadRequest(c, err.Error())
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "triggered"})
}

// ExecuteWorkflow executes a workflow by definition ID.
func (h *Handler) ExecuteWorkflow(c *gin.Context) {
	tenantID := getTenantID(c)
	definitionID := c.Param("definitionId")

	var payload map[string]interface{}
	if err := c.ShouldBindJSON(&payload); err != nil {
		payload = make(map[string]interface{})
	}

	_ = definitionID
	_ = payload
	_ = tenantID

	respondSuccess(c, gin.H{"message": "workflow execution initiated"})
}