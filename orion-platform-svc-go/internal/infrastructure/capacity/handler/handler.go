package handler

import (
	"context"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/infrastructure/capacity/models"
	"orion/platform-svc-go/internal/infrastructure/capacity/service"
	"orion/platform-svc-go/internal/pagination"
)

// Service defines the methods the handler calls on the service layer. Keeping
// it here rather than in the service package lets the handler be tested with a
// fake and keeps the wiring source-compatible: *service.Service already
// satisfies it.
type Service interface {
	CreatePool(ctx context.Context, tenantID string, req *models.CreatePoolRequest) (*models.ResourcePool, error)
	ListPools(ctx context.Context, tenantID string, offset, limit int) ([]models.ResourcePool, error)
	GetPool(ctx context.Context, tenantID, id string) (*models.ResourcePool, error)
	UpdatePool(ctx context.Context, tenantID, id string, req *models.CreatePoolRequest) (*models.ResourcePool, error)
	ListForecasts(ctx context.Context, tenantID string, offset, limit int) ([]models.CapacityForecast, error)
	CreatePolicy(ctx context.Context, tenantID string, req *models.CreatePolicyRequest) (*models.ScalingPolicy, error)
	ListPolicies(ctx context.Context, tenantID string) ([]models.ScalingPolicy, error)
	Delete(ctx context.Context, tenantID, id string) error
	Count(ctx context.Context, tenantID string) (int, error)
	RecordMetric(ctx context.Context, tenantID string, req *models.RecordMetricRequest) (*models.CapacityMetric, error)
	ListMetrics(ctx context.Context, tenantID string, f *models.MetricFilter) ([]models.CapacityMetric, error)
	GenerateForecast(ctx context.Context, tenantID string) ([]models.CapacityForecast, error)
	ListAlerts(ctx context.Context, tenantID string, f *models.AlertFilter) ([]models.CapacityAlert, error)
	DeleteAlert(ctx context.Context, id string) error
	ListReports(ctx context.Context, tenantID string, offset, limit int) ([]models.CapacityReport, error)
	GenerateReport(ctx context.Context, tenantID, title string) (*models.CapacityReport, error)
	GetReport(ctx context.Context, tenantID, id string) (*models.CapacityReport, error)
	AnalyzeBottlenecks(ctx context.Context, tenantID string) ([]models.Bottleneck, error)
}

// The concrete service satisfies the interface. If the service ever drops a
// method or renames a parameter, this fails the build rather than the wiring.
var _ Service = (*service.Service)(nil)

type Handler struct{ svc Service }

func NewHandler(svc Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	c := rg.Group("/capacity")

	// Pool CRUD
	c.POST("/pools", auth.RequirePermission("capacity", "write"), h.CreatePool)
	c.GET("/pools", auth.RequirePermission("capacity", "read"), h.ListPools)
	c.GET("/pools/:id", auth.RequirePermission("capacity", "read"), h.GetPool)
	c.PUT("/pools/:id", auth.RequirePermission("capacity", "write"), h.UpdatePool)
	c.DELETE("/pools/:id", auth.RequirePermission("capacity", "delete"), h.Delete)
	c.GET("/pools-count", auth.RequirePermission("capacity", "read"), h.Count)

	// Metrics
	c.POST("/metrics", auth.RequirePermission("capacity", "write"), h.RecordMetric)
	c.GET("/metrics", auth.RequirePermission("capacity", "read"), h.ListMetrics)

	// Forecasts
	c.POST("/forecasts/generate", auth.RequirePermission("capacity", "write"), h.GenerateForecast)
	c.GET("/forecasts", auth.RequirePermission("capacity", "read"), h.ListForecasts)

	// Alerts
	c.DELETE("/alerts/:id", auth.RequirePermission("capacity", "delete"), h.DeleteAlert)

	// Reports
	c.POST("/reports/generate", auth.RequirePermission("capacity", "write"), h.GenerateReport)
	c.GET("/reports", auth.RequirePermission("capacity", "read"), h.ListReports)
	c.GET("/reports/:id", auth.RequirePermission("capacity", "read"), h.GetReport)

	// Bottleneck analysis
	c.GET("/bottlenecks", auth.RequirePermission("capacity", "read"), h.AnalyzeBottlenecks)

	// Policies
	c.POST("/policies", auth.RequirePermission("capacity", "write"), h.CreatePolicy)
	c.GET("/policies", auth.RequirePermission("capacity", "read"), h.ListPolicies)
}

func (h *Handler) CreatePool(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraCapacityCreatePool")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreatePoolRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	item, err := h.svc.CreatePool(ctx, tenantID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, item)
}

