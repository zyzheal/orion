package handler

import (
	"go.opentelemetry.io/otel"
	"strconv"

	"orion/platform-svc-go/internal/ci-cd/canary/models"
	"orion/platform-svc-go/internal/ci-cd/canary/service"

	"orion/go-common/pkg/auth"

	"github.com/gin-gonic/gin"
)

// Handler provides HTTP handlers for canary operations.
type Handler struct {
	svc *service.CanaryService
}

func NewHandler(svc *service.CanaryService) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers canary routes on the given router group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	canaries := rg.Group("/canaries")
	{
		canaries.POST("", auth.RequirePermission("canary", "write"), h.CreateCanary)
		canaries.GET("", h.ListCanaries)
		canaries.GET("/:id", h.GetCanary)
		canaries.PUT("/:id", auth.RequirePermission("canary", "write"), h.UpdateCanary)
		canaries.PUT("/:id/traffic", auth.RequirePermission("canary", "write"), h.ConfigureTraffic)
		canaries.GET("/:id/traffic", h.GetTrafficConfig)
		canaries.POST("/:id/promote", auth.RequirePermission("canary", "write"), h.Promote)
		canaries.POST("/:id/rollback", auth.RequirePermission("canary", "execute"), h.Rollback)
		canaries.POST("/:id/metrics", auth.RequirePermission("canary", "write"), h.AddMetric)
		canaries.GET("/:id/metrics", h.GetMetrics)
	}
	canaries.DELETE("/:id", auth.RequirePermission("canary", "delete"), h.Delete)
	canaries.GET("/count", h.Count)

	// ==================== Analysis Runs ====================
	runs := rg.Group("/runs")
	{
		runs.GET("", h.ListAnalysisRuns)
		runs.POST("", auth.RequirePermission("canary", "write"), h.CreateAnalysisRun)
		runs.GET("/:id", h.GetAnalysisRun)
		runs.GET("/:id/metrics", h.GetRunMetrics)
		runs.GET("/:id/ml-results", h.GetRunMLResults)
	}

	// ==================== Configs ====================
	configs := rg.Group("/configs")
	{
		configs.GET("", h.ListConfigs)
		configs.POST("", auth.RequirePermission("canary", "write"), h.CreateConfig)
		configs.GET("/:service/:env", h.GetConfigByServiceEnv)
		configs.PUT("/:id", auth.RequirePermission("canary", "write"), h.UpdateConfig)
		configs.DELETE("/:id", auth.RequirePermission("canary", "delete"), h.DeleteConfig)
	}

	// ==================== Force Actions ====================
	rg.POST("/force-promote", auth.RequirePermission("canary", "execute"), h.ForcePromote)
	rg.POST("/force-rollback", auth.RequirePermission("canary", "execute"), h.ForceRollback)

	// ==================== Metric Discovery ====================
	rg.GET("/metrics/discover", h.DiscoverMetrics)

	// ==================== Model Management ====================
	rg.POST("/models/retrain", auth.RequirePermission("canary", "execute"), h.RetrainModel)
}

// ==================== Canary Deployment Handlers ====================

func (h *Handler) CreateCanary(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CICanaryCreateCanary")
	defer span.End()
	var canary models.Canary
	if err := c.ShouldBindJSON(&canary); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	canary.TenantID = c.GetString("tenant_id")
	if err := h.svc.Create(ctx, &canary); err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondCreated(c, canary)
}

func (h *Handler) GetCanary(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CICanaryGetCanary")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	canary, err := h.svc.GetByID(ctx, tenantID, id)
	if err != nil {
		respondNotFound(c, "canary not found")
		return
	}

	respondSuccess(c, canary)
}

func (h *Handler) ListCanaries(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CICanaryListCanaries")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	canaries, err := h.svc.List(ctx, tenantID, offset, pageSize)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, canaries)
}

func (h *Handler) Promote(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CICanaryPromote")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	if _, err := h.svc.Promote(ctx, tenantID, id); err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, gin.H{"message": "promoted"})
}

