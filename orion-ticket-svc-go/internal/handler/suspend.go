package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"orion-ticket-svc-go/internal/models"
	"orion-ticket-svc-go/internal/service"
)

type SuspendHandler struct {
	svc *service.SuspendService
}

func NewSuspendHandler(svc *service.SuspendService) *SuspendHandler {
	return &SuspendHandler{svc: svc}
}

// CreateSuspend POST /api/v1/tickets/suspend
func (h *SuspendHandler) CreateSuspend(c *gin.Context) {
	var req models.CreateSuspendRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	record, err := h.svc.CreateSuspend(c.Request.Context(), &req)
	if err != nil {
		respondError(c, http.StatusBadRequest, err)
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": record})
}

// ActivateSuspend POST /api/v1/tickets/suspend/:id/activate
func (h *SuspendHandler) ActivateSuspend(c *gin.Context) {
	record, err := h.svc.ActivateSuspend(c.Request.Context(), c.Param("id"))
	if err != nil {
		respondError(c, http.StatusNotFound, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": record})
}

// EndSuspend POST /api/v1/tickets/suspend/:id/end
func (h *SuspendHandler) EndSuspend(c *gin.Context) {
	record, err := h.svc.EndSuspend(c.Request.Context(), c.Param("id"))
	if err != nil {
		respondError(c, http.StatusNotFound, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": record})
}

// CancelSuspend POST /api/v1/tickets/suspend/:id/cancel
func (h *SuspendHandler) CancelSuspend(c *gin.Context) {
	record, err := h.svc.CancelSuspend(c.Request.Context(), c.Param("id"))
	if err != nil {
		respondError(c, http.StatusNotFound, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": record})
}

// ListSuspensions GET /api/v1/tickets/suspend
func (h *SuspendHandler) ListSuspensions(c *gin.Context) {
	status := c.Query("status")
	records, err := h.svc.ListSuspensions(c.Request.Context(), status)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": records, "count": len(records)})
}

// GetSuspend GET /api/v1/tickets/suspend/:id
func (h *SuspendHandler) GetSuspend(c *gin.Context) {
	record, err := h.svc.GetSuspend(c.Request.Context(), c.Param("id"))
	if err != nil {
		respondError(c, http.StatusNotFound, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": record})
}

// GetEngineerSuspensions GET /api/v1/tickets/suspend/engineer/:engineerId
func (h *SuspendHandler) GetEngineerSuspensions(c *gin.Context) {
	records, err := h.svc.GetEngineerSuspensions(c.Request.Context(), c.Param("engineerId"))
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": records, "count": len(records)})
}

// GetEngineerSuspendImpact GET /api/v1/tickets/suspend/engineer/:engineerId/impact
func (h *SuspendHandler) GetEngineerSuspendImpact(c *gin.Context) {
	impact, err := h.svc.GetSuspendImpact(c.Request.Context(), c.Param("engineerId"))
	if err != nil {
		respondError(c, http.StatusNotFound, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": impact})
}
