package handler

import (
	"net/http"
	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/errors"
	"orion/platform-svc-go/internal/middleware"
	"orion/platform-svc-go/internal/queue/models"
	"orion/platform-svc-go/internal/queue/service"

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
	r := rg.Group("/queue")
	r.GET("", auth.RequirePermission("queue", "read"), h.List)
	r.GET("/:id", auth.RequirePermission("queue", "read"), h.Get)
	r.POST("", auth.RequirePermission("queue", "write"), h.Create)
	r.PUT("/:id", auth.RequirePermission("queue", "write"), h.Update)
	r.DELETE("/:id", auth.RequirePermission("queue", "delete"), h.Delete)

	// Job business endpoints
	r.POST("/:queueName/jobs", auth.RequirePermission("queue", "write"), h.EnqueueJob)
	r.POST("/:queueName/dequeue", auth.RequirePermission("queue", "write"), h.DequeueJob)
	r.POST("/jobs/:id/complete", auth.RequirePermission("queue", "write"), h.CompleteJob)
}

func (h *Handler) getTenantID(c *gin.Context) string {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		return "00000000-0000-0000-0000-000000000000"
	}
	return tenantID
}

func (h *Handler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "List")
	defer span.End()
	tenantID := h.getTenantID(c)
	items, err := h.svc.List(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, "internal server error")
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": items, "total": len(items)})
}

func (h *Handler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Get")
	defer span.End()
	tenantID := h.getTenantID(c)
	id := c.Param("id")
	item, err := h.svc.Get(ctx, tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, "not found")
		return
	}
	middleware.RespondSuccess(c, item)
}

func (h *Handler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Create")
	defer span.End()
	tenantID := h.getTenantID(c)
	var req models.CreateQueueRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	item, err := h.svc.Create(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, "internal server error")
		return
	}
	errors.WriteCreated(c, item)
}

func (h *Handler) Update(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Update")
	defer span.End()
	tenantID := h.getTenantID(c)
	id := c.Param("id")
	var req models.UpdateQueueRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	item, err := h.svc.Update(ctx, tenantID, id, req)
	if err != nil {
		middleware.RespondInternalError(c, "internal server error")
		return
	}
	middleware.RespondSuccess(c, item)
}

func (h *Handler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Delete")
	defer span.End()
	tenantID := h.getTenantID(c)
	id := c.Param("id")
	if err := h.svc.Delete(ctx, tenantID, id); err != nil {
		middleware.RespondInternalError(c, "internal server error")
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "deleted"})
}

func (h *Handler) EnqueueJob(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "EnqueueJob")
	defer span.End()
	tenantID := h.getTenantID(c)
	queueName := c.Param("queueName")
	var req models.EnqueueJobRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.EnqueueJob(ctx, tenantID, queueName, &req)
	if err != nil {
		middleware.RespondInternalError(c, "internal server error")
		return
	}
	errors.WriteCreated(c, result)
}

func (h *Handler) DequeueJob(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DequeueJob")
	defer span.End()
	tenantID := h.getTenantID(c)
	queueName := c.Param("queueName")
	var req models.DequeueRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.DequeueJob(ctx, tenantID, queueName, &req)
	if err != nil {
		middleware.RespondInternalError(c, "internal server error")
		return
	}
	if result == nil {
		middleware.RespondNotFound(c, "not found")
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) CompleteJob(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CompleteJob")
	defer span.End()
	tenantID := h.getTenantID(c)
	jobID := c.Param("id")
	var req models.CompleteJobRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.CompleteJob(ctx, tenantID, jobID, &req)
	if err != nil {
		middleware.RespondNotFound(c, "not found")
		return
	}
	middleware.RespondSuccess(c, result)
}

func respondSuccess(c *gin.Context, data any) {
	errors.WriteSuccess(c, data)
}

func respondBadRequest(c *gin.Context, message string) {
	errors.WriteError(c, errors.ErrBadRequest, message, http.StatusBadRequest)
}

func respondInternalError(c *gin.Context) {
	errors.WriteError(c, errors.ErrInternal, "internal server error", http.StatusInternalServerError)
}

func respondNotFound(c *gin.Context) {
	errors.WriteError(c, errors.ErrNotFound, "resource not found", http.StatusNotFound)
}
