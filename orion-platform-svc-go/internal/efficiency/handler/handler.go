package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/efficiency/models"
	"orion/platform-svc-go/internal/efficiency/repository"
	"orion/platform-svc-go/internal/efficiency/service"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all efficiency endpoints under the given group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/efficiency")

	// === Metrics CRUD ===
	f.GET("", auth.RequirePermission("efficiency", "read"), h.ListMetrics)
	// POST metric handled below
	f.POST("/metrics", auth.RequirePermission("efficiency", "write"), h.CreateMetric)
	f.GET("/metrics/:id", auth.RequirePermission("efficiency", "read"), h.GetMetric)
	f.PUT("/metrics/:id", auth.RequirePermission("efficiency", "write"), h.UpdateMetric)
	f.DELETE("/metrics/:id", auth.RequirePermission("efficiency", "delete"), h.DeleteMetric)

	// === Scores ===
	f.POST("/scores", auth.RequirePermission("efficiency", "write"), h.CreateScore)
	// GET scores handled below

	// === Recommendations ===
	f.POST("/recommendations", auth.RequirePermission("efficiency", "write"), h.CreateRecommendation)
	f.GET("/recommendations", auth.RequirePermission("efficiency", "read"), h.ListRecommendations)
	f.GET("/recommendations/:id", auth.RequirePermission("efficiency", "read"), h.GetRecommendation)
	f.PUT("/recommendations/:id", auth.RequirePermission("efficiency", "write"), h.UpdateRecommendation)
	f.DELETE("/recommendations/:id", auth.RequirePermission("efficiency", "delete"), h.DeleteRecommendation)

	// === Stats ===
	f.GET("/stats", auth.RequirePermission("efficiency", "read"), h.Stats)
}

// ==================== Metrics ====================

func (h *Handler) ListMetrics(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	filter := &models.MetricFilter{Limit: 20}
	if l := c.Query("limit"); l != "" {
		filter.Limit, _ = strconv.Atoi(l)
	}
	if o := c.Query("offset"); o != "" {
		filter.Offset, _ = strconv.Atoi(o)
	}
	if mt := c.Query("metricType"); mt != "" {
		filter.MetricType = &mt
	}
	if scope := c.Query("scope"); scope != "" {
		filter.Scope = &scope
	}
	if s := c.Query("status"); s != "" {
		filter.Status = &s
	}
	result, total, err := h.svc.ListMetrics(c.Request.Context(), tenantID, filter)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"data": result, "total": total})
}

func (h *Handler) CreateMetric(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateMetricRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.CreateMetric(c.Request.Context(), tenantID, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, result)
}

func (h *Handler) GetMetric(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	result, err := h.svc.GetMetric(c.Request.Context(), tenantID, id)
	if err != nil {
		respondNotFound(c, "metric not found")
		return
	}
	respondSuccess(c, result)
}

func (h *Handler) UpdateMetric(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateMetricRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.UpdateMetric(c.Request.Context(), tenantID, id, req)
	if err != nil {
		if err == repository.ErrNotFound {
			respondNotFound(c, "metric not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, result)
}

func (h *Handler) DeleteMetric(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	deleted, err := h.svc.DeleteMetric(c.Request.Context(), tenantID, id)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	if !deleted {
		respondNotFound(c, "metric not found")
		return
	}
	respondSuccess(c, gin.H{"message": "metric deleted"})
}

// ==================== Scores ====================

func (h *Handler) CreateScore(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateScoreRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.CreateScore(c.Request.Context(), tenantID, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, result)
}

// ==================== Recommendations ====================

func (h *Handler) CreateRecommendation(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateRecommendationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	// Apply defaults for missing required fields
	if req.ImpactLevel == "" {
		req.ImpactLevel = "medium"
	}
	result, err := h.svc.CreateRecommendation(c.Request.Context(), tenantID, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, result)
}

func (h *Handler) ListRecommendations(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var status *string
	if s := c.Query("status"); s != "" {
		status = &s
	}
	result, err := h.svc.ListRecommendations(c.Request.Context(), tenantID, status)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, result)
}

func (h *Handler) GetRecommendation(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	result, err := h.svc.GetRecommendation(c.Request.Context(), tenantID, id)
	if err != nil {
		respondNotFound(c, "recommendation not found")
		return
	}
	respondSuccess(c, result)
}

func (h *Handler) UpdateRecommendation(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	status := c.Query("status")
	if status == "" {
		respondBadRequest(c, "status query parameter is required")
		return
	}
	result, err := h.svc.UpdateRecommendation(c.Request.Context(), tenantID, id, status)
	if err != nil {
		if err == repository.ErrNotFound {
			respondNotFound(c, "recommendation not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, result)
}

func (h *Handler) DeleteRecommendation(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	deleted, err := h.svc.DeleteRecommendation(c.Request.Context(), tenantID, id)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	if !deleted {
		respondNotFound(c, "recommendation not found")
		return
	}
	respondSuccess(c, gin.H{"message": "recommendation deleted"})
}

// ==================== Stats ====================

func (h *Handler) Stats(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	result, err := h.svc.GetStats(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, result)
}
