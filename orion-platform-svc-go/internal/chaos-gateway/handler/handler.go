package handler

import (
	"context"
	"net/http"
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/chaos-gateway/models"
	"orion/platform-svc-go/internal/chaos-gateway/service"

	"github.com/gin-gonic/gin"
)

// Handler exposes HTTP endpoints for chaos experiments.
type Handler struct {
	svc *service.Service
}

// NewHandler creates a new Handler.
func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes mounts all chaos-gateway routes under the given group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	r := rg.Group("/chaos")

	// GET /chaos/scenarios
	r.GET("/scenarios",
		auth.RequirePermission("chaos", "read"),
		h.GetScenarios)

	// GET /chaos
	r.GET("",
		auth.RequirePermission("chaos", "read"),
		h.ListExperiments)

	// POST /chaos
	r.POST("",
		auth.RequirePermission("chaos", "write"),
		h.CreateExperiment)

	// GET /chaos/:id
	r.GET("/:id",
		auth.RequirePermission("chaos", "read"),
		h.GetExperiment)

	// PUT /chaos/:id
	r.PUT("/:id",
		auth.RequirePermission("chaos", "write"),
		h.UpdateExperiment)

	// DELETE /chaos/:id
	r.DELETE("/:id",
		auth.RequirePermission("chaos", "delete"),
		h.DeleteExperiment)

	// POST /chaos/:id/start
	r.POST("/:id/start",
		auth.RequirePermission("chaos", "write"),
		h.StartExperiment)

	// POST /chaos/:id/stop
	r.POST("/:id/stop",
		auth.RequirePermission("chaos", "delete"),
		h.StopExperiment)

	// POST /chaos/:id/pause
	r.POST("/:id/pause",
		auth.RequirePermission("chaos", "write"),
		h.PauseExperiment)

	// POST /chaos/:id/resume
	r.POST("/:id/resume",
		auth.RequirePermission("chaos", "write"),
		h.ResumeExperiment)

	// GET /chaos/:id/results
	r.GET("/:id/results",
		auth.RequirePermission("chaos", "read"),
		h.GetResults)

	// GET /chaos/:id/logs
	r.GET("/:id/logs",
		auth.RequirePermission("chaos", "read"),
		h.GetLogs)

	// POST /chaos/schedule
	r.POST("/schedule",
		auth.RequirePermission("chaos", "write"),
		h.ScheduleExperiment)
}

// GetScenarios returns the built-in scenario definitions.
func (h *Handler) GetScenarios(c *gin.Context) {
	ctx := context.Background()
	scenarios, err := h.svc.GetScenarios(ctx)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"data": scenarios})
}

// ListExperiments returns a paginated list of experiments.
func (h *Handler) ListExperiments(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := context.Background()

	var q models.ListQuery
	if err := c.ShouldBindQuery(&q); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	if q.Limit <= 0 || q.Limit > 100 {
		q.Limit = 20
	}
	if q.Offset < 0 {
		q.Offset = 0
	}

	data, total, err := h.svc.ListExperiments(ctx, tenantID, q)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondPaginated(c, data, q.Offset, q.Limit, total)
}

// CreateExperiment creates a new experiment.
func (h *Handler) CreateExperiment(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	if userID == "" {
		userID = "system"
	}
	ctx := context.Background()

	var req models.CreateExperimentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	exp, err := h.svc.CreateExperiment(ctx, tenantID, userID, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, exp)
}

// GetExperiment retrieves a single experiment by id.
func (h *Handler) GetExperiment(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := context.Background()
	id := c.Param("id")

	exp, err := h.svc.GetExperiment(ctx, tenantID, id)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, exp)
}

// UpdateExperiment updates an experiment.
func (h *Handler) UpdateExperiment(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := context.Background()
	id := c.Param("id")

	var req models.UpdateExperimentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	exp, err := h.svc.UpdateExperiment(ctx, tenantID, id, req)
	if err != nil {
		// Map known errors.
		if err.Error() == "chaos experiment not found" {
			respondNotFound(c, err.Error())
			return
		}
		respondConflict(c, err.Error())
		return
	}
	respondSuccess(c, exp)
}

// DeleteExperiment deletes an experiment.
func (h *Handler) DeleteExperiment(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := context.Background()
	id := c.Param("id")

	err := h.svc.DeleteExperiment(ctx, tenantID, id)
	if err != nil {
		if err.Error() == "chaos experiment not found" {
			respondNotFound(c, err.Error())
			return
		}
		respondConflict(c, err.Error())
		return
	}
	respondNoContent(c)
}

// StartExperiment starts an experiment.
func (h *Handler) StartExperiment(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := context.Background()
	id := c.Param("id")

	exp, err := h.svc.StartExperiment(ctx, tenantID, id)
	if err != nil {
		respondConflict(c, err.Error())
		return
	}
	respondSuccess(c, exp)
}

// StopExperiment stops an experiment.
func (h *Handler) StopExperiment(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := context.Background()
	id := c.Param("id")

	exp, err := h.svc.StopExperiment(ctx, tenantID, id)
	if err != nil {
		respondConflict(c, err.Error())
		return
	}
	respondSuccess(c, exp)
}

// PauseExperiment pauses a running experiment.
func (h *Handler) PauseExperiment(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := context.Background()
	id := c.Param("id")

	exp, err := h.svc.PauseExperiment(ctx, tenantID, id)
	if err != nil {
		respondConflict(c, err.Error())
		return
	}
	respondSuccess(c, exp)
}

// ResumeExperiment resumes a paused experiment.
func (h *Handler) ResumeExperiment(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := context.Background()
	id := c.Param("id")

	exp, err := h.svc.ResumeExperiment(ctx, tenantID, id)
	if err != nil {
		respondConflict(c, err.Error())
		return
	}
	respondSuccess(c, exp)
}

// GetResults returns paginated results for an experiment.
func (h *Handler) GetResults(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := context.Background()
	id := c.Param("id")

	var q models.ListQuery
	_ = c.ShouldBindQuery(&q)
	if q.Limit <= 0 || q.Limit > 100 {
		q.Limit = 20
	}
	if q.Offset < 0 {
		q.Offset = 0
	}

	data, total, err := h.svc.GetResults(ctx, tenantID, id, q)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondPaginated(c, data, q.Offset, q.Limit, total)
}

// GetLogs returns paginated logs for an experiment.
func (h *Handler) GetLogs(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := context.Background()
	id := c.Param("id")

	var q models.ListQuery
	_ = c.ShouldBindQuery(&q)
	if q.Limit <= 0 || q.Limit > 200 {
		q.Limit = 100
	}
	if q.Offset < 0 {
		q.Offset = 0
	}

	data, total, err := h.svc.GetLogs(ctx, tenantID, id, q)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondPaginated(c, data, q.Offset, q.Limit, total)
}

// ScheduleExperiment creates a scheduled experiment.
func (h *Handler) ScheduleExperiment(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	if userID == "" {
		userID = "system"
	}
	ctx := context.Background()

	var req models.ScheduleExperimentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	exp, err := h.svc.ScheduleExperiment(ctx, tenantID, userID, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, exp)
}

// unused import fix
var _ = http.StatusOK
var _ = strconv.Itoa
