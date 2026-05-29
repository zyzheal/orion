package handler

import (
	"net/http"
	"orion/build-svc-go/internal/models"
	"orion/build-svc-go/internal/repository"
	"orion/build-svc-go/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"
	"go.uber.org/zap"
)

type Handler struct {
	svc    *service.BuildService
	logger *zap.Logger
}

func New(db *sqlx.DB, logger *zap.Logger) *Handler {
	repo := repository.NewBuildRepository(db)
	svc := service.NewBuildService(repo)
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

// ListBuilds GET /api/v1/builds
func (h *Handler) ListBuilds(c *gin.Context) {
	tenantID := h.tenantID(c)
	offset, limit := h.paginated(c)

	builds, err := h.svc.List(c.Request.Context(), tenantID, offset, limit)
	if err != nil {
		h.logger.Error("failed to list builds", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}
	h.success(c, builds)
}

// CreateBuild POST /api/v1/builds
func (h *Handler) CreateBuild(c *gin.Context) {
	var req models.Build
	if err := c.ShouldBindJSON(&req); err != nil {
		h.err(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}
	req.TenantID = h.tenantID(c)

	if err := h.svc.Create(c.Request.Context(), &req); err != nil {
		h.logger.Error("failed to create build", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}
	h.success(c, req)
}

// GetBuild GET /api/v1/builds/:id
func (h *Handler) GetBuild(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.tenantID(c)

	build, err := h.svc.GetByID(c.Request.Context(), tenantID, id)
	if err != nil {
		h.err(c, http.StatusNotFound, "build not found")
		return
	}
	h.success(c, build)
}

// UpdateBuild PUT /api/v1/builds/:id
func (h *Handler) UpdateBuild(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.tenantID(c)

	var req models.Build
	if err := c.ShouldBindJSON(&req); err != nil {
		h.err(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}
	req.ID = id
	req.TenantID = tenantID

	if err := h.svc.Update(c.Request.Context(), &req); err != nil {
		h.logger.Error("failed to update build", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}
	h.success(c, req)
}

// DeleteBuild DELETE /api/v1/builds/:id
func (h *Handler) DeleteBuild(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.tenantID(c)

	if err := h.svc.Delete(c.Request.Context(), tenantID, id); err != nil {
		h.logger.Error("failed to delete build", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}
	h.success(c, gin.H{"message": "build deleted"})
}

// GetBuildLogs GET /api/v1/builds/:id/logs
func (h *Handler) GetBuildLogs(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.tenantID(c)

	build, err := h.svc.GetByID(c.Request.Context(), tenantID, id)
	if err != nil {
		h.err(c, http.StatusNotFound, "build not found")
		return
	}

	logs := ""
	if build.Logs != nil {
		logs = *build.Logs
	}

	h.success(c, gin.H{"build_id": build.ID, "status": build.Status, "logs": logs})
}

func (h *Handler) Count(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	count, err := h.svc.Count(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"count": count})
}
