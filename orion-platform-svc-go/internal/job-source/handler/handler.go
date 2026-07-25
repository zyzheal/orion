package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/job-source/models"
	"orion/platform-svc-go/internal/job-source/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
	"go.opentelemetry.io/otel"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes mounts all job source endpoints onto the given router group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	js := rg.Group("/job-sources")
	js.POST("", auth.RequirePermission("job-source", "write"), h.Create)
	js.GET("", auth.RequirePermission("job-source", "read"), h.List)
	js.GET("/:id", auth.RequirePermission("job-source", "read"), h.Get)
	js.PUT("/:id", auth.RequirePermission("job-source", "write"), h.Update)
	js.DELETE("/:id", auth.RequirePermission("job-source", "delete"), h.Delete)
	js.POST("/:id/trigger", auth.RequirePermission("job-source", "write"), h.Trigger)
	js.GET("/:id/events", auth.RequirePermission("job-source", "read"), h.GetEvents)
}

func (h *Handler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "JobSource.Create")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateJobSourceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	m, err := h.svc.CreateSource(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, m)
}

func (h *Handler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "JobSource.Get")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	m, err := h.svc.GetSource(ctx, tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, "not found")
		return
	}
	middleware.RespondSuccess(c, m)
}

func (h *Handler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "JobSource.List")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	off, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	items, err := h.svc.ListSources(ctx, tenantID, limit, off)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, items)
}

func (h *Handler) Update(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "JobSource.Update")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateJobSourceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	m, err := h.svc.UpdateSource(ctx, tenantID, id, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, m)
}

func (h *Handler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "JobSource.Delete")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.DeleteSource(ctx, tenantID, id); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "deleted"})
}

func (h *Handler) Trigger(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "JobSource.Trigger")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.TriggerRequest
	if c.Request.Body == nil {
		req.Payload = make(map[string]interface{})
	} else {
		_ = c.ShouldBindJSON(&req)
	}
	event, err := h.svc.TriggerSource(ctx, tenantID, id, req.Payload)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, event)
}

func (h *Handler) GetEvents(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "JobSource.GetEvents")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	sourceID := c.Param("id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	off, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	events, err := h.svc.GetSourceEvents(ctx, tenantID, sourceID, limit, off)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, events)
}
