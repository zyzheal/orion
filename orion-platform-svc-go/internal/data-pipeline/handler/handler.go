package handler

import (
	"fmt"
	"net/http"

	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/errors"
	"orion/platform-svc-go/internal/data-pipeline/models"
	"orion/platform-svc-go/internal/data-pipeline/service"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	r := rg.Group("/data-pipeline")
	r.GET("", auth.RequirePermission("data-pipeline", "read"), h.List)
	r.GET("/:id", auth.RequirePermission("data-pipeline", "read"), h.Get)
	r.POST("", auth.RequirePermission("data-pipeline", "write"), h.Create)
	r.PUT("/:id", auth.RequirePermission("data-pipeline", "write"), h.Update)
	r.DELETE("/:id", auth.RequirePermission("data-pipeline", "delete"), h.Delete)
	r.POST("/:id/run", auth.RequirePermission("data-pipeline", "write"), h.RunPipeline)
	r.GET("/:id/status", auth.RequirePermission("data-pipeline", "read"), h.GetStatus)
	r.PUT("/:id/pause", auth.RequirePermission("data-pipeline", "write"), h.Pause)
	r.PUT("/:id/resume", auth.RequirePermission("data-pipeline", "write"), h.Resume)
	r.GET("/:id/logs", auth.RequirePermission("data-pipeline", "read"), h.GetLogs)
	r.GET("/schemas", auth.RequirePermission("data-pipeline", "read"), h.ListSchemas)
	r.GET("/lineage/:id", auth.RequirePermission("data-pipeline", "read"), h.GetLineage)
}

func (h *Handler) List(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := c.Request.Context()
	q := models.ListQuery{}
	if p := c.Query("page"); p != "" {
		fmt.Sscanf(p, "%d", &q.Page)
	}
	if l := c.Query("limit"); l != "" {
		fmt.Sscanf(l, "%d", &q.Limit)
	}
	records, err := h.svc.List(ctx, tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"data": records, "total": len(records)})
}

func (h *Handler) Get(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := c.Request.Context()
	record, err := h.svc.Get(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrNotFound, "not found", http.StatusNotFound)
		return
	}
	errors.WriteSuccess(c, record)
}

func (h *Handler) Create(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := c.Request.Context()
	var req models.CreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, "invalid request", http.StatusBadRequest)
		return
	}
	record, err := h.svc.Create(ctx, tenantID, req)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, record)
}

func (h *Handler) Update(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := c.Request.Context()
	var req models.CreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, "invalid request", http.StatusBadRequest)
		return
	}
	record, err := h.svc.Update(ctx, tenantID, c.Param("id"), req)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, record)
}

func (h *Handler) Delete(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := c.Request.Context()
	err := h.svc.Delete(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, nil)
}

func (h *Handler) RunPipeline(c *gin.Context) {
	ctx := c.Request.Context()
	tenantID := c.GetString("tenant_id")
	if err := h.svc.RunPipeline(ctx, tenantID, c.Param("id")); err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"message": "pipeline run triggered"})
}

func (h *Handler) GetStatus(c *gin.Context) {
	ctx := c.Request.Context()
	tenantID := c.GetString("tenant_id")
	status, err := h.svc.GetStatus(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"status": status})
}

func (h *Handler) Pause(c *gin.Context) {
	ctx := c.Request.Context()
	tenantID := c.GetString("tenant_id")
	if err := h.svc.Pause(ctx, tenantID, c.Param("id")); err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"message": "paused"})
}

func (h *Handler) Resume(c *gin.Context) {
	ctx := c.Request.Context()
	tenantID := c.GetString("tenant_id")
	if err := h.svc.Resume(ctx, tenantID, c.Param("id")); err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"message": "resumed"})
}

func (h *Handler) GetLogs(c *gin.Context) {
	ctx := c.Request.Context()
	tenantID := c.GetString("tenant_id")
	logs, err := h.svc.GetLogs(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"logs": logs})
}

func (h *Handler) ListSchemas(c *gin.Context) {
	ctx := c.Request.Context()
	tenantID := c.GetString("tenant_id")
	schemas, err := h.svc.ListSchemas(ctx, tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"schemas": schemas})
}

func (h *Handler) GetLineage(c *gin.Context) {
	ctx := c.Request.Context()
	tenantID := c.GetString("tenant_id")
	lineage, err := h.svc.GetLineage(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"lineage": lineage})
}