func (h *Handler) ListPools(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraCapacityListPools")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	page := pagination.Page(c.Query("page"), 1)
	ps := pagination.Limit(c.Query("page_size"), 20)
	// The cap must land before the offset is derived: deriving from the
	// requested size and capping the limit afterwards makes
	// page=3&page_size=1000 return rows 2001-2100 while every reader of the
	// URL expects rows 201-300.
	//
	// These three handlers used to read both params with a bare strconv.Atoi,
	// so page=-5, page=0 and page=abc each reached Postgres as a negative
	// OFFSET - an error instead of a page, turning a GET into a 500. page=abc
	// was the worst of them: one mistyped character, Atoi returning 0 and
	// throwing its error away. Nothing in the handler capped the size either,
	// so page_size=100000 went straight into LIMIT.
	//
	// The module already has a helper shaped exactly like this:
	// models.PaginatedRequest owns the same two floors and the same 100 cap.
	// It is dead code - zero production callers and zero tests - and its
	// Offset derives before Limit caps, so it would have answered
	// page=3&page_size=250 with offset 500 and limit 100. It was not worth
	// routing three call sites through a field on a request struct to reuse it,
	// so the arithmetic stays here. The cap below is that same 100.
	if ps > 100 {
		ps = 100
	}
	offset := pagination.OffsetFromPage(page, ps)
	limit := ps

	items, err := h.svc.ListPools(ctx, tenantID, offset, limit)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	if items == nil {
		items = []models.ResourcePool{}
	}
	respondSuccess(c, items)
}

func (h *Handler) GetPool(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraCapacityGetPool")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	item, err := h.svc.GetPool(ctx, tenantID, c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, item)
}

func (h *Handler) UpdatePool(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraCapacityUpdatePool")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreatePoolRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	item, err := h.svc.UpdatePool(ctx, tenantID, c.Param("id"), &req)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, item)
}

func (h *Handler) ListForecasts(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraCapacityListForecasts")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	page := pagination.Page(c.Query("page"), 1)
	ps := pagination.Limit(c.Query("page_size"), 20)
	// Same floors and cap as ListPools, and the cap before the derivation:
	// the three list endpoints share the pagination package for this reason.
	if ps > 100 {
		ps = 100
	}
	offset := pagination.OffsetFromPage(page, ps)
	limit := ps

	items, err := h.svc.ListForecasts(ctx, tenantID, offset, limit)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	if items == nil {
		items = []models.CapacityForecast{}
	}
	respondSuccess(c, items)
}

func (h *Handler) CreatePolicy(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraCapacityCreatePolicy")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreatePolicyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	item, err := h.svc.CreatePolicy(ctx, tenantID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, item)
}

func (h *Handler) ListPolicies(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraCapacityListPolicies")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.ListPolicies(ctx, tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

func (h *Handler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraCapacityDelete")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if err := h.svc.Delete(ctx, tenantID, c.Param("id")); err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "deleted"})
}

func (h *Handler) Count(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraCapacityCount")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	count, err := h.svc.Count(ctx, tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"count": count})
}

func (h *Handler) RecordMetric(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraCapacityRecordMetric")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.RecordMetricRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	item, err := h.svc.RecordMetric(ctx, tenantID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, item)
}

func (h *Handler) ListMetrics(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraCapacityListMetrics")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var f models.MetricFilter
	c.ShouldBindQuery(&f)
	items, err := h.svc.ListMetrics(ctx, tenantID, &f)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

func (h *Handler) GenerateForecast(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraCapacityGenerateForecast")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.GenerateForecast(ctx, tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, items)
}

func (h *Handler) ListAlerts(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraCapacityListAlerts")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.ListAlerts(ctx, tenantID, nil)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

// DeleteAlert deletes a capacity alert.
func (h *Handler) DeleteAlert(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraCapacityDeleteAlert")
	defer span.End()
	if err := h.svc.DeleteAlert(ctx, c.Param("id")); err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "deleted"})
}

// GenerateReport generates a capacity report.
func (h *Handler) GenerateReport(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraCapacityGenerateReport")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	title := c.Query("title")
	report, err := h.svc.GenerateReport(ctx, tenantID, title)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, report)
}

// ListReports lists capacity reports.
func (h *Handler) ListReports(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraCapacityListReports")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	page := pagination.Page(c.Query("page"), 1)
	ps := pagination.Limit(c.Query("page_size"), 20)
	// Same floors and cap as ListPools, and the cap before the derivation:
	// the three list endpoints share the pagination package for this reason.
	if ps > 100 {
		ps = 100
	}
	offset := pagination.OffsetFromPage(page, ps)
	limit := ps

	items, err := h.svc.ListReports(ctx, tenantID, offset, limit)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	if items == nil {
		items = []models.CapacityReport{}
	}
	respondSuccess(c, items)
}

// GetReport gets a capacity report by ID.
func (h *Handler) GetReport(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraCapacityGetReport")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	item, err := h.svc.GetReport(ctx, tenantID, c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, item)
}

// AnalyzeBottlenecks analyzes capacity bottlenecks.
func (h *Handler) AnalyzeBottlenecks(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraCapacityAnalyzeBottlenecks")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	result, err := h.svc.AnalyzeBottlenecks(ctx, tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, result)
}
