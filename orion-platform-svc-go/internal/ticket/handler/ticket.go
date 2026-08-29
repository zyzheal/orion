package handler

import (
	"go.opentelemetry.io/otel"
	"net/http"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/ticket/models"
	"orion/platform-svc-go/internal/ticket/service"
)

type TicketHandler struct {
	svc *service.TicketService
}

func NewTicketHandler(svc *service.TicketService) *TicketHandler {
	return &TicketHandler{svc: svc}
}

// GetUserID extracts user_id from gin context or defaults
func GetUserID(c *gin.Context) string {
	if uid, ok := c.Get("user_id"); ok {
		if s, ok := uid.(string); ok && s != "" {
			return s
		}
	}
	return c.GetHeader("X-User-ID")
}

// ListTickets GET /api/v1/tickets
func (h *TicketHandler) ListTickets(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketListTickets")
	defer span.End()
	tenantID := c.GetString("tenant_id")

	var q models.ListQuery
	if err := c.ShouldBindQuery(&q); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	tickets, total, err := h.svc.List(ctx, tenantID, q)
	if err != nil {
		respondInternalError(c, "failed to list tickets")
		return
	}

	respondSuccess(c, gin.H{"tickets": tickets, "total": total, "page": q.Page})
}

// GetTicket GET /api/v1/tickets/:id
func (h *TicketHandler) GetTicket(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketGetTicket")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	ticket, err := h.svc.GetByID(ctx, id, tenantID)
	if err != nil {
		respondNotFound(c, "ticket not found")
		return
	}

	respondSuccess(c, ticket)
}

// CreateTicket POST /api/v1/tickets
func (h *TicketHandler) CreateTicket(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketCreateTicket")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	createdBy := GetUserID(c)

	var req models.CreateTicketRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	ticket, err := h.svc.Create(ctx, tenantID, &req, createdBy)
	if err != nil {
		respondInternalError(c, "failed to create ticket")
		return
	}

	respondCreated(c, ticket)
}

// UpdateTicket PUT /api/v1/tickets/:id
func (h *TicketHandler) UpdateTicket(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketUpdateTicket")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	existing, err := h.svc.GetByID(ctx, id, tenantID)
	if err != nil {
		respondNotFound(c, "ticket not found")
		return
	}

	var req map[string]any
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	if v, ok := req["title"].(string); ok {
		existing.Title = v
	}
	if v, ok := req["description"].(string); ok {
		existing.Description = v
	}
	if v, ok := req["type"].(string); ok {
		existing.Type = v
	}
	if v, ok := req["priority"].(string); ok {
		existing.Priority = v
	}
	if v, ok := req["status"].(string); ok {
		existing.Status = v
	}
	if v, ok := req["assigned_to"].(string); ok {
		existing.AssignedTo = v
	}

	if err := h.svc.Update(ctx, existing); err != nil {
		respondInternalError(c, "failed to update ticket")
		return
	}

	respondSuccess(c, existing)
}

// DeleteTicket DELETE /api/v1/tickets/:id
func (h *TicketHandler) DeleteTicket(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketDeleteTicket")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	if err := h.svc.Delete(ctx, id, tenantID); err != nil {
		respondInternalError(c, "failed to delete ticket")
		return
	}

	respondSuccess(c, gin.H{"message": "ticket deleted"})
}

// AssignTicket POST /api/v1/tickets/:id/assign
func (h *TicketHandler) AssignTicket(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketAssignTicket")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	var req models.AssignRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	if err := h.svc.Assign(ctx, id, tenantID, req.AssignedTo); err != nil {
		respondInternalError(c, "failed to assign ticket")
		return
	}

	respondSuccess(c, gin.H{"message": "ticket assigned", "assigned_to": req.AssignedTo})
}

// ResolveTicket POST /api/v1/tickets/:id/resolve
func (h *TicketHandler) ResolveTicket(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketResolveTicket")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	performedBy := GetUserID(c)

	if err := h.svc.Resolve(ctx, id, tenantID, performedBy); err != nil {
		respondInternalError(c, "failed to resolve ticket")
		return
	}

	respondSuccess(c, gin.H{"message": "ticket resolved"})
}

// ListComments GET /api/v1/tickets/:id/comments
func (h *TicketHandler) ListComments(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketListComments")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	comments, err := h.svc.ListComments(ctx, id, tenantID)
	if err != nil {
		respondNotFound(c, "ticket not found")
		return
	}

	respondSuccess(c, comments)
}

// CreateComment POST /api/v1/tickets/:id/comments
func (h *TicketHandler) CreateComment(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketCreateComment")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	var req models.CreateCommentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	comment, err := h.svc.AddComment(ctx, id, tenantID, &req)
	if err != nil {
		respondNotFound(c, "ticket not found")
		return
	}

	respondCreated(c, comment)
}

func (h *TicketHandler) Count(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketCount")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	count, err := h.svc.Count(ctx, tenantID)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, gin.H{"count": count})
}