func (h *Handler) Rollback(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CICanaryRollback")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	if _, err := h.svc.Rollback(ctx, tenantID, id); err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, gin.H{"message": "rolled back"})
}

func (h *Handler) AddMetric(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CICanaryAddMetric")
	defer span.End()
	var metric models.CanaryMetric
	if err := c.ShouldBindJSON(&metric); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	metric.CanaryID = c.Param("id")
	if err := h.svc.AddMetric(ctx, &metric); err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondCreated(c, metric)
}

func (h *Handler) GetMetrics(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CICanaryGetMetrics")
	defer span.End()
	id := c.Param("id")

	metrics, err := h.svc.GetMetrics(ctx, id)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, metrics)
}

// UpdateCanary updates a canary deployment's version, weight, and target weight.
func (h *Handler) UpdateCanary(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CICanaryUpdateCanary")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	var req models.CreateCanaryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	// Update weight if provided
	if req.Weight > 0 {
		err := h.svc.UpdateWeight(ctx, tenantID, id, req.Weight)
		if err != nil {
			respondInternalError(c, err.Error())
			return
		}
	}

	canary, err := h.svc.GetByID(ctx, tenantID, id)
	if err != nil {
		respondNotFound(c, "canary not found")
		return
	}

	respondSuccess(c, canary)
}

