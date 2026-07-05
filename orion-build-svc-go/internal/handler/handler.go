package handler

import (
	"net/http"
	"orion/build-svc-go/internal/models"
	"orion/build-svc-go/internal/repository"
	"orion/build-svc-go/internal/service"
	"orion/go-common/pkg/database"
	"strconv"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

type Handler struct {
	svc    *service.BuildService
	logger *zap.Logger
}

func New(db *database.DB, logger *zap.Logger) *Handler {
	repo := repository.NewBuildRepository(db)
	svc := service.NewBuildService(repo, logger)
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

// ==================== Build Endpoints ====================

// ListBuilds GET /api/v1/builds
func (h *Handler) ListBuilds(c *gin.Context) {
	tenantID := h.tenantID(c)
	offset, limit := h.paginated(c)

	filter := models.ListBuildsFilter{
		TenantID:  tenantID,
		ProjectID: c.Query("project_id"),
		Status:    c.Query("status"),
	}

	result, err := h.svc.ListPaginated(c.Request.Context(), tenantID, filter, offset, limit)
	if err != nil {
		h.logger.Error("failed to list builds", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}
	h.success(c, result)
}

// CreateBuild POST /api/v1/builds
func (h *Handler) CreateBuild(c *gin.Context) {
	var input models.CreateBuildInput
	if err := c.ShouldBindJSON(&input); err != nil {
		h.err(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}
	input.TenantID = h.tenantID(c)

	build, err := h.svc.CreateFromInput(c.Request.Context(), input)
	if err != nil {
		h.logger.Error("failed to create build", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}
	h.success(c, build)
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

// TriggerBuild POST /api/v1/builds/:id/trigger
func (h *Handler) TriggerBuild(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.tenantID(c)

	build, err := h.svc.TriggerBuild(c.Request.Context(), tenantID, id)
	if err != nil {
		switch err {
		case service.ErrBuildNotFound:
			h.err(c, http.StatusNotFound, err.Error())
		case service.ErrInvalidStatus:
			h.err(c, http.StatusConflict, err.Error())
		default:
			h.logger.Error("failed to trigger build", zap.Error(err))
			h.err(c, http.StatusInternalServerError, "internal error")
		}
		return
	}
	h.success(c, build)
}

// GetBuildStatus GET /api/v1/builds/:id/status
func (h *Handler) GetBuildStatus(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.tenantID(c)

	status, err := h.svc.GetBuildStatus(c.Request.Context(), tenantID, id)
	if err != nil {
		if err == service.ErrBuildNotFound {
			h.err(c, http.StatusNotFound, err.Error())
		} else {
			h.logger.Error("failed to get build status", zap.Error(err))
			h.err(c, http.StatusInternalServerError, "internal error")
		}
		return
	}
	h.success(c, status)
}

// CancelBuild POST /api/v1/builds/:id/cancel
func (h *Handler) CancelBuild(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.tenantID(c)

	build, err := h.svc.CancelBuild(c.Request.Context(), tenantID, id)
	if err != nil {
		switch err {
		case service.ErrBuildNotFound:
			h.err(c, http.StatusNotFound, err.Error())
		case service.ErrInvalidStatus:
			h.err(c, http.StatusConflict, err.Error())
		default:
			h.logger.Error("failed to cancel build", zap.Error(err))
			h.err(c, http.StatusInternalServerError, "internal error")
		}
		return
	}
	h.success(c, build)
}

// RetryBuild POST /api/v1/builds/:id/retry
func (h *Handler) RetryBuild(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.tenantID(c)

	build, err := h.svc.RetryBuild(c.Request.Context(), tenantID, id)
	if err != nil {
		switch err {
		case service.ErrBuildNotFound:
			h.err(c, http.StatusNotFound, err.Error())
		case service.ErrInvalidStatus:
			h.err(c, http.StatusConflict, err.Error())
		default:
			h.logger.Error("failed to retry build", zap.Error(err))
			h.err(c, http.StatusInternalServerError, "internal error")
		}
		return
	}
	h.success(c, build)
}

// GetBuildLogs GET /api/v1/builds/:id/logs
func (h *Handler) GetBuildLogs(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.tenantID(c)

	logs, err := h.svc.GetBuildLogs(c.Request.Context(), tenantID, id)
	if err != nil {
		if err == service.ErrBuildNotFound {
			h.err(c, http.StatusNotFound, err.Error())
		} else {
			h.logger.Error("failed to get build logs", zap.Error(err))
			h.err(c, http.StatusInternalServerError, "internal error")
		}
		return
	}
	h.success(c, logs)
}

// GetBuildByPipelineRun GET /api/v1/builds/pipeline-run/:runId
func (h *Handler) GetBuildByPipelineRun(c *gin.Context) {
	runID := c.Param("runId")
	tenantID := h.tenantID(c)

	build, err := h.svc.GetBuildByPipelineRun(c.Request.Context(), tenantID, runID)
	if err != nil {
		h.logger.Error("failed to get build by pipeline run", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}
	if build == nil {
		h.err(c, http.StatusNotFound, "no build found for pipeline run")
		return
	}
	h.success(c, build)
}

// GetBuildStats GET /api/v1/builds/stats
func (h *Handler) GetBuildStats(c *gin.Context) {
	tenantID := h.tenantID(c)

	stats, err := h.svc.GetBuildStats(c.Request.Context(), tenantID)
	if err != nil {
		h.logger.Error("failed to get build stats", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}
	h.success(c, stats)
}

// Count GET /api/v1/builds/count
func (h *Handler) Count(c *gin.Context) {
	tenantID := h.tenantID(c)
	count, err := h.svc.Count(c.Request.Context(), tenantID)
	if err != nil {
		h.logger.Error("failed to count builds", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}
	h.success(c, gin.H{"count": count})
}

// ==================== Build Environment Endpoints ====================

// ListEnvironments GET /api/v1/environments
func (h *Handler) ListEnvironments(c *gin.Context) {
	tenantID := h.tenantID(c)

	envs, err := h.svc.ListEnvironments(c.Request.Context(), tenantID)
	if err != nil {
		h.logger.Error("failed to list environments", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}
	h.success(c, envs)
}

// CreateEnvironment POST /api/v1/environments
func (h *Handler) CreateEnvironment(c *gin.Context) {
	var input models.CreateEnvironmentInput
	if err := c.ShouldBindJSON(&input); err != nil {
		h.err(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}
	input.TenantID = h.tenantID(c)

	env, err := h.svc.CreateEnvironment(c.Request.Context(), input)
	if err != nil {
		h.logger.Error("failed to create environment", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}
	h.success(c, env)
}

// GetEnvironment GET /api/v1/environments/:id
func (h *Handler) GetEnvironment(c *gin.Context) {
	tenantID := h.tenantID(c)
	id := c.Param("id")

	env, err := h.svc.GetEnvironment(c.Request.Context(), tenantID, id)
	if err != nil {
		h.err(c, http.StatusNotFound, "environment not found")
		return
	}
	h.success(c, env)
}

// UpdateEnvironment PUT /api/v1/environments/:id
func (h *Handler) UpdateEnvironment(c *gin.Context) {
	tenantID := h.tenantID(c)
	id := c.Param("id")

	var input models.CreateEnvironmentInput
	if err := c.ShouldBindJSON(&input); err != nil {
		h.err(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}

	env, err := h.svc.UpdateEnvironment(c.Request.Context(), tenantID, id, input)
	if err != nil {
		if err == service.ErrEnvNotFound {
			h.err(c, http.StatusNotFound, err.Error())
		} else {
			h.logger.Error("failed to update environment", zap.Error(err))
			h.err(c, http.StatusInternalServerError, "internal error")
		}
		return
	}
	h.success(c, env)
}

// DeleteEnvironment DELETE /api/v1/environments/:id
func (h *Handler) DeleteEnvironment(c *gin.Context) {
	tenantID := h.tenantID(c)
	id := c.Param("id")

	if err := h.svc.DeleteEnvironment(c.Request.Context(), tenantID, id); err != nil {
		if err == service.ErrEnvNotFound {
			h.err(c, http.StatusNotFound, err.Error())
		} else {
			h.logger.Error("failed to delete environment", zap.Error(err))
			h.err(c, http.StatusInternalServerError, "internal error")
		}
		return
	}
	h.success(c, gin.H{"message": "environment deleted"})
}

// ==================== Artifact Endpoints ====================

// ListArtifacts GET /api/v1/artifacts
func (h *Handler) ListArtifacts(c *gin.Context) {
	tenantID := h.tenantID(c)
	offset, limit := h.paginated(c)

	filter := models.ListArtifactFilter{
		RunID:   c.Query("run_id"),
		StageID: c.Query("stage_id"),
		Type:    c.Query("type"),
	}

	artifacts, err := h.svc.ListArtifacts(c.Request.Context(), tenantID, filter, offset, limit)
	if err != nil {
		h.logger.Error("failed to list artifacts", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}
	h.success(c, artifacts)
}

// CreateArtifact POST /api/v1/artifacts
func (h *Handler) CreateArtifact(c *gin.Context) {
	var input models.CreateArtifactInput
	if err := c.ShouldBindJSON(&input); err != nil {
		h.err(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}
	input.TenantID = h.tenantID(c)

	artifact, err := h.svc.CreateArtifact(c.Request.Context(), input)
	if err != nil {
		h.logger.Error("failed to create artifact", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}
	h.success(c, artifact)
}

// GetArtifact GET /api/v1/artifacts/:id
func (h *Handler) GetArtifact(c *gin.Context) {
	tenantID := h.tenantID(c)
	id := c.Param("id")

	artifact, err := h.svc.GetArtifact(c.Request.Context(), tenantID, id)
	if err != nil {
		h.err(c, http.StatusNotFound, "artifact not found")
		return
	}
	h.success(c, artifact)
}

// DeleteArtifact DELETE /api/v1/artifacts/:id
func (h *Handler) DeleteArtifact(c *gin.Context) {
	tenantID := h.tenantID(c)
	id := c.Param("id")

	if err := h.svc.DeleteArtifact(c.Request.Context(), tenantID, id); err != nil {
		h.logger.Error("failed to delete artifact", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}
	h.success(c, gin.H{"message": "artifact deleted"})
}

// RecordDownload POST /api/v1/artifacts/:id/download
func (h *Handler) RecordDownload(c *gin.Context) {
	tenantID := h.tenantID(c)
	id := c.Param("id")

	if err := h.svc.RecordArtifactDownload(c.Request.Context(), tenantID, id); err != nil {
		h.logger.Error("failed to record download", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}
	h.success(c, gin.H{"message": "download recorded"})
}

// CleanupExpiredArtifacts POST /api/v1/artifacts/cleanup
func (h *Handler) CleanupExpiredArtifacts(c *gin.Context) {
	tenantID := h.tenantID(c)
	count, err := h.svc.CleanupExpiredArtifacts(c.Request.Context(), tenantID)
	if err != nil {
		h.logger.Error("failed to cleanup expired artifacts", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}
	h.success(c, gin.H{"cleaned": count})
}

// CleanupArtifactsByRun DELETE /api/v1/artifacts/run/:runId
func (h *Handler) CleanupArtifactsByRun(c *gin.Context) {
	tenantID := h.tenantID(c)
	runID := c.Param("runId")

	count, err := h.svc.CleanupArtifactsByRun(c.Request.Context(), tenantID, runID)
	if err != nil {
		h.logger.Error("failed to cleanup artifacts by run", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}
	h.success(c, gin.H{"cleaned": count})
}

// parseLimitOffset is a helper for artifact pagination that uses page/page_size.
func parseLimitOffset(c *gin.Context) (offset, limit int) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}
	return (page - 1) * pageSize, pageSize
}
