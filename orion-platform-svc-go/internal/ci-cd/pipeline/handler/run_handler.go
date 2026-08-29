package handler

import (
	"go.opentelemetry.io/otel"
	"net/http"
	"strconv"

	"orion/platform-svc-go/internal/ci-cd/pipeline/service"

	"github.com/gin-gonic/gin"
)

// RunHandler provides HTTP handlers for comprehensive run operations.
type RunHandler struct {
	runSvc     *service.RunService
	metricsSvc *service.MetricsService
}

func NewRunHandler(runSvc *service.RunService, metricsSvc *service.MetricsService) *RunHandler {
	return &RunHandler{
		runSvc:     runSvc,
		metricsSvc: metricsSvc,
	}
}

// RegisterRoutes registers run and metrics routes on the given router group.
func (h *RunHandler) RegisterRoutes(rg *gin.RouterGroup) {
	// Run detail and history endpoints
	runs := rg.Group("/runs")
	{
		// Run detail: run + stages + tasks in one call
		runs.GET("/:id/detail", h.GetRunDetail)

		// Run history trend by time period
		runs.GET("/:id/history", h.GetRunHistory)

		// Run completion check
		runs.GET("/:id/completion", h.CheckRunCompletion)

		// Find runs by status
		runs.GET("/status/:status", h.GetRunsByStatus)

		// Recent runs (for metrics)
		runs.GET("/recent", h.GetRecentRuns)
	}

	// Metrics endpoints
	metrics := rg.Group("/metrics")
	{
		metrics.GET("", h.GetMetrics)
		metrics.GET("/pipeline/:pipelineId", h.GetMetricsByPipeline)
		metrics.GET("/prometheus", h.GetPrometheusMetrics)
	}
}

// ============================================
// Run Detail
// ============================================

// GetRunDetail returns a run with its stages and tasks.
func (h *RunHandler) GetRunDetail(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PipelineRunGetRunDetail")
	defer span.End()
	runID := c.Param("id")

	detail, err := h.runSvc.GetRunDetail(ctx, runID)
	if err != nil {
		if err == service.ErrRunNotFound {
			respondNotFound(c, "run not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, gin.H{
		"run":    detail.Run,
		"stages": detail.Stages,
		"tasks":  detail.Tasks,
	})
}

// ============================================
// Run History
// ============================================

// GetRunHistory returns run history aggregated by time period.
func (h *RunHandler) GetRunHistory(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PipelineRunGetRunHistory")
	defer span.End()
	pipelineID := c.Param("id")
	period := c.DefaultQuery("period", "day")

	// Validate period
	switch period {
	case "day", "week", "month":
	default:
		period = "day"
	}

	history, err := h.runSvc.GetRunHistory(ctx, pipelineID, period)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, history)
}

// ============================================
// Completion Check
// ============================================

// CheckRunCompletion checks if all stages in a run are done.
func (h *RunHandler) CheckRunCompletion(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PipelineRunCheckRunCompletion")
	defer span.End()
	runID := c.Param("id")

	result, err := h.runSvc.CheckRunCompletion(ctx, runID)
	if err != nil {
		if err == service.ErrRunNotFound {
			respondNotFound(c, "run not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, gin.H{
		"is_complete": result.IsComplete,
		"all_success": result.AllSuccess,
	})
}

// ============================================
// Runs by Status
// ============================================

// GetRunsByStatus returns runs filtered by status.
func (h *RunHandler) GetRunsByStatus(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PipelineRunGetRunsByStatus")
	defer span.End()
	status := c.Param("status")

	runs, err := h.runSvc.GetRunsByStatus(ctx, status)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, runs)
}

// ============================================
// Recent Runs
// ============================================

// GetRecentRuns returns the most recent N runs.
func (h *RunHandler) GetRecentRuns(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PipelineRunGetRecentRuns")
	defer span.End()
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	if limit <= 0 || limit > 100 {
		limit = 20
	}

	runs := h.metricsSvc.GetRecentRuns(limit)

	respondSuccess(c, runs)
}

// ============================================
// Metrics
// ============================================

// GetMetrics returns aggregated pipeline metrics.
func (h *RunHandler) GetMetrics(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PipelineRunGetMetrics")
	defer span.End()
	metrics, err := h.metricsSvc.GetMetricsFromDB()
	if err != nil {
		// Fallback to memory
		metrics = h.metricsSvc.GetMetrics()
	}

	respondSuccess(c, metrics)
}

// GetMetricsByPipeline returns metrics for a specific pipeline.
func (h *RunHandler) GetMetricsByPipeline(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PipelineRunGetMetricsByPipeline")
	defer span.End()
	pipelineID := c.Param("pipelineId")

	summary := h.metricsSvc.GetMetricsByPipeline(pipelineID)

	respondSuccess(c, gin.H{
		"total":         summary.Total,
		"success":       summary.Success,
		"avgDurationMs": summary.AvgDurationMs,
	})
}

// GetPrometheusMetrics exports metrics in Prometheus exposition format.
func (h *RunHandler) GetPrometheusMetrics(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PipelineRunGetPrometheusMetrics")
	defer span.End()
	c.Header("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
	c.String(http.StatusOK, h.metricsSvc.GetPrometheusMetrics())
}
