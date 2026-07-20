package handler

import (
	"context"
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/efficiency/models"

	"orion/platform-svc-go/internal/middleware"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
)

// Service defines the methods the handler calls on the efficiency service.
type Service interface {
	GenerateReport(ctx context.Context, tenantID string, timeWindow models.TimeWindow, windowSize int) (*models.EfficiencyReport, error)
	GetReportHistory(ctx context.Context, tenantID string, limit int) ([]*models.EfficiencyReport, error)
	GetTeamMetrics(ctx context.Context, tenantID, teamID string) (*models.TeamMetrics, error)
	GetProjectMetrics(ctx context.Context, tenantID, projectID string) (*models.ProjectMetrics, error)
	GetAllTeams(ctx context.Context, tenantID string) []models.TeamInfo
	ComparePeriods(ctx context.Context, tenantID string, periodA, periodB models.PeriodSpec) (*models.PeriodComparisonResult, error)
	GetAllDORA(ctx context.Context, tenantID string, deployments []models.DeploymentRecord, pipelines []models.PipelineCompletionRecord, incidents []models.IncidentRecord, timeWindow models.TimeWindow, windowSize int) (*models.AllDORAResult, error)
	GetDORATrend(ctx context.Context, tenantID string, deployments []models.DeploymentRecord, pipelines []models.PipelineCompletionRecord, incidents []models.IncidentRecord, timeWindow models.TimeWindow, windowSize int) (*models.DORATrendResult, error)
	GetDashboardData(ctx context.Context, tenantID string, timeWindow models.TimeWindow, windowSize int) *models.DashboardData
	GetHistoricalSnapshots(ctx context.Context, tenantID string, weeks int) ([]models.HistoricalSnapshotWeek, error)
	GetBottlenecks(ctx context.Context, tenantID string, timeWindow models.TimeWindow, windowSize int) []models.Bottleneck
	GetDeveloperProfiles(ctx context.Context, tenantID string) []models.DeveloperProfile
}

type Handler struct {
	svc Service
}

func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers efficiency endpoints under the given group.
// TS source routes: /api/v1/efficiency/{path}
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	// Reports (GET)
	rg.GET("/reports", auth.RequirePermission("efficiency", "read"), h.GetReports)
	rg.GET("/reports/history", auth.RequirePermission("efficiency", "read"), h.GetReportHistory)

	// Teams list MUST come before teams/:teamId to avoid param collision
	rg.GET("/teams/list", auth.RequirePermission("efficiency", "read"), h.GetAllTeams)
	rg.GET("/teams/:teamId", auth.RequirePermission("efficiency", "read"), h.GetTeamMetrics)

	// Projects
	rg.GET("/projects/:projectId", auth.RequirePermission("efficiency", "read"), h.GetProjectMetrics)

	// Period comparison
	rg.POST("/compare", auth.RequirePermission("efficiency", "read"), h.ComparePeriods)

	// DORA metrics
	rg.GET("/dora", auth.RequirePermission("efficiency", "read"), h.GetAllDORA)
	rg.GET("/dora/trend", auth.RequirePermission("efficiency", "read"), h.GetDORATrend)

	// Dashboard
	rg.GET("/dashboard", auth.RequirePermission("efficiency", "read"), h.GetDashboard)

	// Trends (historical snapshots)
	rg.GET("/trends", auth.RequirePermission("efficiency", "read"), h.GetTrends)

	// Bottlenecks
	rg.GET("/bottlenecks", auth.RequirePermission("efficiency", "read"), h.GetBottlenecks)

	// Developer profiles
	rg.GET("/developer-profiles", auth.RequirePermission("efficiency", "read"), h.GetDeveloperProfiles)
}

// ==================== Reports ====================

func (h *Handler) GetReports(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetReports")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		tenantID = c.Query("tenantId")
	}
	if tenantID == "" {
		middleware.RespondBadRequest(c, "tenantId is required")
		return
	}
	timeWindow := models.TimeWindow(c.Query("timeWindow"))
	if timeWindow == "" {
		timeWindow = models.TimeWindowWeek
	}
	windowSize := parseInt(c.Query("windowSize"), 1)
	if windowSize <= 0 {
		windowSize = 1
	}

	report, err := h.svc.GenerateReport(ctx, tenantID, timeWindow, windowSize)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"report": report})
}

func (h *Handler) GetReportHistory(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetReportHistory")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		tenantID = c.Query("tenantId")
	}
	if tenantID == "" {
		tenantID = "default"
	}
	limit := parseInt(c.Query("limit"), 10)
	if limit <= 0 {
		limit = 10
	}

	history, err := h.svc.GetReportHistory(ctx, tenantID, limit)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"history": history, "total": len(history)})
}

// ==================== Team / Project Metrics ====================

func (h *Handler) GetTeamMetrics(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetTeamMetrics")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		tenantID = c.Query("tenantId")
	}
	if tenantID == "" {
		tenantID = "default"
	}
	teamID := c.Param("teamId")
	if teamID == "" {
		middleware.RespondBadRequest(c, "teamId is required")
		return
	}

	metrics, err := h.svc.GetTeamMetrics(ctx, tenantID, teamID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"metrics": metrics})
}

