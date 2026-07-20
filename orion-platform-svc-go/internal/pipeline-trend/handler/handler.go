package handler

import (
	"encoding/json"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/pipeline-trend/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
	"go.opentelemetry.io/otel"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all pipeline-trend endpoints under the given group.
// Mirrors the TS source:
//   GET /pipelines/:id/runs/trend
//   GET /pipelines/trend/compare
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/pipelines")

	// GET /pipelines/:id/runs/trend - Get run history trend for a single pipeline
	f.GET("/:id/runs/trend", auth.RequirePermission("pipeline", "read"), h.GetRunHistoryTrend)

	// GET /pipelines/trend/compare - Compare run histories across pipelines
	f.GET("/trend/compare", auth.RequirePermission("pipeline", "read"), h.GetRunHistoryCompare)
}

// getTenantID extracts tenant_id from Gin context, falling back to a zero UUID.
func (h *Handler) getTenantID(c *gin.Context) string {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		return "00000000-0000-0000-0000-000000000000"
	}
	return tenantID
}

// GetRunHistoryTrend handles GET /pipelines/:id/runs/trend.
func (h *Handler) GetRunHistoryTrend(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetRunHistoryTrend")
	defer span.End()
	pipelineID := c.Param("id")
	if pipelineID == "" {
		middleware.RespondBadRequest(c, "pipeline id is required")
		return
	}

	period := c.DefaultQuery("period", "30d")
	granularity := c.DefaultQuery("granularity", "day")

	result, err := h.svc.GetRunHistoryTrend(ctx, pipelineID, period, granularity)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, err.Error())
			return
		}
		if err == service.ErrInvalidPeriod || err == service.ErrInvalidGranularity {
			middleware.RespondBadRequest(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}

	middleware.RespondSuccess(c, result)
}

// GetRunHistoryCompare handles GET /pipelines/trend/compare.
func (h *Handler) GetRunHistoryCompare(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetRunHistoryCompare")
	defer span.End()
	rawIDs := c.Query("pipelineIds")
	if rawIDs == "" {
		middleware.RespondBadRequest(c, "pipelineIds query parameter is required")
		return
	}

	var pipelineIDs []string
	if err := json.Unmarshal([]byte(rawIDs), &pipelineIDs); err != nil {
		middleware.RespondBadRequest(c, "pipelineIds must be a JSON array of strings")
		return
	}

	period := c.DefaultQuery("period", "30d")
	granularity := c.DefaultQuery("granularity", "day")

	result, err := h.svc.GetRunHistoryCompare(ctx, pipelineIDs, period, granularity)
	if err != nil {
		switch {
		case service.IsNotFound(err):
			middleware.RespondNotFound(c, err.Error())
		case err == service.ErrNoPipelineIDs || err == service.ErrTooManyPipelines:
			middleware.RespondBadRequest(c, err.Error())
		case err == service.ErrInvalidPeriod || err == service.ErrInvalidGranularity:
			middleware.RespondBadRequest(c, err.Error())
		default:
			middleware.RespondInternalError(c, err.Error())
		}
		return
	}

	middleware.RespondSuccess(c, result)
}
