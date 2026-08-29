package handler

import (
	"go.opentelemetry.io/otel"
	"orion/go-common/pkg/auth"
	"strconv"

	"orion/platform-svc-go/internal/ticketing/queue/models"
	"orion/platform-svc-go/internal/ticketing/queue/service"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.POST("/queue", auth.RequirePermission("queue", "write"), h.Create)
	rg.GET("/queue", auth.RequirePermission("queue", "read"), h.List)
	rg.GET("/queue/:id", auth.RequirePermission("queue", "read"), h.Get)
	rg.PUT("/queue/:id", auth.RequirePermission("queue", "write"), h.Update)
	rg.DELETE("/queue/:id", auth.RequirePermission("queue", "delete"), h.Delete)
}

func (h *Handler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketingQueueCreate")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateQueueRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	m, err := h.svc.Create(ctx, tenantID, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, m)
}

func (h *Handler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketingQueueGet")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	m, err := h.svc.Get(ctx, tenantID, id)
	if err != nil {
		respondNotFound(c, "not found")
		return
	}
	respondSuccess(c, m)
}

func (h *Handler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketingQueueList")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	items, err := h.svc.List(ctx, tenantID, limit, offset)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

func (h *Handler) Update(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketingQueueUpdate")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateQueueRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	m, err := h.svc.Update(ctx, tenantID, id, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, m)
}

func (h *Handler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketingQueueDelete")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.Delete(ctx, tenantID, id); err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "deleted"})
}
