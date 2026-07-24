package handler

import (
	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/errors"
	"orion/platform-svc-go/internal/middleware"
	"orion/platform-svc-go/internal/sandbox/models"
	"orion/platform-svc-go/internal/sandbox/service"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	r := rg.Group("/sandbox")
	r.POST("", auth.RequirePermission("sandbox", "write"), h.CreateJob)
	r.POST("/:id/execute", auth.RequirePermission("sandbox", "write"), h.ExecuteJob)
	r.GET("", auth.RequirePermission("sandbox", "read"), h.ListJobs)
	r.GET("/:id", auth.RequirePermission("sandbox", "read"), h.GetJob)
	r.DELETE("/:id", auth.RequirePermission("sandbox", "delete"), h.DeleteJob)
}

func (h *Handler) getTenantID(c *gin.Context) string {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		middleware.RespondUnauthorized(c, "tenant_id required")
		return ""
	}
	return tenantID
}

func (h *Handler) CreateJob(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateSandboxJob")
	defer span.End()
	tenantID := h.getTenantID(c)
	var req models.CreateSandboxJobRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	job, err := h.svc.CreateJob(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, "internal server error")
		return
	}
	errors.WriteCreated(c, job)
}

func (h *Handler) GetJob(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetSandboxJob")
	defer span.End()
	tenantID := h.getTenantID(c)
	job, err := h.svc.GetJob(ctx, tenantID, c.Param("id"))
	if err != nil {
		middleware.RespondNotFound(c, "not found")
		return
	}
	middleware.RespondSuccess(c, job)
}

func (h *Handler) ListJobs(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListSandboxJobs")
	defer span.End()
	tenantID := h.getTenantID(c)
	status := c.Query("status")
	jobs, err := h.svc.ListJobs(ctx, tenantID, status)
	if err != nil {
		middleware.RespondInternalError(c, "internal server error")
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": jobs, "total": len(jobs)})
}

func (h *Handler) ExecuteJob(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ExecuteSandboxJob")
	defer span.End()
	tenantID := h.getTenantID(c)
	job, err := h.svc.Execute(ctx, tenantID, c.Param("id"))
	if err != nil {
		middleware.RespondInternalError(c, "internal server error")
		return
	}
	middleware.RespondSuccess(c, job)
}

func (h *Handler) DeleteJob(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteSandboxJob")
	defer span.End()
	tenantID := h.getTenantID(c)
	if err := h.svc.DeleteJob(ctx, tenantID, c.Param("id")); err != nil {
		middleware.RespondInternalError(c, "internal server error")
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "deleted"})
}