// ConfigureTraffic configures traffic split for a canary (Istio VirtualService or NGINX upstream).
func (h *Handler) ConfigureTraffic(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CICanaryConfigureTraffic")
	defer span.End()
	id := c.Param("id")
	var req struct {
		Strategy      string `json:"strategy" binding:"required"`
		CanaryPercent int    `json:"canary_percent" binding:"min=0,max=100"`
		Host          string `json:"host"`
		Upstream      string `json:"upstream"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	req.Strategy = req.Strategy // "istio" or "nginx"

	result, err := h.svc.ConfigureTraffic(ctx, id, req.Strategy, req.Host, req.Upstream, req.CanaryPercent)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, result)
}

// GetTrafficConfig retrieves the current traffic split configuration for a canary.
func (h *Handler) GetTrafficConfig(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CICanaryGetTrafficConfig")
	defer span.End()
	id := c.Param("id")

	config, err := h.svc.GetTrafficConfig(ctx, id)
	if err != nil {
		respondNotFound(c, "traffic config not found")
		return
	}

	respondSuccess(c, config)
}

func (h *Handler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CICanaryDelete")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if err := h.svc.Delete(ctx, tenantID, c.Param("id")); err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "deleted"})
}

func (h *Handler) Count(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CICanaryCount")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	count, err := h.svc.Count(ctx, tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"count": count})
}

// ==================== Analysis Run Handlers ====================

func (h *Handler) ListAnalysisRuns(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CICanaryListAnalysisRuns")
	defer span.End()
	deploymentID := c.Query("deployment_id")
	status := c.Query("status")

	runs, err := h.svc.ListRuns(ctx, deploymentID, status)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, runs)
}

func (h *Handler) CreateAnalysisRun(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CICanaryCreateAnalysisRun")
	defer span.End()
	var req models.CanaryAnalysisRunCreateInput
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	if req.DeploymentID == "" {
		respondBadRequest(c, "deployment_id is required")
		return
	}

	if req.RunNumber == 0 {
		req.RunNumber = 1
	}
	if req.TrafficSplit.Canary == 0 && req.TrafficSplit.Baseline == 0 {
		req.TrafficSplit = models.TrafficSplit{Canary: 10, Baseline: 90}
	}

	result, err := h.svc.CreateAnalysisRun(ctx, req.DeploymentID, req.RunNumber, req.TrafficSplit)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondCreated(c, gin.H{
		"run":        result.Run,
		"metrics":    result.Metrics,
		"ml_results": result.MLResults,
	})
}

func (h *Handler) GetAnalysisRun(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CICanaryGetAnalysisRun")
	defer span.End()
	id := c.Param("id")

	run, err := h.svc.GetRunByID(ctx, id)
	if err != nil {
		respondNotFound(c, "analysis run not found")
		return
	}

	respondSuccess(c, run)
}

func (h *Handler) GetRunMetrics(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CICanaryGetRunMetrics")
	defer span.End()
	runID := c.Param("id")

	metrics, err := h.svc.GetMetricsForRun(ctx, runID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, metrics)
}

func (h *Handler) GetRunMLResults(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CICanaryGetRunMLResults")
	defer span.End()
	runID := c.Param("id")

	results, err := h.svc.GetMLResults(ctx, runID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, results)
}

// ==================== Config Handlers ====================

func (h *Handler) ListConfigs(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CICanaryListConfigs")
	defer span.End()
	configs, err := h.svc.ListConfigs(ctx)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, configs)
}

func (h *Handler) CreateConfig(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CICanaryCreateConfig")
	defer span.End()
	var input models.CanaryAnalysisConfigCreateInput
	if err := c.ShouldBindJSON(&input); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	if input.ServiceName == "" || input.Environment == "" {
		respondBadRequest(c, "service_name and environment are required")
		return
	}

	config, err := h.svc.CreateConfig(ctx, &input)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondCreated(c, config)
}

func (h *Handler) GetConfigByServiceEnv(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CICanaryGetConfigByServiceEnv")
	defer span.End()
	serviceName := c.Param("service")
	environment := c.Param("env")

	config, err := h.svc.GetConfigByServiceEnv(ctx, serviceName, environment)
	if err != nil {
		respondNotFound(c, "config not found")
		return
	}

	respondSuccess(c, config)
}

func (h *Handler) UpdateConfig(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CICanaryUpdateConfig")
	defer span.End()
	id := c.Param("id")

	var input models.CanaryAnalysisConfigUpdateInput
	if err := c.ShouldBindJSON(&input); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	config, err := h.svc.UpdateConfig(ctx, id, &input)
	if err != nil {
		respondNotFound(c, "config not found")
		return
	}

	respondSuccess(c, config)
}

func (h *Handler) DeleteConfig(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CICanaryDeleteConfig")
	defer span.End()
	id := c.Param("id")

	if err := h.svc.DeleteConfig(ctx, id); err != nil {
		respondNotFound(c, err.Error())
		return
	}

	respondSuccess(c, gin.H{"message": "config deleted"})
}

// ==================== Force Action Handlers ====================

func (h *Handler) ForcePromote(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CICanaryForcePromote")
	defer span.End()
	var req struct {
		RunID  string `json:"run_id" binding:"required"`
		Reason string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	if req.Reason == "" {
		req.Reason = "Manual force promote"
	}

	run, err := h.svc.ForcePromote(ctx, req.RunID, req.Reason)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	respondSuccess(c, run)
}

func (h *Handler) ForceRollback(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CICanaryForceRollback")
	defer span.End()
	var req struct {
		RunID  string `json:"run_id" binding:"required"`
		Reason string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	if req.Reason == "" {
		req.Reason = "Manual force rollback"
	}

	run, err := h.svc.ForceRollback(ctx, req.RunID, req.Reason)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	respondSuccess(c, run)
}

// ==================== Metric Discovery Handler ====================

func (h *Handler) DiscoverMetrics(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CICanaryDiscoverMetrics")
	defer span.End()
	metrics := h.svc.DiscoverMetrics()
	respondSuccess(c, metrics)
}

// ==================== Model Retrain Handler ====================

func (h *Handler) RetrainModel(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CICanaryRetrainModel")
	defer span.End()
	var req struct {
		ModelName string `json:"model_name"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	if req.ModelName == "" {
		req.ModelName = "default"
	}

	job, err := h.svc.TriggerModelRetraining(ctx, req.ModelName)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, gin.H{
		"job_id": job.ID,
		"status": job.Status,
	})
}
