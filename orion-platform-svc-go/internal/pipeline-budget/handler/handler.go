package handler

import (
	"context"
	"strconv"
	"orion/platform-svc-go/internal/middleware"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/pipeline-budget/models"
	"orion/platform-svc-go/internal/pipeline-budget/service"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel/trace"
)

// BudgetService defines the contract the handler needs from the service layer.
type BudgetService interface {
	GetBudget(ctx context.Context, tenantID, pipelineID string) (*models.BudgetConfig, error)
	UpsertBudget(ctx context.Context, tenantID, pipelineID string, req *models.UpsertBudgetRequest) (*models.BudgetConfig, error)
	GetBudgetUsage(ctx context.Context, tenantID, pipelineID string) (*models.BudgetUsage, error)
	GetAlerts(ctx context.Context, tenantID, pipelineID string) ([]models.BudgetAlert, error)
	CreateAlert(ctx context.Context, tenantID, pipelineID string, req *models.CreateAlertRequest) (*models.BudgetAlert, error)
	UpdateAlert(ctx context.Context, tenantID, pipelineID, alertID string, req *models.UpdateAlertRequest) (*models.BudgetAlert, error)
	DeleteAlert(ctx context.Context, tenantID, pipelineID, alertID string) error
	GetHistoryPage(ctx context.Context, tenantID, pipelineID string, q *models.ListQuery) (*service.HistoryPage, error)
}

// Handler exposes HTTP endpoints for pipeline budget management.
type Handler struct {
	svc BudgetService
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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetBudget")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	pipelineID := c.Param("pipelineId")

	b, err := h.svc.GetBudget(ctx, tenantID, pipelineID)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, b)
}

// UpsertBudget creates or updates a budget configuration for a pipeline.
// PUT /pipelines/:pipelineId/budget
func (h *Handler) UpsertBudget(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpsertBudget")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	pipelineID := c.Param("pipelineId")

	var req models.UpsertBudgetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if len(req.Limits) == 0 {
		middleware.RespondBadRequest(c, "limits must not be empty")
		return
	}

	b, err := h.svc.UpsertBudget(ctx, tenantID, pipelineID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}

	// Mirror the TS behaviour: create returns 201, update returns 200.
	// We use 200 for both since the TS handler always sends status 200.
	middleware.RespondSuccess(c, b)
}

// ===========================================================================
// Usage
// ===========================================================================

// GetUsage returns the current budget usage snapshot for a pipeline.
// GET /pipelines/:pipelineId/budget/usage
func (h *Handler) GetUsage(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetUsage")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	pipelineID := c.Param("pipelineId")

	usage, err := h.svc.GetBudgetUsage(ctx, tenantID, pipelineID)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, usage)
}

// ===========================================================================
// Alerts
// ===========================================================================

// ListAlerts returns all alert rules for a pipeline's budget.
// GET /pipelines/:pipelineId/budget/alerts
func (h *Handler) ListAlerts(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListAlerts")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	pipelineID := c.Param("pipelineId")

	alerts, err := h.svc.GetAlerts(ctx, tenantID, pipelineID)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": alerts, "total": len(alerts)})
}

// CreateAlert creates a new alert rule.
// POST /pipelines/:pipelineId/budget/alerts
func (h *Handler) CreateAlert(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateAlert")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	pipelineID := c.Param("pipelineId")

	var req models.CreateAlertRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	alert, err := h.svc.CreateAlert(ctx, tenantID, pipelineID, &req)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondCreated(c, alert)
}

// UpdateAlert patches an existing alert rule.
// PUT /pipelines/:pipelineId/budget/alerts/:alertId
func (h *Handler) UpdateAlert(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateAlert")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	pipelineID := c.Param("pipelineId")
	alertID := c.Param("alertId")

	var req models.UpdateAlertRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	alert, err := h.svc.UpdateAlert(ctx, tenantID, pipelineID, alertID, &req)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, alert)
}

// DeleteAlert removes an alert rule.
// DELETE /pipelines/:pipelineId/budget/alerts/:alertId
func (h *Handler) DeleteAlert(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteAlert")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	pipelineID := c.Param("pipelineId")
	alertID := c.Param("alertId")

	if err := h.svc.DeleteAlert(ctx, tenantID, pipelineID, alertID); err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondNoContent(c)
}

// ===========================================================================
// History
// ===========================================================================

// ListHistory returns paginated budget history for a pipeline.
// GET /pipelines/:pipelineId/budget/history
func (h *Handler) ListHistory(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListHistory")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	pipelineID := c.Param("pipelineId")

	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	q := &models.ListQuery{
		Offset: &offset,
		Limit:  &limit,
	}

	page, err := h.svc.GetHistoryPage(ctx, tenantID, pipelineID, q)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondPaginated(c, page.Items, offset, limit, page.Total)
}