func (h *Handler) GetProjectMetrics(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetProjectMetrics")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		tenantID = c.Query("tenantId")
	}
	if tenantID == "" {
		tenantID = "default"
	}
	projectId := c.Param("projectId")
	if projectId == "" {
		middleware.RespondBadRequest(c, "projectId is required")
		return
	}

	metrics, err := h.svc.GetProjectMetrics(ctx, tenantID, projectId)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"metrics": metrics})
}

func (h *Handler) GetAllTeams(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetAllTeams")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		tenantID = "default"
	}

	teams := h.svc.GetAllTeams(ctx, tenantID)
	middleware.RespondSuccess(c, gin.H{"teams": teams})
}

// ==================== Period Comparison ====================

func (h *Handler) ComparePeriods(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ComparePeriods")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		tenantID = "default"
	}

	var req models.ComparePeriodsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if req.TenantID != nil && *req.TenantID != "" {
		tenantID = *req.TenantID
	}
	if req.PeriodA == nil || req.PeriodB == nil {
		middleware.RespondBadRequest(c, "periodA and periodB are required")
		return
	}

	comparison, err := h.svc.ComparePeriods(ctx, tenantID, *req.PeriodA, *req.PeriodB)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"comparison": comparison})
}

// ==================== DORA Metrics ====================

func (h *Handler) GetAllDORA(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetAllDORA")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		tenantID = c.Query("tenantId")
	}
	if tenantID == "" {
		tenantID = "default"
	}
	timeWindow := models.TimeWindow(c.Query("timeWindow"))
	if timeWindow == "" {
		timeWindow = models.TimeWindowWeek
	}
	windowSize := parseInt(c.Query("windowSize"), 1)
	if windowSize <= 0 {
		windowSize = 1
	}

	result, err := h.svc.GetAllDORA(ctx, tenantID, nil, nil, nil, timeWindow, windowSize)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"dora": result})
}

func (h *Handler) GetDORATrend(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetDORATrend")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		tenantID = c.Query("tenantId")
	}
	if tenantID == "" {
		tenantID = "default"
	}
	timeWindow := models.TimeWindow(c.Query("timeWindow"))
	if timeWindow == "" {
		timeWindow = models.TimeWindowWeek
	}
	windowSize := parseInt(c.Query("windowSize"), 1)
	if windowSize <= 0 {
		windowSize = 1
	}

	trend, err := h.svc.GetDORATrend(ctx, tenantID, nil, nil, nil, timeWindow, windowSize)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"trend": trend})
}

// ==================== Dashboard ====================

func (h *Handler) GetDashboard(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetDashboard")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		tenantID = c.Query("tenantId")
	}
	if tenantID == "" {
		tenantID = "default"
	}
	timeWindow := models.TimeWindow(c.Query("timeWindow"))
	if timeWindow == "" {
		timeWindow = models.TimeWindowWeek
	}
	windowSize := parseInt(c.Query("windowSize"), 1)
	if windowSize <= 0 {
		windowSize = 1
	}

	dashboard := h.svc.GetDashboardData(ctx, tenantID, timeWindow, windowSize)
	middleware.RespondSuccess(c, gin.H{"dashboard": dashboard})
}

// ==================== Trends ====================

func (h *Handler) GetTrends(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetTrends")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		tenantID = c.Query("tenantId")
	}
	if tenantID == "" {
		tenantID = "default"
	}
	weeks := parseInt(c.Query("weeks"), 12)
	if weeks <= 0 {
		weeks = 12
	}

	snapshots, err := h.svc.GetHistoricalSnapshots(ctx, tenantID, weeks)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"trends": snapshots})
}

// ==================== Bottlenecks ====================

func (h *Handler) GetBottlenecks(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetBottlenecks")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		tenantID = c.Query("tenantId")
	}
	if tenantID == "" {
		tenantID = "default"
	}
	timeWindow := models.TimeWindow(c.Query("timeWindow"))
	if timeWindow == "" {
		timeWindow = models.TimeWindowWeek
	}
	windowSize := parseInt(c.Query("windowSize"), 1)
	if windowSize <= 0 {
		windowSize = 1
	}

	bottlenecks := h.svc.GetBottlenecks(ctx, tenantID, timeWindow, windowSize)
	middleware.RespondSuccess(c, gin.H{"bottlenecks": bottlenecks})
}

// ==================== Developer Profiles ====================

func (h *Handler) GetDeveloperProfiles(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetDeveloperProfiles")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		tenantID = c.Query("tenantId")
	}
	if tenantID == "" {
		tenantID = "default"
	}

	profiles := h.svc.GetDeveloperProfiles(ctx, tenantID)
	middleware.RespondSuccess(c, gin.H{"profiles": profiles})
}

// ==================== Helpers ====================

func parseInt(s string, defaultVal int) int {
	if s == "" {
		return defaultVal
	}
	n, err := strconv.Atoi(s)
	if err != nil {
		return defaultVal
	}
	return n
}
