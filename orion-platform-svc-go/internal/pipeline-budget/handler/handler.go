package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/pipeline-budget/models"
	"orion/platform-svc-go/internal/pipeline-budget/service"

	"github.com/gin-gonic/gin"
)

// Handler exposes HTTP endpoints for pipeline budget management.
type Handler struct {
	svc *service.Service
}

// NewHandler creates a new Handler instance.
func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes mounts all pipeline-budget routes under the pipelines group.
// Routes mirror the TS pipeline-budget.routes.ts Fastify definitions:
//
//   GET    /pipelines/:id/budget
//   PUT    /pipelines/:id/budget
//   GET    /pipelines/:id/budget/usage
//   GET    /pipelines/:id/budget/alerts
//   POST   /pipelines/:id/budget/alerts
//   PUT    /pipelines/:id/budget/alerts/:alertId
//   DELETE /pipelines/:id/budget/alerts/:alertId
//   GET    /pipelines/:id/budget/history
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	r := rg.Group("/pipelines/:pipelineId/budget")

	// Budget config
	r.GET("", auth.RequirePermission("pipeline_budget", "read"), h.GetBudget)
	r.PUT("", auth.RequirePermission("pipeline_budget", "write"), h.UpsertBudget)

	// Usage
	r.GET("/usage", auth.RequirePermission("pipeline_budget", "read"), h.GetUsage)

	// Alerts CRUD
	r.GET("/alerts", auth.RequirePermission("pipeline_budget", "read"), h.ListAlerts)
	r.POST("/alerts", auth.RequirePermission("pipeline_budget", "write"), h.CreateAlert)
	r.PUT("/alerts/:alertId", auth.RequirePermission("pipeline_budget", "write"), h.UpdateAlert)
	r.DELETE("/alerts/:alertId", auth.RequirePermission("pipeline_budget", "delete"), h.DeleteAlert)

	// History
	r.GET("/history", auth.RequirePermission("pipeline_budget", "read"), h.ListHistory)
}

// ===========================================================================
// Budget config
// ===========================================================================

// GetBudget retrieves the budget configuration for a pipeline.
// GET /pipelines/:pipelineId/budget
func (h *Handler) GetBudget(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	pipelineID := c.Param("pipelineId")

	b, err := h.svc.GetBudget(c.Request.Context(), tenantID, pipelineID)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, b)
}

// UpsertBudget creates or updates a budget configuration for a pipeline.
// PUT /pipelines/:pipelineId/budget
func (h *Handler) UpsertBudget(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	pipelineID := c.Param("pipelineId")

	var req models.UpsertBudgetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	if len(req.Limits) == 0 {
		respondBadRequest(c, "limits must not be empty")
		return
	}

	b, err := h.svc.UpsertBudget(c.Request.Context(), tenantID, pipelineID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	// Mirror the TS behaviour: create returns 201, update returns 200.
	// We use 200 for both since the TS handler always sends status 200.
	respondSuccess(c, b)
}

// ===========================================================================
// Usage
// ===========================================================================

// GetUsage returns the current budget usage snapshot for a pipeline.
// GET /pipelines/:pipelineId/budget/usage
func (h *Handler) GetUsage(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	pipelineID := c.Param("pipelineId")

	usage, err := h.svc.GetBudgetUsage(c.Request.Context(), tenantID, pipelineID)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, usage)
}

// ===========================================================================
// Alerts
// ===========================================================================

// ListAlerts returns all alert rules for a pipeline's budget.
// GET /pipelines/:pipelineId/budget/alerts
func (h *Handler) ListAlerts(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	pipelineID := c.Param("pipelineId")

	alerts, err := h.svc.GetAlerts(c.Request.Context(), tenantID, pipelineID)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"data": alerts, "total": len(alerts)})
}

// CreateAlert creates a new alert rule.
// POST /pipelines/:pipelineId/budget/alerts
func (h *Handler) CreateAlert(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	pipelineID := c.Param("pipelineId")

	var req models.CreateAlertRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	alert, err := h.svc.CreateAlert(c.Request.Context(), tenantID, pipelineID, &req)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondCreated(c, alert)
}

// UpdateAlert patches an existing alert rule.
// PUT /pipelines/:pipelineId/budget/alerts/:alertId
func (h *Handler) UpdateAlert(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	pipelineID := c.Param("pipelineId")
	alertID := c.Param("alertId")

	var req models.UpdateAlertRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	alert, err := h.svc.UpdateAlert(c.Request.Context(), tenantID, pipelineID, alertID, &req)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, alert)
}

// DeleteAlert removes an alert rule.
// DELETE /pipelines/:pipelineId/budget/alerts/:alertId
func (h *Handler) DeleteAlert(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	pipelineID := c.Param("pipelineId")
	alertID := c.Param("alertId")

	if err := h.svc.DeleteAlert(c.Request.Context(), tenantID, pipelineID, alertID); err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondNoContent(c)
}

// ===========================================================================
// History
// ===========================================================================

// ListHistory returns paginated budget history for a pipeline.
// GET /pipelines/:pipelineId/budget/history
func (h *Handler) ListHistory(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	pipelineID := c.Param("pipelineId")

	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	q := &models.ListQuery{
		Offset: &offset,
		Limit:  &limit,
	}

	page, err := h.svc.GetHistoryPage(c.Request.Context(), tenantID, pipelineID, q)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondPaginated(c, page.Items, offset, limit, page.Total)
}
