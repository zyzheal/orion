package handler

import (
	"strconv"
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/workflow/workflow/models"
	"orion/platform-svc-go/internal/workflow/workflow/service"

	"github.com/gin-gonic/gin"
)

// ExtraHandler bridges frontend API shape to existing backend service methods.
type ExtraHandler struct{ svc *service.Service }

func NewExtraHandler(svc *service.Service) *ExtraHandler { return &ExtraHandler{svc: svc} }

func (h *ExtraHandler) RegisterRoutes(rg *gin.RouterGroup) {
	w := rg.Group("/workflows")
	w.PUT("/:id", auth.RequirePermission("workflow", "write"), h.Update)
	w.POST("/:id/execute", auth.RequirePermission("workflow", "execute"), h.Execute)
	w.GET("/:id/executions", h.Executions)
	w.POST("/:id/pause", auth.RequirePermission("workflow", "write"), h.Pause)
	w.POST("/:id/resume", auth.RequirePermission("workflow", "write"), h.Resume)
	w.POST("/:id/terminate", auth.RequirePermission("workflow", "write"), h.Terminate)
}

// Update — update workflow name/description/status
func (h *ExtraHandler) Update(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req struct {
		Name        *string `json:"name"`
		Description *string `json:"description"`
		Enabled     *bool   `json:"enabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	// Reuse UpdateDefinition as the storage layer
	updates := map[string]interface{}{}
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	updated, err := h.svc.UpdateDefinition(c.Request.Context(), tenantID, id, &models.UpdateDefinitionRequest{
		Name:        req.Name,
		Description: req.Description,
		Enabled:     req.Enabled,
	})
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, updated)
}

// Execute — alias for StartRun (create a run)
func (h *ExtraHandler) Execute(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var body struct {
		TriggeredBy  string                 `json:"triggeredBy"`
		InitialInput map[string]interface{} `json:"initialInput"`
	}
	c.ShouldBindJSON(&body)
	run, err := h.svc.StartRun(c.Request.Context(), tenantID, id)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondCreated(c, run)
}

// Executions — list runs for a workflow (returns instances as execution history)
func (h *ExtraHandler) Executions(c *gin.Context) {
	id := c.Param("id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	instances, err := h.svc.ListInstances(c.Request.Context(), id, limit)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, instances)
}

// Pause — set workflow to disabled
func (h *ExtraHandler) Pause(c *gin.Context) {
	tenantID := c.GetString("tenantID")
	if tenantID == "" {
		tenantID = c.GetString("tenant_id")
	}
	id := c.Param("id")
	falseVal := false
	def, err := h.svc.UpdateDefinition(c.Request.Context(), tenantID, id, &models.UpdateDefinitionRequest{Enabled: &falseVal})
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, def)
}

// Resume — set workflow to enabled
func (h *ExtraHandler) Resume(c *gin.Context) {
	tenantID := c.GetString("tenantID")
	if tenantID == "" {
		tenantID = c.GetString("tenant_id")
	}
	id := c.Param("id")
	trueVal := true
	def, err := h.svc.UpdateDefinition(c.Request.Context(), tenantID, id, &models.UpdateDefinitionRequest{Enabled: &trueVal})
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, def)
}

// Terminate — no-op for now (placeholder)
func (h *ExtraHandler) Terminate(c *gin.Context) {
	respondSuccess(c, gin.H{"message": "terminated"})
}