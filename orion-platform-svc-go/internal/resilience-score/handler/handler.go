package handler

import (
	"context"
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/resilience-score/models"
	"orion/platform-svc-go/internal/resilience-score/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
	"go.opentelemetry.io/otel"
)

// ResilienceService defines the service interface used by Handler.
type ResilienceService interface {
	GetGlobalScore(ctx context.Context, tenantID string) (*models.GlobalResilienceScore, error)
	ListServiceScores(ctx context.Context, tenantID string, q models.ListQuery) (*models.PaginatedResponse, error)
	GetServiceScore(ctx context.Context, tenantID, name string) (*models.ServiceResilienceScore, error)
	ListHistory(ctx context.Context, tenantID string, q models.ListQuery) (*models.PaginatedResponse, error)
	ListRecommendations(ctx context.Context, tenantID string, q models.ListQuery, priority, component string) (*models.PaginatedResponse, error)
	Assess(ctx context.Context, tenantID string, req models.AssessResilienceRequest) (any, error)
	GetComponentScores(ctx context.Context, tenantID string) ([]models.ComponentScoreBreakdown, error)
	CreateBenchmark(ctx context.Context, tenantID string, req models.CreateBenchmarkRequest) (*models.ResilienceBenchmark, error)
}

var _ ResilienceService = (*service.Service)(nil)

type Handler struct {
	svc ResilienceService
}

func NewHandler(svc ResilienceService) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	read := auth.RequirePermission("resilience_score", "read")
	write := auth.RequirePermission("resilience_score", "write")
	delete := auth.RequirePermission("resilience_score", "delete")

	// GET /resilience-score - 获取全局韧性评分
	rg.GET("/resilience-score", read, h.GetGlobalScore)

	// GET /resilience-score/services - 获取服务韧性评分列表
	rg.GET("/resilience-score/services", read, h.ListServiceScores)

	// GET /resilience-score/services/:name - 获取特定服务韧性评分
	rg.GET("/resilience-score/services/:name", read, h.GetServiceScore)

	// GET /resilience-score/history - 获取韧性评分历史
	rg.GET("/resilience-score/history", read, h.ListHistory)

	// GET /resilience-score/recommendations - 获取韧性改进建议
	rg.GET("/resilience-score/recommendations", read, h.ListRecommendations)

	// POST /resilience-score/assess - 执行韧性评估
	rg.POST("/resilience-score/assess", write, h.Assess)

	// GET /resilience-score/components - 获取韧性组件评分
	rg.GET("/resilience-score/components", read, h.GetComponentScores)

	// POST /resilience-score/benchmarks - 创建基准对比
	rg.POST("/resilience-score/benchmarks", write, h.CreateBenchmark)

	_ = delete
}

// ----- Global Score -----

func (h *Handler) GetGlobalScore(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetGlobalScore")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	score, err := h.svc.GetGlobalScore(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"score": score})
}

// ----- Service Scores -----

func (h *Handler) ListServiceScores(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListServiceScores")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	size, _ := strconv.Atoi(c.DefaultQuery("size", "20"))
	sort := c.Query("sort")
	order := c.Query("order")
	result, err := h.svc.ListServiceScores(ctx, tenantID, models.ListQuery{
		Page:  page,
		Size:  size,
		Sort:  sort,
		Order: order,
	})
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{
		"data": result.Data,
		"total": result.Total,
		"page":  result.Page,
		"size":  result.Size,
	})
}

func (h *Handler) GetServiceScore(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetServiceScore")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	name := c.Param("name")
	score, err := h.svc.GetServiceScore(ctx, tenantID, name)
	if err != nil {
		middleware.RespondNotFound(c, "Service resilience score "+name+" not found")
		return
	}
	middleware.RespondSuccess(c, gin.H{"score": score})
}

// ----- History -----

func (h *Handler) ListHistory(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListHistory")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	size, _ := strconv.Atoi(c.DefaultQuery("size", "20"))
	sort := c.Query("sort")
	order := c.Query("order")
	result, err := h.svc.ListHistory(ctx, tenantID, models.ListQuery{
		Page:  page,
		Size:  size,
		Sort:  sort,
		Order: order,
	})
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{
		"data": result.Data,
		"total": result.Total,
		"page":  result.Page,
		"size":  result.Size,
	})
}

// ----- Recommendations -----

func (h *Handler) ListRecommendations(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListRecommendations")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	size, _ := strconv.Atoi(c.DefaultQuery("size", "20"))
	priority := c.Query("priority")
	component := c.Query("component")
	result, err := h.svc.ListRecommendations(ctx, tenantID, models.ListQuery{
		Page: page,
		Size: size,
	}, priority, component)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{
		"data": result.Data,
		"total": result.Total,
		"page":  result.Page,
		"size":  result.Size,
	})
}

// ----- Assess -----

func (h *Handler) Assess(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Assess")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.AssessResilienceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if req.Scope == "" {
		req.Scope = "global"
	}
	result, err := h.svc.Assess(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, gin.H{"result": result})
}

// ----- Components -----

func (h *Handler) GetComponentScores(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetComponentScores")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	components, err := h.svc.GetComponentScores(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": components})
}

// ----- Benchmarks -----

func (h *Handler) CreateBenchmark(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateBenchmark")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateBenchmarkRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	benchmark, err := h.svc.CreateBenchmark(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, gin.H{"benchmark": benchmark})
}
