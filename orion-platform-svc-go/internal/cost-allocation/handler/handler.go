package handler

import (
	"strconv"

	"orion/platform-svc-go/internal/cost-allocation/repository"
	"orion/platform-svc-go/internal/cost-allocation/models"

	"orion/platform-svc-go/internal/cost-allocation/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
	"go.opentelemetry.io/otel/trace"
)

// Handler exposes the cost-allocation module's HTTP endpoints.
type Handler struct {
	svc *service.Service
}

// NewHandler creates a new Handler bound to the cost-allocation service.
func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all cost-allocation endpoints under the given group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/cost-allocation")

	// === Allocation CRUD ===
	f.GET("", h.ListAllocations)
	f.POST("", h.CreateAllocation)
	f.GET("/:id", h.GetAllocation)
	f.PUT("/:id", h.UpdateAllocation)
	f.DELETE("/:id", h.DeleteAllocation)

	// === Rules ===
	f.POST("/:id/rules", h.CreateRule)
	f.GET("/:id/rules", h.ListRules)
	f.DELETE("/:id/rules/:ruleId", h.DeleteRule)

	// === Reports ===
	f.POST("/reports", h.CreateReport)
	f.GET("/reports", h.ListReports)
	f.GET("/reports/:id", h.GetReport)
	f.PUT("/reports/:id/complete", h.CompleteReport)
	f.PUT("/reports/:id/fail", h.FailReport)
	f.DELETE("/reports/:id", h.DeleteReport)
}

// ==================== Allocation CRUD ====================

func (h *Handler) ListAllocations(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListAllocations")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	filter := &models.AllocationFilter{Limit: 20}
	if l := c.Query("limit"); l != "" {
		filter.Limit, _ = strconv.Atoi(l)
	}
	if s := c.Query("status"); s != "" {
		filter.Status = &s
	}
	if t := c.Query("type"); t != "" {
		filter.Type = &t
	}
	result, err := h.svc.ListAllocations(ctx, tenantID, filter)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) CreateAllocation(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateAllocation")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateAllocationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.CreateAllocation(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, result)
}

func (h *Handler) GetAllocation(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetAllocation")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	result, err := h.svc.GetAllocation(ctx, tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, "allocation not found")
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) UpdateAllocation(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateAllocation")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateAllocationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.UpdateAllocation(ctx, tenantID, id, req)
	if err != nil {
		if err == repository.ErrNotFound {
			middleware.RespondNotFound(c, "allocation not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) DeleteAllocation(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteAllocation")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	deleted, err := h.svc.DeleteAllocation(ctx, tenantID, id)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if !deleted {
		middleware.RespondNotFound(c, "allocation not found")
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "allocation deleted"})
}

// ==================== Rules ====================

func (h *Handler) CreateRule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateRule")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	allocationID := c.Param("id")
	var req models.CreateRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	req.AllocationID = allocationID
	result, err := h.svc.CreateRule(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, result)
}

func (h *Handler) ListRules(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListRules")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	allocationID := c.Param("id")
	result, err := h.svc.ListRules(ctx, tenantID, allocationID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) DeleteRule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteRule")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ruleID := c.Param("ruleId")
	deleted, err := h.svc.DeleteRule(ctx, tenantID, ruleID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if !deleted {
		middleware.RespondNotFound(c, "rule not found")
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "rule deleted"})
}

// ==================== Reports ====================

func (h *Handler) CreateReport(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateReport")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateReportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.CreateReport(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, result)
}

func (h *Handler) ListReports(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListReports")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	filter := &models.ReportFilter{Limit: 20}
	if l := c.Query("limit"); l != "" {
		filter.Limit, _ = strconv.Atoi(l)
	}
	if a := c.Query("allocationId"); a != "" {
		filter.AllocationID = &a
	}
	if s := c.Query("status"); s != "" {
		filter.Status = &s
	}
	result, err := h.svc.ListReports(ctx, tenantID, filter)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) GetReport(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetReport")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	result, err := h.svc.GetReport(ctx, tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, "report not found")
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) CompleteReport(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CompleteReport")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var body struct {
		TotalCost     float64 `json:"totalCost"`
		AllocatedCost float64 `json:"allocatedCost"`
		ResultData    string  `json:"resultData"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.CompleteReport(ctx, tenantID, id, body.TotalCost, body.AllocatedCost, body.ResultData)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) FailReport(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "FailReport")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var body struct {
		ErrorMessage string `json:"errorMessage" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.FailReport(ctx, tenantID, id, body.ErrorMessage)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) DeleteReport(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteReport")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	deleted, err := h.svc.DeleteReport(ctx, tenantID, id)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if !deleted {
		middleware.RespondNotFound(c, "report not found")
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "report deleted"})
}
