package handler

import (
	"net/http"

	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/errors"
	"orion/platform-svc-go/internal/ai-cost/models"
	"orion/platform-svc-go/internal/ai-cost/service"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel/trace"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	r := rg.Group("/ai-cost")
	r.GET("", auth.RequirePermission("ai-cost", "read"), h.ListRecords)
	r.GET("/summary", auth.RequirePermission("ai-cost", "read"), h.GetSummary)
	r.GET("/:id", auth.RequirePermission("ai-cost", "read"), h.GetRecord)
	r.POST("", auth.RequirePermission("ai-cost", "write"), h.RecordCost)
}

func (h *Handler) ListRecords(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListRecords")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx := ctx
	f := models.CostFilter{ModelID: c.Query("modelId")}
	records, err := h.svc.ListCostRecords(ctx, tenantID, f)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"data": records, "total": len(records)})
}

func (h *Handler) GetSummary(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetSummary")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx := ctx
	summary, err := h.svc.GetCostSummary(ctx, tenantID, models.CostFilter{})
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, summary)
}

func (h *Handler) GetRecord(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetRecord")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx := ctx
	record, err := h.svc.GetCostRecord(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrNotFound, "cost record not found", http.StatusNotFound)
		return
	}
	errors.WriteSuccess(c, record)
}

func (h *Handler) RecordCost(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RecordCost")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx := ctx
	var record models.CostRecord
	if err := c.ShouldBindJSON(&record); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, "invalid request", http.StatusBadRequest)
		return
	}
	result, err := h.svc.RecordCost(ctx, tenantID, &record)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, result)
}
