package handler

import (
	"context"
	"errors"
	"go.opentelemetry.io/otel"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/infrastructure/chaos/models"
	"orion/platform-svc-go/internal/infrastructure/chaos/service"
	"orion/platform-svc-go/internal/pagination"

	"github.com/gin-gonic/gin"
)

// Service defines the methods the handler calls on the service layer. Keeping
// it here rather than in the service package lets the handler be tested with a
// fake and keeps the wiring source-compatible: *service.ChaosService already
// satisfies it.
type Service interface {
	CreateExperiment(ctx context.Context, tenantID string, input *models.CreateExperimentInput) (*models.ChaosExperiment, error)
	GetExperiment(ctx context.Context, tenantID, id string) (*models.ChaosExperiment, error)
	ListExperiments(ctx context.Context, tenantID string, offset, limit int) ([]models.ChaosExperiment, error)
	UpdateStatus(ctx context.Context, tenantID, id string, status models.ExperimentStatus) error
	DeleteExperiment(ctx context.Context, tenantID, id string) error
}

// The concrete service satisfies the interface. If the service ever drops a
// method or renames a parameter, this fails the build rather than the wiring.
var _ Service = (*service.ChaosService)(nil)

// Handler provides HTTP handlers for chaos experiment operations.
type Handler struct {
	svc Service
}

func NewHandler(svc Service) *Handler {
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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraChaosCreateExperiment")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var input models.CreateExperimentInput
	if err := c.ShouldBindJSON(&input); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	exp, err := h.svc.CreateExperiment(ctx, tenantID, &input)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondCreated(c, exp)
}

func (h *Handler) GetExperiment(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraChaosGetExperiment")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	exp, err := h.svc.GetExperiment(ctx, tenantID, id)
	if err != nil {
		mapError(c, err)
		return
	}

	respondSuccess(c, exp)
}

func (h *Handler) ListExperiments(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraChaosListExperiments")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	page := pagination.Page(c.Query("page"), 1)
	ps := pagination.Limit(c.Query("page_size"), 20)
	// The cap lives here, and it must be applied before the offset is derived.
	// Deriving from the requested size and capping the limit afterwards made
	// `page=3&page_size=1000` return rows 2001-2100 while every reader of the
	// URL expected rows 201-300. The same misplaced arithmetic used to compute
	// the offset before the page and page_size floors, so `?page=0`,
	// `?page=-5` and `?page=abc` each reached Postgres as a negative OFFSET —
	// an error instead of a page, turning a GET into a 500.
	if ps > 100 {
		ps = 100
	}
	offset := pagination.OffsetFromPage(page, ps)
	limit := ps

	exps, err := h.svc.ListExperiments(ctx, tenantID, offset, limit)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	if exps == nil {
		exps = []models.ChaosExperiment{}
	}

	respondSuccess(c, exps)
}

func (h *Handler) UpdateStatus(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraChaosUpdateStatus")
	defer span.End()
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
	if err := h.svc.UpdateStatus(ctx, tenantID, id, status); err != nil {
		mapError(c, err)
		return
	}

	respondSuccess(c, gin.H{"message": "status updated"})
}

func (h *Handler) DeleteExperiment(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InfraChaosDeleteExperiment")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	if err := h.svc.DeleteExperiment(ctx, tenantID, id); err != nil {
		mapError(c, err)
		return
	}

	respondSuccess(c, gin.H{"message": "deleted"})
}
