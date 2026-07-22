package handler

import (
	"net/http"
	"orion/ci-cd-svc-go/internal/deploy/models"
	"orion/ci-cd-svc-go/internal/deploy/repository"
	"orion/ci-cd-svc-go/internal/deploy/service"
	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/database"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

type Handler struct {
	svc    *service.DeployService
	logger *zap.Logger
}

func New(db *database.DB, logger *zap.Logger) *Handler {
	repo := repository.NewDeploymentRepository(db)
	svc := service.NewDeployService(repo, logger)
	return &Handler{svc: svc, logger: logger}
}

type Response struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

func (h *Handler) success(c *gin.Context, data interface{}) {
	respondSuccess(c, data)
}

func (h *Handler) err(c *gin.Context, code int, message string) {
	respondInternalError(c, message)
}

func (h *Handler) tenantID(c *gin.Context) string {
	tenantID := auth.GetTenantID(c)
	if tenantID == "" {
		tenantID = "00000000-0000-0000-0000-000000000000"
	}
	return tenantID
}

func (h *Handler) paginated(c *gin.Context) (offset, limit int) {
	var p models.PaginatedRequest
	_ = c.ShouldBindQuery(&p)
	return p.Offset(), p.Limit()
}

// ==================== CRUD Endpoints ====================

// ListDeployments GET /api/v1/deployments
func (h *Handler) ListDeployments(c *gin.Context) {
	tenantID := h.tenantID(c)
	offset, limit := h.paginated(c)

	environment := c.Query("environment")
	status := c.Query("status")

	var deployments []models.Deployment
	var err error
	if environment != "" || status != "" {
		deployments, err = h.svc.ListByFilter(c.Request.Context(), tenantID, environment, status, offset, limit)
	} else {
		deployments, err = h.svc.List(c.Request.Context(), tenantID, offset, limit)
	}
	if err != nil {
		h.logger.Error("failed to list deployments", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}
	h.success(c, deployments)
}

// CreateDeployment POST /api/v1/deployments
func (h *Handler) CreateDeployment(c *gin.Context) {
	var req models.Deployment
	if err := c.ShouldBindJSON(&req); err != nil {
		h.err(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}
	req.TenantID = h.tenantID(c)

	if err := h.svc.Create(c.Request.Context(), &req); err != nil {
		h.logger.Error("failed to create deployment", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}
	h.success(c, req)
}

// GetDeployment GET /api/v1/deployments/:id
func (h *Handler) GetDeployment(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.tenantID(c)

	deployment, err := h.svc.GetByID(c.Request.Context(), tenantID, id)
	if err != nil {
		h.err(c, http.StatusNotFound, "deployment not found")
		return
	}
	h.success(c, deployment)
}

// UpdateDeployment PUT /api/v1/deployments/:id
func (h *Handler) UpdateDeployment(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.tenantID(c)

	var req models.Deployment
	if err := c.ShouldBindJSON(&req); err != nil {
		h.err(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}
	req.ID = id
	req.TenantID = tenantID

	if err := h.svc.Update(c.Request.Context(), &req); err != nil {
		h.logger.Error("failed to update deployment", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}
	h.success(c, req)
}

// DeleteDeployment DELETE /api/v1/deployments/:id
func (h *Handler) DeleteDeployment(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.tenantID(c)

	if err := h.svc.Delete(c.Request.Context(), tenantID, id); err != nil {
		h.logger.Error("failed to delete deployment", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}
	h.success(c, gin.H{"message": "deployment deleted"})
}

// Count GET /api/v1/deployments/count
func (h *Handler) Count(c *gin.Context) {
	tenantID := h.tenantID(c)
	count, err := h.svc.Count(c.Request.Context(), tenantID)
	if err != nil {
		h.logger.Error("failed to count deployments", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}
	h.success(c, gin.H{"count": count})
}

// ==================== Status Transition Endpoints ====================

// StartDeployment POST /api/v1/deployments/:id/start
func (h *Handler) StartDeployment(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.tenantID(c)

	deployment, err := h.svc.StartDeployment(c.Request.Context(), tenantID, id)
	if err != nil {
		h.logger.Error("failed to start deployment", zap.String("id", id), zap.Error(err))
		h.err(c, http.StatusBadRequest, err.Error())
		return
	}
	h.success(c, deployment)
}

// CompleteDeployment POST /api/v1/deployments/:id/complete
func (h *Handler) CompleteDeployment(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.tenantID(c)

	var req struct {
		Status      string  `json:"status" binding:"required"`
		ErrorMessage *string `json:"error_message"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		h.err(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}

	deployment, err := h.svc.CompleteDeployment(c.Request.Context(), tenantID, id, req.Status, req.ErrorMessage)
	if err != nil {
		h.logger.Error("failed to complete deployment", zap.String("id", id), zap.Error(err))
		h.err(c, http.StatusBadRequest, err.Error())
		return
	}
	h.success(c, deployment)
}

// CancelDeployment POST /api/v1/deployments/:id/cancel
func (h *Handler) CancelDeployment(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.tenantID(c)

	deployment, err := h.svc.CancelDeployment(c.Request.Context(), tenantID, id)
	if err != nil {
		h.logger.Error("failed to cancel deployment", zap.String("id", id), zap.Error(err))
		h.err(c, http.StatusBadRequest, err.Error())
		return
	}
	h.success(c, deployment)
}

// Rollback POST /api/v1/deployments/:id/rollback
func (h *Handler) Rollback(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.tenantID(c)

	deployment, err := h.svc.Rollback(c.Request.Context(), tenantID, id)
	if err != nil {
		h.logger.Error("failed to rollback deployment", zap.String("id", id), zap.Error(err))
		h.err(c, http.StatusBadRequest, err.Error())
		return
	}
	h.success(c, deployment)
}

// ==================== Query Endpoints ====================

// GetLatestDeployment GET /api/v1/deployments/latest?environment=xxx
func (h *Handler) GetLatestDeployment(c *gin.Context) {
	tenantID := h.tenantID(c)
	environment := c.Query("environment")
	if environment == "" {
		h.err(c, http.StatusBadRequest, "environment query parameter is required")
		return
	}

	deployment, err := h.svc.GetLatestDeployment(c.Request.Context(), tenantID, environment)
	if err != nil {
		h.err(c, http.StatusNotFound, "no deployment found for environment")
		return
	}
	h.success(c, deployment)
}

// GetDeploymentsByBuild GET /api/v1/deployments/build/:buildId
func (h *Handler) GetDeploymentsByBuild(c *gin.Context) {
	tenantID := h.tenantID(c)
	buildID := c.Param("buildId")

	deployments, err := h.svc.GetDeploymentsByBuild(c.Request.Context(), tenantID, buildID)
	if err != nil {
		h.logger.Error("failed to get deployments by build", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}
	h.success(c, deployments)
}

// GetEnvironments GET /api/v1/deployments/environments
func (h *Handler) GetEnvironments(c *gin.Context) {
	tenantID := h.tenantID(c)

	envs, err := h.svc.GetEnvironments(c.Request.Context(), tenantID)
	if err != nil {
		h.logger.Error("failed to get environments", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}
	h.success(c, envs)
}

// GetDeployStats GET /api/v1/deployments/stats
func (h *Handler) GetDeployStats(c *gin.Context) {
	tenantID := h.tenantID(c)

	stats, err := h.svc.GetDeployStats(c.Request.Context(), tenantID)
	if err != nil {
		h.logger.Error("failed to get deploy stats", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}
	h.success(c, stats)
}

// ==================== Event Endpoints ====================

// GetDeploymentEvents GET /api/v1/deployments/:id/events
func (h *Handler) GetDeploymentEvents(c *gin.Context) {
	id := c.Param("id")

	events, err := h.svc.GetDeploymentEvents(c.Request.Context(), id)
	if err != nil {
		h.logger.Error("failed to get deployment events", zap.String("id", id), zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}
	h.success(c, events)
}


// RegisterRoutes registers all deployment-related routes on the given router group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	deployments := rg.Group("/deployments")
	deployments.GET("", h.ListDeployments)
	deployments.POST("", auth.RequirePermission("deploy", "write"), h.CreateDeployment)
	deployments.GET("/count", h.Count)
	deployments.GET("/stats", h.GetDeployStats)
	deployments.GET("/latest", h.GetLatestDeployment)
	deployments.GET("/environments", h.GetEnvironments)
	deployments.GET("/build/:buildId", h.GetDeploymentsByBuild)
	deployments.GET("/:id", h.GetDeployment)
	deployments.PUT("/:id", auth.RequirePermission("deploy", "write"), h.UpdateDeployment)
	deployments.DELETE("/:id", auth.RequirePermission("deploy", "delete"), h.DeleteDeployment)
	deployments.POST("/:id/start", auth.RequirePermission("deploy", "execute"), h.StartDeployment)
	deployments.POST("/:id/complete", auth.RequirePermission("deploy", "execute"), h.CompleteDeployment)
	deployments.POST("/:id/cancel", auth.RequirePermission("deploy", "execute"), h.CancelDeployment)
	deployments.POST("/:id/rollback", auth.RequirePermission("deploy", "execute"), h.Rollback)
	deployments.GET("/:id/events", h.GetDeploymentEvents)
}
