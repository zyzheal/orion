package handler

import (
	"errors"
	"strconv"

	"orion/platform-svc-go/internal/infrastructure/chaos/models"
	"orion/platform-svc-go/internal/infrastructure/chaos/service"
	"orion/go-common/pkg/auth"

	"github.com/gin-gonic/gin"
)

// Handler provides HTTP handlers for chaos experiment operations.
type Handler struct {
	svc *service.ChaosService
}

func NewHandler(svc *service.ChaosService) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers chaos experiment routes on the given router group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	experiments := rg.Group("/experiments")
	{
		experiments.POST("", auth.RequirePermission("chaos", "write"), h.CreateExperiment)
		experiments.GET("", auth.RequirePermission("chaos", "read"), h.ListExperiments)
		experiments.GET("/:id", auth.RequirePermission("chaos", "read"), h.GetExperiment)
		experiments.POST("/:id/status", auth.RequirePermission("chaos", "execute"), h.UpdateStatus)
		experiments.DELETE("/:id", auth.RequirePermission("chaos", "delete"), h.DeleteExperiment)
	}
}

// mapError maps service-layer errors to appropriate HTTP status codes.
func mapError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, service.ErrExperimentNotFound):
		respondNotFound(c, err.Error())
	case errors.Is(err, service.ErrInvalidStatus):
		respondConflict(c, err.Error())
	default:
		respondInternalError(c, err.Error())
	}
}

func (h *Handler) CreateExperiment(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var input models.CreateExperimentInput
	if err := c.ShouldBindJSON(&input); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	exp, err := h.svc.CreateExperiment(c.Request.Context(), tenantID, &input)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondCreated(c, exp)
}

func (h *Handler) GetExperiment(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	exp, err := h.svc.GetExperiment(c.Request.Context(), tenantID, id)
	if err != nil {
		mapError(c, err)
		return
	}

	respondSuccess(c, exp)
}

func (h *Handler) ListExperiments(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	exps, err := h.svc.ListExperiments(c.Request.Context(), tenantID, page, pageSize)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, exps)
}

func (h *Handler) UpdateStatus(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	var req struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	status := models.ExperimentStatus(req.Status)
	if err := h.svc.UpdateStatus(c.Request.Context(), tenantID, id, status); err != nil {
		mapError(c, err)
		return
	}

	respondSuccess(c, gin.H{"message": "status updated"})
}

func (h *Handler) DeleteExperiment(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	if err := h.svc.DeleteExperiment(c.Request.Context(), tenantID, id); err != nil {
		mapError(c, err)
		return
	}

	respondSuccess(c, gin.H{"message": "deleted"})
}