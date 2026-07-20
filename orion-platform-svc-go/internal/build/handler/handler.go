package handler

import (
	"context"
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/build/models"
	"orion/platform-svc-go/internal/build/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
	"go.opentelemetry.io/otel/trace"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	r := rg.Group("/build")

	// Environments
	r.GET("/environments",
		auth.RequirePermission("build", "read"),
		h.ListEnvironments)
	r.POST("/environments",
		auth.RequirePermission("build", "write"),
		h.CreateEnvironment)
	r.GET("/environments/:id",
		auth.RequirePermission("build", "read"),
		h.GetEnvironment)
	r.PUT("/environments/:id",
		auth.RequirePermission("build", "write"),
		h.UpdateEnvironment)
	r.DELETE("/environments/:id",
		auth.RequirePermission("build", "delete"),
		h.DeleteEnvironment)

	// Builds
	r.GET("",
		auth.RequirePermission("build", "read"),
		h.ListBuilds)
	r.POST("",
		auth.RequirePermission("build", "write"),
		h.CreateBuild)
	r.GET("/:id",
		auth.RequirePermission("build", "read"),
		h.GetBuild)
	r.POST("/:id/start",
		auth.RequirePermission("build", "write"),
		h.StartBuild)
	r.POST("/:id/cancel",
		auth.RequirePermission("build", "write"),
		h.CancelBuild)
	r.POST("/:id/retry",
		auth.RequirePermission("build", "write"),
		h.RetryBuild)
	r.DELETE("/:id",
		auth.RequirePermission("build", "delete"),
		h.DeleteBuild)
	r.GET("/stats",
		auth.RequirePermission("build", "read"),
		h.GetStats)
}

// Environments

func (h *Handler) ListEnvironments(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListEnvironments")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx := middleware.TimeoutContext(c)
	envs, err := h.svc.ListEnvironments(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": envs})
}

func (h *Handler) CreateEnvironment(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateEnvironment")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx := middleware.TimeoutContext(c)

	var req models.CreateEnvironmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	env, err := h.svc.CreateEnvironment(ctx, tenantID, req)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondCreated(c, env)
}

func (h *Handler) GetEnvironment(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetEnvironment")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx := middleware.TimeoutContext(c)
	env, err := h.svc.GetEnvironment(ctx, tenantID, c.Param("id"))
	if err != nil {
		middleware.RespondNotFound(c, "environment not found")
		return
	}
	middleware.RespondSuccess(c, env)
}

func (h *Handler) UpdateEnvironment(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateEnvironment")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx := middleware.TimeoutContext(c)

	var req models.UpdateEnvironmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	env, err := h.svc.UpdateEnvironment(ctx, tenantID, c.Param("id"), req)
	if err != nil {
		middleware.RespondNotFound(c, "environment not found")
		return
	}
	middleware.RespondSuccess(c, env)
}

func (h *Handler) DeleteEnvironment(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteEnvironment")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx := middleware.TimeoutContext(c)
	deleted, err := h.svc.DeleteEnvironment(ctx, tenantID, c.Param("id"))
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if !deleted {
		middleware.RespondNotFound(c, "environment not found")
		return
	}
	middleware.RespondSuccess(c, nil) // c)
}

// Builds

func (h *Handler) ListBuilds(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListBuilds")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx := middleware.TimeoutContext(c)

	opt := models.ListBuildsOptions{}
	if proj := c.Query("projectId"); proj != "" {
		opt.ProjectID = proj
	}
	if status := c.Query("status"); status != "" {
		opt.Status = status
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

	builds, total, err := h.svc.ListBuilds(ctx, tenantID, opt)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{
		"data":  builds,
		"total": total,
	})
}

func (h *Handler) CreateBuild(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateBuild")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx := middleware.TimeoutContext(c)

	var req models.CreateBuildRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	build, err := h.svc.CreateBuild(ctx, tenantID, req)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondCreated(c, build)
}

func (h *Handler) GetBuild(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetBuild")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx := middleware.TimeoutContext(c)
	build, err := h.svc.GetBuild(ctx, tenantID, c.Param("id"))
	if err != nil {
		middleware.RespondNotFound(c, "build not found")
		return
	}
	middleware.RespondSuccess(c, build)
}

func (h *Handler) StartBuild(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "StartBuild")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx := middleware.TimeoutContext(c)
	build, err := h.svc.StartBuild(ctx, tenantID, c.Param("id"))
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, build)
}

func (h *Handler) CancelBuild(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CancelBuild")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx := middleware.TimeoutContext(c)
	build, err := h.svc.CancelBuild(ctx, tenantID, c.Param("id"))
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, build)
}

func (h *Handler) RetryBuild(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RetryBuild")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx := middleware.TimeoutContext(c)
	build, err := h.svc.RetryBuild(ctx, tenantID, c.Param("id"))
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, build)
}

func (h *Handler) DeleteBuild(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteBuild")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx := middleware.TimeoutContext(c)
	deleted, err := h.svc.DeleteBuild(ctx, tenantID, c.Param("id"))
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if !deleted {
		middleware.RespondNotFound(c, "build not found")
		return
	}
	middleware.RespondSuccess(c, nil) // c)
}

func (h *Handler) GetStats(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetStats")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	ctx := middleware.TimeoutContext(c)
	stats, err := h.svc.GetBuildStats(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, stats)
}
