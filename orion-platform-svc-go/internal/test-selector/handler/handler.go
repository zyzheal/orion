package handler

import (
    "context"
    "net/http"

    "orion/go-common/pkg/auth"
    "orion/go-common/pkg/errors"
    "orion/platform-svc-go/internal/test-selector/models"
    "orion/platform-svc-go/internal/test-selector/service"

    "github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel/trace"
)

// Service defines the contract the handler needs from the service layer.
type Service interface {
    ListFiles(ctx context.Context, tenantID string) ([]string, error)
    GetCoverage(ctx context.Context, tenantID string) (models.CoverageStats, error)
    ListTestSuites(ctx context.Context, tenantID string) ([]models.TestSuite, error)
    GetTestSuite(ctx context.Context, tenantID, id string) (*models.TestSuite, error)
    CreateTestSuite(ctx context.Context, tenantID string, req models.CreateTestSuiteRequest) (*models.TestSuite, error)
    UpdateTestSuite(ctx context.Context, tenantID, id string, req models.UpdateTestSuiteRequest) (*models.TestSuite, error)
    DeleteTestSuite(ctx context.Context, tenantID, id string) error
    GetImpactAnalysis(ctx context.Context, tenantID, file string) (*models.ImpactAnalysisResult, error)
    GetRecommendations(ctx context.Context, tenantID string, req models.RecommendationRequest) (*models.TestExecutionPlan, error)
    GetStats(ctx context.Context, tenantID string) (*models.TestSelectorStats, error)
    RunTestSuite(ctx context.Context, tenantID, id string) error
}

type Handler struct {
    svc Service
}

func NewHandler(svc *service.Service) *Handler {
    return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
    r := rg.Group("/test-selector")
    r.GET("/files", auth.RequirePermission("test-selector", "read"), h.ListFiles)
    r.GET("/coverage", auth.RequirePermission("test-selector", "read"), h.GetCoverage)
    r.GET("/test-suites", auth.RequirePermission("test-selector", "read"), h.ListTestSuites)
    r.GET("/test-suites/:id", auth.RequirePermission("test-selector", "read"), h.GetTestSuite)
    r.POST("/test-suites", auth.RequirePermission("test-selector", "write"), h.CreateTestSuite)
    r.PUT("/test-suites/:id", auth.RequirePermission("test-selector", "write"), h.UpdateTestSuite)
    r.DELETE("/test-suites/:id", auth.RequirePermission("test-selector", "delete"), h.DeleteTestSuite)
    r.GET("/impact", auth.RequirePermission("test-selector", "read"), h.GetImpactAnalysis)
    r.POST("/recommend", auth.RequirePermission("test-selector", "read"), h.GetRecommendations)
    r.GET("/stats", auth.RequirePermission("test-selector", "read"), h.GetStats)
    r.PUT("/test-suites/:id/run", auth.RequirePermission("test-selector", "write"), h.RunTestSuite)
}

func (h *Handler) ListFiles(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListFiles")
	defer span.End()
    tenantID := c.GetString("tenant_id")
    ctx := ctx
    files, err := h.svc.ListFiles(ctx, tenantID)
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"data": files})
}

func (h *Handler) GetCoverage(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetCoverage")
	defer span.End()
    tenantID := c.GetString("tenant_id")
    ctx := ctx
    coverage, err := h.svc.GetCoverage(ctx, tenantID)
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, coverage)
}

func (h *Handler) ListTestSuites(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListTestSuites")
	defer span.End()
    tenantID := c.GetString("tenant_id")
    ctx := ctx
    suites, err := h.svc.ListTestSuites(ctx, tenantID)
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"data": suites, "total": len(suites)})
}

func (h *Handler) GetTestSuite(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetTestSuite")
	defer span.End()
    tenantID := c.GetString("tenant_id")
    ctx := ctx
    suite, err := h.svc.GetTestSuite(ctx, tenantID, c.Param("id"))
    if err != nil {
        errors.WriteError(c, errors.ErrNotFound, "test suite not found", http.StatusNotFound)
        return
    }
    errors.WriteSuccess(c, suite)
}

func (h *Handler) CreateTestSuite(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateTestSuite")
	defer span.End()
    tenantID := c.GetString("tenant_id")
    ctx := ctx
    var req models.CreateTestSuiteRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        errors.WriteError(c, errors.ErrBadRequest, "invalid request", http.StatusBadRequest)
        return
    }
    suite, err := h.svc.CreateTestSuite(ctx, tenantID, req)
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, suite)
}

func (h *Handler) UpdateTestSuite(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateTestSuite")
	defer span.End()
    tenantID := c.GetString("tenant_id")
    ctx := ctx
    var req models.UpdateTestSuiteRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        errors.WriteError(c, errors.ErrBadRequest, "invalid request", http.StatusBadRequest)
        return
    }
    suite, err := h.svc.UpdateTestSuite(ctx, tenantID, c.Param("id"), req)
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, suite)
}

func (h *Handler) DeleteTestSuite(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteTestSuite")
	defer span.End()
    tenantID := c.GetString("tenant_id")
    ctx := ctx
    err := h.svc.DeleteTestSuite(ctx, tenantID, c.Param("id"))
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, nil)
}

func (h *Handler) GetImpactAnalysis(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetImpactAnalysis")
	defer span.End()
    tenantID := c.GetString("tenant_id")
    ctx := ctx
    impact, err := h.svc.GetImpactAnalysis(ctx, tenantID, c.Query("file"))
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"data": impact})
}

func (h *Handler) GetRecommendations(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetRecommendations")
	defer span.End()
    tenantID := c.GetString("tenant_id")
    ctx := ctx
    var req models.RecommendationRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        errors.WriteError(c, errors.ErrBadRequest, "invalid request", http.StatusBadRequest)
        return
    }
    recs, err := h.svc.GetRecommendations(ctx, tenantID, req)
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"data": recs})
}

func (h *Handler) GetStats(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetStats")
	defer span.End()
    tenantID := c.GetString("tenant_id")
    ctx := ctx
    stats, err := h.svc.GetStats(ctx, tenantID)
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"data": stats})
}

func (h *Handler) RunTestSuite(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RunTestSuite")
	defer span.End()
    tenantID := c.GetString("tenant_id")
    ctx := ctx
    err := h.svc.RunTestSuite(ctx, tenantID, c.Param("id"))
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"ok": true, "message": "test suite run triggered"})
}
