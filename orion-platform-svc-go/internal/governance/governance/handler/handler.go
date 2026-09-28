package handler

import (
	"context"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/governance/governance/models"
	"orion/platform-svc-go/internal/governance/governance/service"
	"orion/platform-svc-go/internal/pagination"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
)

// Service defines the methods the handler calls on the service layer. Keeping it
// here rather than in the service package lets the handler be tested with a
// fake and keeps the wiring source-compatible: *service.Service already
// satisfies it.
type Service interface {
	Create(ctx context.Context, tenantID string, req *models.CreatePolicyRequest) (*models.Policy, error)
	List(ctx context.Context, tenantID string, offset, limit int) ([]models.Policy, error)
	GetByID(ctx context.Context, tenantID, id string) (*models.Policy, error)
	Delete(ctx context.Context, tenantID, id string) error
	Count(ctx context.Context, tenantID string) (int, error)
}

var _ Service = (*service.Service)(nil)

type Handler struct{ svc Service }

func NewHandler(svc Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	r := rg.Group("/policies")
	r.POST("", auth.RequirePermission("governance", "write"), h.Create)
	r.GET("", h.List)
	r.GET("/:id", h.Get)
	r.DELETE("/:id", auth.RequirePermission("governance", "delete"), h.Delete)
	r.GET("/count", h.Count)
}

func (h *Handler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateGovernancePolicy")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreatePolicyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	d, err := h.svc.Create(ctx, tenantID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, d)
}

func (h *Handler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListGovernancePolicies")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	page := pagination.Page(c.Query("page"), 1)
	ps := pagination.Limit(c.Query("page_size"), 20)
	// The cap must land before the offset is derived: deriving from the
	// requested size and capping the limit afterwards makes
	// page=3&page_size=1000 return rows 2001-2100 while every reader of the
	// URL expects rows 201-300.
	//
	// This handler used to read both params with a bare strconv.Atoi, so
	// page=-5, page=0 and page=abc each reached Postgres as a negative OFFSET -
	// an error instead of a page, turning a GET into a 500. page=abc was the
	// worst of them: one mistyped character, Atoi returning 0 and throwing its
	// error away. Nothing capped the size either, so page_size=100000 went
	// straight into LIMIT.
	//
	// The module already has a helper shaped exactly like this:
	// models.PaginatedRequest owns the same two floors and the same 100 cap.
	// It is dead code - zero production callers and one test that only pins the
	// default - and its Offset derives before Limit caps, so it would have
	// answered page=3&page_size=250 with offset 500 and limit 100. One call
	// site is not worth routing through a field on a request struct, so the
	// arithmetic stays here. The cap below is that same 100.
	if ps > 100 {
		ps = 100
	}
	offset := pagination.OffsetFromPage(page, ps)
	limit := ps

	items, err := h.svc.List(ctx, tenantID, offset, limit)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	if items == nil {
		items = []models.Policy{}
	}
	respondSuccess(c, items)
}

func (h *Handler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetGovernancePolicy")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	d, err := h.svc.GetByID(ctx, tenantID, c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, d)
}

func (h *Handler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteGovernancePolicy")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if err := h.svc.Delete(ctx, tenantID, c.Param("id")); err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, map[string]any{"message": "deleted"})
}

func (h *Handler) Count(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CountGovernancePolicies")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	count, err := h.svc.Count(ctx, tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, map[string]any{"count": count})
}
