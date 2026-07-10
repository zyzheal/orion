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
	svc       *service.BuildService
	imageSvc  *service.BuilderImageService
	cacheSvc *service.BuildCacheService
	logger    *zap.Logger
}

func New(db *database.DB, logger *zap.Logger) *Handler {
	repo := repository.NewBuildRepository(db)
	svc := service.NewBuildService(repo, logger)
	imageRepo := repository.NewBuilderImageRepository(db)
	imageSvc := service.NewBuilderImageService(imageRepo)
	cacheConfigRepo := repository.NewBuildCacheConfigRepository(db)
	cacheEntryRepo := repository.NewBuildCacheEntryRepository(db)
	cacheSvc := service.NewBuildCacheService(cacheConfigRepo, cacheEntryRepo)
	return &Handler{svc: svc, imageSvc: imageSvc, cacheSvc: cacheSvc, logger: logger}
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

	/ ==================== Build Endpoints ====================

	/ ListBuilds GET /api/v1/builds
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

	/ CreateBuild POST /api/v1/builds
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

	/ GetBuild GET /api/v1/builds/:id
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

	/ UpdateBuild PUT /api/v1/builds/:id
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

	/ DeleteBuild DELETE /api/v1/builds/:id
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

	/ TriggerBuild POST /api/v1/builds/:id/trigger
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

	/ GetBuildStatus GET /api/v1/builds/:id/status
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

	/ CancelBuild POST /api/v1/builds/:id/cancel
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

	/ RetryBuild POST /api/v1/builds/:id/retry
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

	/ GetBuildLogs GET /api/v1/builds/:id/logs
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

	/ GetBuildByPipelineRun GET /api/v1/builds/pipeline-run/:runId
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

	/ GetBuildStats GET /api/v1/builds/stats
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

	/ Count GET /api/v1/builds/count
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

	/ ==================== Build Environment Endpoints ====================

	/ ListEnvironments GET /api/v1/environments
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

	/ CreateEnvironment POST /api/v1/environments
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

	/ GetEnvironment GET /api/v1/environments/:id
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

	/ UpdateEnvironment PUT /api/v1/environments/:id
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

	/ DeleteEnvironment DELETE /api/v1/environments/:id
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

	/ ==================== Artifact Endpoints ====================

	/ ListArtifacts GET /api/v1/artifacts
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

	/ CreateArtifact POST /api/v1/artifacts
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

	/ GetArtifact GET /api/v1/artifacts/:id
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

	/ DeleteArtifact DELETE /api/v1/artifacts/:id
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

	/ RecordDownload POST /api/v1/artifacts/:id/download
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

	/ CleanupExpiredArtifacts POST /api/v1/artifacts/cleanup
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

	/ CleanupArtifactsByRun DELETE /api/v1/artifacts/run/:runId
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

	/ parseLimitOffset is a helper for artifact pagination that uses page/page_size.
func parseLimitOffset(c *gin.Context) (offset, limit int) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
	&pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}
	return (page - 1) * pageSize, pageSize
}

	/ ==================== Builder Image Endpoints ====================

	/ ListBuilderImages GET /api/v1/build-images
