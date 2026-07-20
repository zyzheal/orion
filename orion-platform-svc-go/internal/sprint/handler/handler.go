package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/sprint/models"
	"orion/platform-svc-go/internal/sprint/service"

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

// RegisterRoutes registers sprint routes with auth middleware.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	s := rg.Group("/sprints")
	s.POST("", auth.RequirePermission("sprint", "create"), h.Create)
	s.GET("", auth.RequirePermission("sprint", "read"), h.List)
	s.GET("/:id", auth.RequirePermission("sprint", "read"), h.Get)
	s.PUT("/:id", auth.RequirePermission("sprint", "update"), h.Update)
	s.DELETE("/:id", auth.RequirePermission("sprint", "delete"), h.Delete)
	s.GET("/:id/board", auth.RequirePermission("sprint", "read"), h.GetBoard)
	s.POST("/:id/tickets", auth.RequirePermission("sprint", "update"), h.AddTicket)
	s.DELETE("/:id/tickets/:ticketId", auth.RequirePermission("sprint", "update"), h.RemoveTicket)
	s.PUT("/:id/tickets/reorder", auth.RequirePermission("sprint", "update"), h.ReorderTickets)
	s.GET("/:id/burndown", auth.RequirePermission("sprint", "read"), h.GetBurndownData)
}

// Create creates a new sprint.
func (h *Handler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Create")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateSprintRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	m, err := h.svc.Create(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, m)
}

// Get returns a sprint by ID.
func (h *Handler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Get")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	m, err := h.svc.Get(ctx, tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, "not found")
		return
	}
	middleware.RespondSuccess(c, m)
}

// List returns a paginated list of sprints.
func (h *Handler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "List")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	items, err := h.svc.List(ctx, tenantID, limit, offset)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, items)
}

// Update updates an existing sprint.
func (h *Handler) Update(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Update")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateSprintRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	m, err := h.svc.Update(ctx, tenantID, id, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, m)
}

// Delete deletes a sprint by ID.
func (h *Handler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Delete")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.Delete(ctx, tenantID, id); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "deleted"})
}

// GetBoard returns the sprint board view grouped by ticket status.
func (h *Handler) GetBoard(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetBoard")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	board, err := h.svc.GetBoard(ctx, tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, "sprint not found")
		return
	}
	middleware.RespondSuccess(c, board)
}

// AddTicket adds a ticket to a sprint.
func (h *Handler) AddTicket(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AddTicket")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.AddTicketRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.AddTicket(ctx, tenantID, id, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, result)
}

// RemoveTicket removes a ticket from a sprint.
func (h *Handler) RemoveTicket(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RemoveTicket")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	ticketID := c.Param("ticketId")
	if err := h.svc.RemoveTicket(ctx, tenantID, id, ticketID); err != nil {
		middleware.RespondNotFound(c, "ticket not found in sprint")
		return
	}
	middleware.RespondSuccess(c, gin.H{"removed": true})
}

// ReorderTickets reorders tickets within a sprint.
func (h *Handler) ReorderTickets(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ReorderTickets")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.ReorderTicketsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if err := h.svc.ReorderTickets(ctx, tenantID, id, req); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"updated": true})
}

// GetBurndownData returns burndown data for a sprint.
func (h *Handler) GetBurndownData(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetBurndownData")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	data, err := h.svc.GetBurndownData(ctx, tenantID, id)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, data)
}
