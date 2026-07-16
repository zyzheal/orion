package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	goerr "orion/go-common/pkg/errors"

	"orion/platform-svc-go/internal/runbook/models"
	"orion/platform-svc-go/internal/runbook/service"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	r := rg.Group("/runbooks")
	r.GET("", auth.RequirePermission("runbook", "read"), h.List)
	r.GET("/:id", auth.RequirePermission("runbook", "read"), h.Get)
	r.POST("", auth.RequirePermission("runbook", "write"), h.Create)
	r.PUT("/:id", auth.RequirePermission("runbook", "write"), h.Update)
	r.DELETE("/:id", auth.RequirePermission("runbook", "delete"), h.Delete)
	r.POST("/:id/execute", auth.RequirePermission("runbook", "write"), h.Execute)
	r.GET("/:id/executions", auth.RequirePermission("runbook", "read"), h.ListExecutions)
}

func (h *Handler) List(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	q := models.ListQuery{Limit: &limit, Offset: &offset, Category: c.Query("category"), Severity: c.Query("severity")}
	items, total, err := h.svc.List(c.Request.Context(), tenantID, q)
	if err != nil {
		goerr.WriteError(c, goerr.ErrInternal, err.Error(), 500)
		return
	}
	goerr.WriteSuccess(c, gin.H{"data": items, "total": total})
}

func (h *Handler) Get(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	item, err := h.svc.Get(c.Request.Context(), tenantID, id)
	if err != nil {
		goerr.WriteError(c, goerr.ErrNotFound, "not found", 404)
		return
	}
	goerr.WriteSuccess(c, item)
}

func (h *Handler) Create(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateRunbookRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		goerr.WriteError(c, goerr.ErrBadRequest, err.Error(), 400)
		return
	}
	item, err := h.svc.Create(c.Request.Context(), tenantID, req)
	if err != nil {
		goerr.WriteError(c, goerr.ErrInternal, err.Error(), 500)
		return
	}
	goerr.WriteCreated(c, item)
}

func (h *Handler) Update(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateRunbookRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		goerr.WriteError(c, goerr.ErrBadRequest, err.Error(), 400)
		return
	}
	item, err := h.svc.Update(c.Request.Context(), tenantID, id, req)
	if err != nil {
		goerr.WriteError(c, goerr.ErrNotFound, "not found", 404)
		return
	}
	goerr.WriteSuccess(c, item)
}

func (h *Handler) Delete(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.Delete(c.Request.Context(), tenantID, id); err != nil {
		goerr.WriteError(c, goerr.ErrInternal, err.Error(), 500)
		return
	}
	goerr.WriteSuccess(c, gin.H{"message": "deleted"})
}

func (h *Handler) Execute(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	runbookID := c.Param("id")
	var req models.CreateRunbookExecutionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		goerr.WriteError(c, goerr.ErrBadRequest, err.Error(), 400)
		return
	}
	ex, err := h.svc.CreateExecution(c.Request.Context(), tenantID, runbookID, req)
	if err != nil {
		goerr.WriteError(c, goerr.ErrNotFound, err.Error(), 404)
		return
	}
	goerr.WriteCreated(c, ex)
}

func (h *Handler) ListExecutions(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	runbookID := c.Param("id")
	executions, err := h.svc.ListExecutions(c.Request.Context(), tenantID, runbookID)
	if err != nil {
		goerr.WriteError(c, goerr.ErrInternal, err.Error(), 500)
		return
	}
	goerr.WriteSuccess(c, gin.H{"data": executions, "total": len(executions)})
}