func (h *Handler) ListBuilderImages(c *gin.Context) {
	opts := models.BuilderImageQueryOptions{
		Type:   models.PresetImageType(c.Query("type")),
		Status: models.BuilderImageStatus(c.Query("status")),
	}
	if v := c.Query("is_preset"); v == "true" {
		opts.IsPreset = &[]bool{true}[0]
	} else if v == "false" {
		opts.IsPreset = &[]bool{false}[0]
	}
	offset, limit := h.paginated(c)
	opts.Offset = offset
	opts.Limit = limit

	images, err := h.imageSvc.List(c.Request.Context(), opts)
	if err != nil {
		h.logger.Error("failed to list builder images", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}
	h.success(c, images)
}

	/ RegisterBuilderImage POST /api/v1/build-images
func (h *Handler) RegisterBuilderImage(c *gin.Context) {
	var input models.CreateBuilderImageInput
	if err := c.ShouldBindJSON(&input); err != nil {
		h.err(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}

	img, err := h.imageSvc.Register(c.Request.Context(), input)
	switch err {
	case nil:
		h.success(c, img)
	case service.ErrImageDisabled:
		h.err(c, http.StatusConflict, err.Error())
	default:
		h.logger.Error("failed to register builder image", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
	}
}

	/ GetBuilderImage GET /api/v1/build-images/:id
func (h *Handler) GetBuilderImage(c *gin.Context) {
	id := c.Param("id")
	img, err := h.imageSvc.GetByID(c.Request.Context(), id)
	if err != nil {
		h.err(c, http.StatusNotFound, "builder image not found")
		return
	}
	h.success(c, img)
}

	/ UpdateBuilderImage PUT /api/v1/build-images/:id
func (h *Handler) UpdateBuilderImage(c *gin.Context) {
	id := c.Param("id")
	var input models.UpdateBuilderImageInput
	if err := c.ShouldBindJSON(&input); err != nil {
		h.err(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}

	img, err := h.imageSvc.Update(c.Request.Context(), id, input)
	switch err {
	case nil:
		h.success(c, img)
	case service.ErrImageProtected:
		h.err(c, http.StatusForbidden, err.Error())
	default:
		h.logger.Error("failed to update builder image", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
	}
}

	/ DeleteBuilderImage DELETE /api/v1/build-images/:id
func (h *Handler) DeleteBuilderImage(c *gin.Context) {
	id := c.Param("id")
	err := h.imageSvc.Delete(c.Request.Context(), id)
	switch err {
	case nil:
		h.success(c, gin.H{"message": "builder image deleted"})
	case service.ErrImageProtected:
		h.err(c, http.StatusForbidden, err.Error())
	default:
		h.logger.Error("failed to delete builder image", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
	}
}

	/ DeprecateBuilderImage GET /api/v1/build-images/:id/deprecate
func (h *Handler) DeprecateBuilderImage(c *gin.Context) {
	id := c.Param("id")
	img, err := h.imageSvc.Deprecate(c.Request.Context(), id)
	if err != nil {
		h.logger.Error("failed to deprecate builder image", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}
	h.success(c, img)
}

	/ RestoreBuilderImage GET /api/v1/build-images/:id/restore
func (h *Handler) RestoreBuilderImage(c *gin.Context) {
	id := c.Param("id")
	img, err := h.imageSvc.Restore(c.Request.Context(), id)
	if err != nil {
		h.logger.Error("failed to restore builder image", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}
	h.success(c, img)
}

	/ GetBuilderImagePresets GET /api/v1/build-images/presets
func (h *Handler) GetBuilderImagePresets(c *gin.Context) {
	images, err := h.imageSvc.GetPresets(c.Request.Context())
	if err != nil {
		h.logger.Error("failed to get preset images", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}
	h.success(c, images)
}

	/ GetAvailableBuilderImages GET /api/v1/build-images/available
func (h *Handler) GetAvailableBuilderImages(c *gin.Context) {
	images, err := h.imageSvc.GetAvailable(c.Request.Context())
	if err != nil {
		h.logger.Error("failed to get available images", zap.Error(err))
	/h.err(c, http.StatusInternalServerError, "internal error")
		return
	}
	h.success(c, images)
}

	/ GetBuilderImagesByType GET /api/v1/build-images/by-type/:type
func (h *Handler) GetBuilderImagesByType(c *gin.Context) {
	typ := c.Param("type")
	images, err := h.imageSvc.GetByType(c.Request.Context(), typ)
	if err != nil {
		h.logger.Error("failed to get images by type", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}
	h.success(c, images)
}

	/ ==================== Build Cache Endpoints ====================

	/ ListCacheConfigs GET /api/v1/cache/configs
func (h *Handler) ListCacheConfigs(c *gin.Context) {
	opts := models.ListCacheConfigsOptions{
		Level:  models.CacheLevel(c.Query("level")),
		Status: models.CacheStatus(c.Query("status")),
	}
	offset, limit := h.paginated(c)
	opts.Offset = offset
	opts.Limit = limit

	cfgs, err := h.cacheSvc.ListConfigs(c.Request.Context(), opts)
	if err != nil {
	/h.logger.Error("failed to list cache configs", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}
	h.success(c, cfgs)
}

	/ CreateCacheConfig POST /api/v1/cache/configs
func (h *Handler) CreateCacheConfig(c *gin.Context) {
	var input models.CreateBuildCacheConfigInput
	if err := c.ShouldBindJSON(&input); err != nil {
		h.err(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}

	cfg, err := h.cacheSvc.CreateConfig(c.Request.Context(), input)
	if err != nil {
	/h.logger.Error("failed to create cache config", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}
	h.success(c, cfg)
}

	/ UpdateCacheConfig PUT /api/v1/cache/configs
func (h *Handler) UpdateCacheConfig(c *gin.Context) {
	id := c.Param("id")
	var input models.UpdateBuildCacheConfigInput
	if err := c.ShouldBindJSON(&input); err != nil {
		h.err(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}

	cfg, err := h.cacheSvc.UpdateConfig(c.Request.Context(), id, input)
	if err != nil {
		if err == service.ErrCacheConfigNotFound {
			h.err(c, http.StatusNotFound, err.Error())
			return
		}
		h.logger.Error("failed to update cache config", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}
	h.success(c, cfg)
}

	/ DeleteCacheConfig DELETE /api/v1/cache/configs
func (h *Handler) DeleteCacheConfig(c *gin.Context) {
	id := c.Param("id")
	if err := h.cacheSvc.DeleteConfig(c.Request.Context(), id); err != nil {
		h.logger.Error("failed to delete cache config", zap.Error(err))
	/h.err(c, http.StatusInternalServerError, "internal error")
		return
	}
	h.success(c, gin.H{"message": "cache config deleted"})
}

	/ ListCacheEntries GET /api/v1/cache/entries
func (h *Handler) ListCacheEntries(c *gin.Context) {
	opts := models.ListCacheEntriesOptions{
		ConfigID: c.Query("config_id"),
	}
	offset, limit := h.paginated(c)
	opts.Offset = offset
	opts.Limit = limit

	entries, err := h.cacheSvc.ListCacheEntries(c.Request.Context(), opts)
	if err != nil {
		h.logger.Error("failed to list cache entries", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}
	h.success(c, entries)
}

	/ DeleteCacheEntry DELETE /api/v1/cache/entries
func (h *Handler) DeleteCacheEntry(c *gin.Context) {
	id := c.Param("id")
	if err := h.cacheSvc.DeleteCacheEntry(c.Request.Context(), id); err != nil {
		h.logger.Error("failed to delete cache entry", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}
	h.success(c, gin.H{"message": "cache entry deleted"})
}

	/ CleanupCache POST /api/v1/cache/cleanup
func (h *Handler) CleanupCache(c *gin.Context) {
	count, err := h.cacheSvc.CleanupExpired(c.Request.Context())
	if err != nil {
		h.logger.Error("failed to cleanup expired cache", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}
	h.success(c, gin.H{"cleaned": count})
}

	/ CleanupCacheLRU POST /api/v1/cache/cleanup-lru
func (h *Handler) CleanupCacheLRU(c *gin.Context) {
	var input struct {
		ConfigID  string `json:"config_id" binding:"required"`
		MaxEntries int    `json:"max_entries" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		h.err(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}

	count, err := h.cacheSvc.CleanupLRU(c.Request.Context(), input.ConfigID, input.MaxEntries)
	if err != nil {
	/h.logger.Error("failed to cleanup cache LRU", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}
	h.success(c, gin.H{"cleaned": count})
}
