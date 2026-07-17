package handler

import (
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/pipeline-batch-operations/models"
	"orion/platform-svc-go/internal/pipeline-batch-operations/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
)

// Handler handles pipeline batch operation HTTP requests.
type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all pipeline batch operation endpoints.
// All routes are under /pipelines/batch.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/pipelines/batch")

	// POST /pipelines/batch/start - Batch start pipelines
	f.POST("/start", auth.RequirePermission("pipeline", "execute"), h.BatchStart)
	// POST /pipelines/batch/stop - Batch stop pipeline runs
	f.POST("/stop", auth.RequirePermission("pipeline", "execute"), h.BatchStop)
	// POST /pipelines/batch/delete - Batch delete pipelines
	f.POST("/delete", auth.RequirePermission("pipeline", "delete"), h.BatchDelete)
}

// getTenantID extracts tenant_id from Gin context, falling back to a zero UUID.
func (h *Handler) getTenantID(c *gin.Context) string {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		return "00000000-0000-0000-0000-000000000000"
	}
	return tenantID
}

// BatchStart handles POST /pipelines/batch/start
func (h *Handler) BatchStart(c *gin.Context) {
	var req models.BatchStartRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	resp, err := h.svc.BatchStart(c.Request.Context(), &req, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "pipeline not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, resp)
}

// BatchStop handles POST /pipelines/batch/stop
func (h *Handler) BatchStop(c *gin.Context) {
	var req models.BatchStopRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	resp, err := h.svc.BatchStop(c.Request.Context(), &req, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "pipeline run not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, resp)
}

// BatchDelete handles POST /pipelines/batch/delete
func (h *Handler) BatchDelete(c *gin.Context) {
	var req models.BatchDeleteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	resp, err := h.svc.BatchDelete(c.Request.Context(), &req, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "pipeline not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, resp)
}
