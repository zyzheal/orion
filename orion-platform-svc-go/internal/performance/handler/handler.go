package handler

import (
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/performance/models"
	"orion/platform-svc-go/internal/performance/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/performance")
	f.POST("/baselines", auth.RequirePermission("performance", "write"), h.CreateBaseline)
	f.GET("/baselines", auth.RequirePermission("performance", "read"), h.ListBaselines)
	f.GET("/baselines/:id", auth.RequirePermission("performance", "read"), h.GetBaselineByID)
	f.GET("/baselines/:id/evaluations", auth.RequirePermission("performance", "read"), h.GetEvaluationHistory)
	f.POST("/evaluate", auth.RequirePermission("performance", "write"), h.EvaluatePerformance)
	f.GET("/profile/:serviceName", auth.RequirePermission("performance", "read"), h.ProfileService)
	f.GET("/profile/:profileId/bottlenecks", auth.RequirePermission("performance", "read"), h.GetBottlenecks)
	f.GET("/profile/:serviceName/suggestions", auth.RequirePermission("performance", "read"), h.GetSuggestions)
	f.POST("/regression", auth.RequirePermission("performance", "write"), h.DetectRegression)
	f.POST("/test-results", auth.RequirePermission("performance", "write"), h.RecordTestResult)
	f.GET("/test-results/:service", auth.RequirePermission("performance", "read"), h.GetTestResults)
}

func (h *Handler) getTenantID(c *gin.Context) string {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		return "00000000-0000-0000-0000-000000000000"
	}
	return tenantID
}

func (h *Handler) CreateBaseline(c *gin.Context) {
	tenantID := h.getTenantID(c)
	var req models.CreateBaselineRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	baseline, err := h.svc.CreateBaseline(c.Request.Context(), tenantID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, baseline)
}

func (h *Handler) ListBaselines(c *gin.Context) {
	tenantID := h.getTenantID(c)
	baselines, err := h.svc.ListBaselines(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": baselines, "total": len(baselines)})
}

func (h *Handler) GetBaselineByID(c *gin.Context) {
	tenantID := h.getTenantID(c)
	baseline, err := h.svc.GetBaselineByID(c.Request.Context(), c.Param("id"), tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "baseline not found")
		} else {
			middleware.RespondInternalError(c, err.Error())
		}
		return
	}
	middleware.RespondSuccess(c, baseline)
}

func (h *Handler) GetEvaluationHistory(c *gin.Context) {
	tenantID := h.getTenantID(c)
	evalHistory, err := h.svc.GetEvaluationHistory(c.Request.Context(), c.Param("id"), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": evalHistory, "total": len(evalHistory)})
}

func (h *Handler) EvaluatePerformance(c *gin.Context) {
	tenantID := h.getTenantID(c)
	var req models.EvaluateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.EvaluatePerformance(c.Request.Context(), tenantID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) ProfileService(c *gin.Context) {
	tenantID := h.getTenantID(c)
	profile, err := h.svc.ProfileService(c.Request.Context(), tenantID, c.Param("serviceName"))
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, profile)
}

func (h *Handler) GetBottlenecks(c *gin.Context) {
	tenantID := h.getTenantID(c)
	bottlenecks, err := h.svc.GetBottlenecks(c.Request.Context(), tenantID, c.Param("profileId"))
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": bottlenecks, "total": len(bottlenecks)})
}

func (h *Handler) GetSuggestions(c *gin.Context) {
	tenantID := h.getTenantID(c)
	suggestions, err := h.svc.GetSuggestions(c.Request.Context(), tenantID, c.Param("serviceName"))
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": suggestions, "total": len(suggestions)})
}

func (h *Handler) DetectRegression(c *gin.Context) {
	tenantID := h.getTenantID(c)
	var req models.DetectRegressionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.DetectRegression(c.Request.Context(), tenantID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) RecordTestResult(c *gin.Context) {
	tenantID := h.getTenantID(c)
	var req models.TestResultRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	err := h.svc.RecordTestResult(c.Request.Context(), tenantID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, gin.H{"message": "test result recorded"})
}

func (h *Handler) GetTestResults(c *gin.Context) {
	tenantID := h.getTenantID(c)
	results, err := h.svc.GetTestResults(c.Request.Context(), tenantID, c.Param("service"))
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": results, "total": len(results)})
}
