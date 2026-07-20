package handler

import (
	"context"
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/pipeline-run-history/models"
	"orion/platform-svc-go/internal/pipeline-run-history/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
	"go.opentelemetry.io/otel"
)

// Service defines the contract the handler needs from the service layer.
type Service interface {
	GetRunHistory(ctx context.Context, pipelineID string, tenantID string, period string, limit int) (*models.RunHistoryResponse, error)
}

type Handler struct {
	svc Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers the pipeline run history endpoint.
// Mirrors /api/v1/pipelines/:id/run-history from the TS source (1 endpoint).
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	// GET /pipelines/:id/run-history — Get run history aggregated by time period
	rg.GET("/pipelines/:id/run-history", auth.RequirePermission("pipeline", "read"), h.RunHistory)
}

// getTenantID extracts tenant_id from Gin context, falling back to a zero UUID.
func (h *Handler) getTenantID(c *gin.Context) string {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		return "00000000-0000-0000-0000-000000000000"
	}
	return tenantID
}

// RunHistory handles GET /pipelines/:id/run-history.
func (h *Handler) RunHistory(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RunHistory")
	defer span.End()
	pipelineID := c.Param("id")
	tenantID := h.getTenantID(c)

	period := c.Query("period")
	if period == "" {
		period = "day"
	}

	limitStr := c.Query("limit")
	limit := 30
	if limitStr != "" {
		l, err := strconv.Atoi(limitStr)
		if err != nil || l < 1 || l > 365 {
			middleware.RespondBadRequest(c, "limit must be between 1 and 365")
			return
		}
		limit = l
	}

	resp, err := h.svc.GetRunHistory(ctx, pipelineID, tenantID, period, limit)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "pipeline not found")
			return
		}
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	middleware.RespondSuccess(c, resp)
}
