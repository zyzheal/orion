package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"orion-ticket-svc-go/internal/models"
	"orion-ticket-svc-go/internal/service"
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
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	rel, err := h.svc.AddRelation(c.Request.Context(),
		ticketID, req.RelatedTicketID, req.RelationType,
		req.CreatedBy, req.Description, req.Confidence)
	if err != nil {
		respondError(c, http.StatusBadRequest, err)
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": rel})
}

// GetRelations GET /api/v1/tickets/:id/relations
func (h *RelationHandler) GetRelations(c *gin.Context) {
	relations, err := h.svc.GetRelations(c.Request.Context(), c.Param("id"))
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": relations, "count": len(relations)})
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
	c.JSON(http.StatusOK, gin.H{"data": related, "count": len(related)})
}

// DetectDuplicates GET /api/v1/tickets/:id/duplicates
func (h *RelationHandler) DetectDuplicates(c *gin.Context) {
	threshold, _ := strconv.ParseFloat(c.Query("threshold"), 64)

	duplicates, err := h.svc.DetectDuplicates(c.Request.Context(), c.Param("id"), threshold)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": duplicates, "count": len(duplicates)})
}

// CorrelateRootCause POST /api/v1/tickets/correlate
func (h *RelationHandler) CorrelateRootCause(c *gin.Context) {
	var req struct {
		TicketIDs []string `json:"ticket_ids" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	correlation, err := h.svc.CorrelateRootCause(c.Request.Context(), req.TicketIDs)
	if err != nil {
		respondError(c, http.StatusBadRequest, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": correlation})
}
