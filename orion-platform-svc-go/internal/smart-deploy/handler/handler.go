package handler
import (
	"context"
	"strconv"
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/smart-deploy/models"
	"orion/platform-svc-go/internal/smart-deploy/service"
	"github.com/gin-gonic/gin"
)
type Handler struct {
	svc *service.Service
}
func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	r := rg.Group("/smart-deploy")
	// Deployments
	r.POST("",
		auth.RequirePermission("smart-deploy", "write"),
		h.CreateDeployment)
	r.GET("/:id",
		auth.RequirePermission("smart-deploy", "read"),
		h.GetDeployment)
	r.GET("",
		auth.RequirePermission("smart-deploy", "read"),
		h.ListDeployments)
	r.GET("/latest/:appName/:environment",
		auth.RequirePermission("smart-deploy", "read"),
		h.GetLatestDeployment)
	r.POST("/:id/cancel",
		auth.RequirePermission("smart-deploy", "write"),
		h.CancelDeployment)
	r.DELETE("/:id",
		auth.RequirePermission("smart-deploy", "delete"),
		h.DeleteDeployment)
	// Rollback
	r.POST("/:id/rollback",
		auth.RequirePermission("smart-deploy", "write"),
		h.Rollback)
	r.GET("/:id/rollbacks",
		auth.RequirePermission("smart-deploy", "read"),
		h.GetRollbackHistory)
	// Metrics
	r.GET("/metrics",
		auth.RequirePermission("smart-deploy", "read"),
		h.GetMetrics)
	// Audit
	r.GET("/:id/audit",
		auth.RequirePermission("smart-deploy", "read"),
		h.GetAuditTrail)
}
// CreateDeployment handles POST /smart-deploy
func (h *Handler) CreateDeployment(c *gin.Context) {
	_ = c.GetString("tenant_id")

	tenantID := c.GetString("tenant_id")
	ctx := context.Background()
	var req models.CreateDeploymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	deployment, err := h.svc.Deploy(ctx, tenantID, req)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondCreated(c, deployment)
}
// GetDeployment handles GET /smart-deploy/:id
func (h *Handler) GetDeployment(c *gin.Context) {
	_ = c.GetString("tenant_id")

	tenantID := c.GetString("tenant_id")
	ctx := context.Background()
	deployment, err := h.svc.GetDeployment(ctx, tenantID, c.Param("id"))
	if err != nil {
		respondNotFound(c, "deployment not found")
		return
	}
	respondSuccess(c, deployment)
}
// ListDeployments handles GET /smart-deploy
func (h *Handler) ListDeployments(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := context.Background()
	_ = ctx
	opt := models.ListDeploymentsOptions{}
	if appName := c.Query("appName"); appName != "" {
		opt.AppName = appName
	}
	if version := c.Query("version"); version != "" {
		opt.Version = version
	}
	if environment := c.Query("environment"); environment != "" {
		opt.Environment = environment
	}
	if status := c.Query("status"); status != "" {
		opt.Status = models.DeploymentStatus(status)
	}
	if strategy := c.Query("strategy"); strategy != "" {
		opt.Strategy = models.DeploymentStrategyType(strategy)
	}
	if initiatedBy := c.Query("initiatedBy"); initiatedBy != "" {
		opt.InitiatedBy = initiatedBy
	}
	if pageStr := c.Query("page"); pageStr != "" {
		opt.Page, _ = strconv.Atoi(pageStr)
	}
	if limitStr := c.Query("limit"); limitStr != "" {
		opt.Limit, _ = strconv.Atoi(limitStr)
	}
	if opt.Page <= 0 {
		opt.Page = 1
	}
	if opt.Limit <= 0 || opt.Limit > 100 {
		opt.Limit = 20
	}
	deployments, total, err := h.svc.ListDeployments(ctx, tenantID, opt)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{
		"data": deployments,
		"total": total,
		"page":  opt.Page,
		"limit": opt.Limit,
	})
}
// GetLatestDeployment handles GET /smart-deploy/latest/:appName/:environment
func (h *Handler) GetLatestDeployment(c *gin.Context) {
	_ = c.GetString("tenant_id")

	tenantID := c.GetString("tenant_id")
	ctx := context.Background()
	deployment, err := h.svc.GetLatestDeployment(ctx, tenantID, c.Param("appName"), c.Param("environment"))
	if err != nil {
		respondNotFound(c, "no deployments found for this app and environment")
		return
	}
	respondSuccess(c, deployment)
}
// CancelDeployment handles POST /smart-deploy/:id/cancel
func (h *Handler) CancelDeployment(c *gin.Context) {
	_ = c.GetString("tenant_id")

	tenantID := c.GetString("tenant_id")
	ctx := context.Background()
	var req struct {
		CancelledBy string `json:"cancelledBy" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, "missing required field: cancelledBy")
		return
	}
	deployment, err := h.svc.CancelDeployment(ctx, tenantID, c.Param("id"), req.CancelledBy)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondSuccess(c, deployment)
}
// DeleteDeployment handles DELETE /smart-deploy/:id
func (h *Handler) DeleteDeployment(c *gin.Context) {
	_ = c.GetString("tenant_id")
	// Delete is not exposed on service; return not-implemented.
	respondBadRequest(c, "delete not supported for deployments")
}
// Rollback handles POST /smart-deploy/:id/rollback
func (h *Handler) Rollback(c *gin.Context) {
	_ = c.GetString("tenant_id")

	tenantID := c.GetString("tenant_id")
	ctx := context.Background()
	var req models.CreateRollbackRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, "missing required fields: reason, triggeredBy")
		return
	}
	rollback, err := h.svc.Rollback(ctx, tenantID, c.Param("id"), req)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, rollback)
}
// GetRollbackHistory handles GET /smart-deploy/:id/rollbacks
func (h *Handler) GetRollbackHistory(c *gin.Context) {
	_ = c.GetString("tenant_id")

	tenantID := c.GetString("tenant_id")
	ctx := context.Background()
	rollbacks, err := h.svc.GetRollbackHistory(ctx, tenantID, c.Param("id"))
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{
		"data": rollbacks,
		"total": len(rollbacks),
	})
}
// GetMetrics handles GET /smart-deploy/metrics
func (h *Handler) GetMetrics(c *gin.Context) {
	_ = c.GetString("tenant_id")

	tenantID := c.GetString("tenant_id")
	ctx := context.Background()
	metrics, err := h.svc.GetMetrics(ctx, tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, metrics)
}
// GetAuditTrail handles GET /smart-deploy/:id/audit
func (h *Handler) GetAuditTrail(c *gin.Context) {
	_ = c.GetString("tenant_id")

	tenantID := c.GetString("tenant_id")
	ctx := context.Background()
	entries, err := h.svc.GetAuditTrail(ctx, tenantID, c.Param("id"))
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{
		"data": entries,
		"total": len(entries),
	})
}
