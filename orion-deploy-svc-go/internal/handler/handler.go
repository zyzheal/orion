package handler

import (
	"net/http"
	"orion/deploy-svc-go/internal/models"
	"orion/deploy-svc-go/internal/repository"
	"orion/deploy-svc-go/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"
	"go.uber.org/zap"
)

type Handler struct {
	svc    *service.DeployService
	logger *zap.Logger
}

func New(db *sqlx.DB, logger *zap.Logger) *Handler {
	repo := repository.NewDeploymentRepository(db)
	svc := service.NewDeployService(repo)
	return &Handler{svc: svc, logger: logger}
}

type Response struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

func (h *Handler) success(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, Response{Code: 0, Message: "success", Data: data})
}

func (h *Handler) err(c *gin.Context, code int, message string) {
	c.JSON(code, Response{Code: code, Message: message})
}

func (h *Handler) tenantID(c *gin.Context) string {
	tenantID := c.GetString("tenant_id")
	if header := c.GetHeader("X-Tenant-ID"); header != "" {
		tenantID = header
	}
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

// ListDeployments GET /api/v1/deployments
func (h *Handler) ListDeployments(c *gin.Context) {
	tenantID := h.tenantID(c)
	offset, limit := h.paginated(c)

	deployments, err := h.svc.List(c.Request.Context(), tenantID, offset, limit)
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

// Rollback POST /api/v1/deployments/:id/rollback
func (h *Handler) Rollback(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.tenantID(c)

	deployment, err := h.svc.Rollback(c.Request.Context(), tenantID, id)
	if err != nil {
		h.err(c, http.StatusBadRequest, err.Error())
		return
	}
	h.success(c, deployment)
}
