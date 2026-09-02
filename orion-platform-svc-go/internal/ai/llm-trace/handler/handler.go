package handler

import (
	"fmt"
	"strconv"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/ai/llm-trace/models"
	"orion/platform-svc-go/internal/ai/llm-trace/service"
	"orion/platform-svc-go/internal/middleware"
)

type LLMTraceHandler struct {
	svc *service.LLMTraceService
}

func NewLLMTraceHandler(svc *service.LLMTraceService) *LLMTraceHandler {
	return &LLMTraceHandler{svc: svc}
}

func (h *LLMTraceHandler) GetTenantID(c *gin.Context) string {
	return c.GetString("tenantId")
}

// RegisterRoutes registers llm-trace routes.
func (h *LLMTraceHandler) RegisterRoutes(rg *gin.RouterGroup) {
	traces := rg.Group("/llm-trace")

	traces.GET("", auth.RequirePermission("ai", "read"), h.List)
	traces.POST("", auth.RequirePermission("ai", "write"), h.Create)
	traces.GET("/summary", auth.RequirePermission("ai", "read"), h.CostSummary)
	traces.GET("/by-trace/:trace_id", auth.RequirePermission("ai", "read"), h.GetByTraceID)

	rg.DELETE("/llm-trace/old", auth.RequirePermission("ai", "admin"), h.DeleteOld)
}

// List returns paginated traces.
func (h *LLMTraceHandler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AILLMTraceList")
	defer span.End()
	tenantID := h.GetTenantID(c)
	model := c.Query("model")
	provider := c.Query("provider")
	status := c.Query("status")
	startTime := c.Query("start_time")
	endTime := c.Query("end_time")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	resp, err := h.svc.Query(ctx, tenantID, model, provider, status, startTime, endTime, limit, offset)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"total": resp.Total, "data": resp.Data})
}

// Create creates a new trace.
func (h *LLMTraceHandler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AILLMTraceCreate")
	defer span.End()
	tenantID := h.GetTenantID(c)
	var req models.CreateTraceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	trace, err := h.svc.Create(ctx, tenantID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, trace)
}

// CostSummary returns aggregated cost data.
func (h *LLMTraceHandler) CostSummary(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AILLMTraceCostSummary")
	defer span.End()
	tenantID := h.GetTenantID(c)
	period := c.DefaultQuery("period", "month")

	summary, err := h.svc.GetCostSummary(ctx, tenantID, period)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, summary)
}

// GetByTraceID returns traces for a trace ID.
func (h *LLMTraceHandler) GetByTraceID(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AILLMTraceGetByTraceID")
	defer span.End()
	tenantID := h.GetTenantID(c)
	traceID := c.Param("trace_id")

	traces, err := h.svc.GetByTraceID(ctx, tenantID, traceID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, traces)
}

// DeleteOld removes old traces.
func (h *LLMTraceHandler) DeleteOld(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AILLMTraceDeleteOld")
	defer span.End()
	tenantID := h.GetTenantID(c)
	days, _ := strconv.Atoi(c.DefaultQuery("days", "30"))

	if days < 1 {
		days = 30
	}

	count, err := h.svc.DeleteOldTraces(ctx, tenantID, days)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": fmt.Sprintf("deleted %d old traces", count)})
}
