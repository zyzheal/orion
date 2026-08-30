package migration

import (
	"net/http"

	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/errors"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// Handler provides HTTP handlers for migration operations.
type Handler struct {
	svc *Service
	log *zap.Logger
}

// NewHandler creates a new migration handler.
func NewHandler(svc *Service, log *zap.Logger) *Handler {
	return &Handler{svc: svc, log: log}
}

// RegisterRoutes mounts all migration routes under /migration.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	mg := rg.Group("/migration")

	// --- Plan CRUD ---
	mg.GET("/plans", auth.RequirePermission("migration", "read"), h.ListPlans)
	mg.POST("/plans", auth.RequirePermission("migration", "write"), h.CreatePlan)
	mg.GET("/plans/:id", auth.RequirePermission("migration", "read"), h.GetPlan)
	mg.PUT("/plans/:id", auth.RequirePermission("migration", "write"), h.UpdatePlan)
	mg.DELETE("/plans/:id", auth.RequirePermission("migration", "delete"), h.DeletePlan)

	// --- Execution ---
	mg.POST("/plans/:id/execute", auth.RequirePermission("migration", "execute"), h.Execute)
	mg.POST("/plans/:id/validate", auth.RequirePermission("migration", "write"), h.Validate)
	mg.POST("/plans/:id/rollback", auth.RequirePermission("migration", "execute"), h.Rollback)

	// --- Schema Diff ---
	mg.GET("/plans/:id/diff", auth.RequirePermission("migration", "read"), h.SchemaDiff)

	// --- Steps & Stats ---
	mg.GET("/plans/:id/steps", auth.RequirePermission("migration", "read"), h.GetSteps)
	mg.GET("/stats", auth.RequirePermission("migration", "read"), h.GetStats)
}

// ==================== Plan CRUD ====================

func (h *Handler) CreatePlan(c *gin.Context) {
	var input CreatePlanInput
	if err := c.ShouldBindJSON(&input); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, "invalid request body: "+err.Error(), http.StatusBadRequest)
		return
	}
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		errors.WriteError(c, errors.ErrBadRequest, "tenant_id required", http.StatusBadRequest)
		return
	}
	input.TenantID = tenantID
	plan, err := h.svc.CreatePlan(c.Request.Context(), input)
	if err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), http.StatusBadRequest)
		return
	}
	errors.WriteCreated(c, plan)
}

func (h *Handler) GetPlan(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	plan, err := h.svc.GetPlan(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrNotFound, err.Error(), http.StatusNotFound)
		return
	}
	errors.WriteSuccess(c, plan)
}

func (h *Handler) ListPlans(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	plans, err := h.svc.ListPlans(c.Request.Context(), tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, "internal error", http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, plans)
}

func (h *Handler) UpdatePlan(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var input UpdatePlanInput
	if err := c.ShouldBindJSON(&input); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, "invalid request body: "+err.Error(), http.StatusBadRequest)
		return
	}
	plan, err := h.svc.UpdatePlan(c.Request.Context(), tenantID, c.Param("id"), input)
	if err != nil {
		errors.WriteError(c, errors.ErrNotFound, err.Error(), http.StatusNotFound)
		return
	}
	errors.WriteSuccess(c, plan)
}

func (h *Handler) DeletePlan(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.DeletePlan(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		errors.WriteError(c, errors.ErrNotFound, err.Error(), http.StatusNotFound)
		return
	}
	c.Status(http.StatusOK)
}

// ==================== Execution ====================

func (h *Handler) Execute(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	result, err := h.svc.Execute(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrNotFound, err.Error(), http.StatusNotFound)
		return
	}
	errors.WriteSuccess(c, result)
}

func (h *Handler) Validate(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	result, err := h.svc.Validate(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrNotFound, err.Error(), http.StatusNotFound)
		return
	}
	errors.WriteSuccess(c, result)
}

func (h *Handler) Rollback(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	result, err := h.svc.Rollback(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrNotFound, err.Error(), http.StatusNotFound)
		return
	}
	errors.WriteSuccess(c, result)
}

// ==================== Schema Diff ====================

func (h *Handler) SchemaDiff(c *gin.Context) {
	diff, err := h.svc.SchemaDiff(c.Request.Context(), c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrNotFound, err.Error(), http.StatusNotFound)
		return
	}
	errors.WriteSuccess(c, diff)
}

// ==================== Steps & Stats ====================

func (h *Handler) GetSteps(c *gin.Context) {
	steps, err := h.svc.GetSteps(c.Request.Context(), c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrNotFound, err.Error(), http.StatusNotFound)
		return
	}
	errors.WriteSuccess(c, steps)
}

func (h *Handler) GetStats(c *gin.Context) {
	stats := h.svc.GetStats(c.Request.Context())
	errors.WriteSuccess(c, stats)
}
