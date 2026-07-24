package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/ticket/models"
	"orion/platform-svc-go/internal/ticket/service"
)

type RelationHandler struct {
	svc *service.AnalyzerService
}

func NewRelationHandler(svc *service.AnalyzerService) *RelationHandler {
	return &RelationHandler{svc: svc}
}

// AddRelation POST /api/v1/tickets/:id/relations
func (h *RelationHandler) AddRelation(c *gin.Context) {
	ticketID := c.Param("id")

	var req models.CreateRelationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	rel, err := h.svc.AddRelation(c.Request.Context(),
		ticketID, req.RelatedTicketID, req.RelationType,
		req.CreatedBy, req.Description, req.Confidence)
	if err != nil {
		respondError(c, http.StatusBadRequest, err)
		return
	}

	respondCreated(c, rel)
}

// GetRelations GET /api/v1/tickets/:id/relations
func (h *RelationHandler) GetRelations(c *gin.Context) {
	relations, err := h.svc.GetRelations(c.Request.Context(), c.Param("id"))
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, gin.H{"relations": relations, "count": len(relations)})
}

// FindRelatedTickets GET /api/v1/tickets/:id/related
func (h *RelationHandler) FindRelatedTickets(c *gin.Context) {
	maxResults, _ := strconv.Atoi(c.Query("maxResults"))
	minConfidence, _ := strconv.ParseFloat(c.Query("minConfidence"), 64)

	related, err := h.svc.FindRelatedTickets(c.Request.Context(), c.Param("id"), maxResults, minConfidence)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, gin.H{"related": related, "count": len(related)})
}

// DetectDuplicates GET /api/v1/tickets/:id/duplicates
func (h *RelationHandler) DetectDuplicates(c *gin.Context) {
	threshold, _ := strconv.ParseFloat(c.Query("threshold"), 64)

	duplicates, err := h.svc.DetectDuplicates(c.Request.Context(), c.Param("id"), threshold)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, gin.H{"duplicates": duplicates, "count": len(duplicates)})
}

// CorrelateRootCause POST /api/v1/tickets/correlate
func (h *RelationHandler) CorrelateRootCause(c *gin.Context) {
	var req struct {
		TicketIDs []string `json:"ticket_ids" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	correlation, err := h.svc.CorrelateRootCause(c.Request.Context(), req.TicketIDs)
	if err != nil {
		respondError(c, http.StatusBadRequest, err)
		return
	}
	respondSuccess(c, correlation)
}
