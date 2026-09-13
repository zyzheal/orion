package handler

import (
	"strconv"

	"context"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/middleware"
	"orion/platform-svc-go/internal/startup/models"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
)

// Service defines the interface used by Handler.
//
// Every method takes context.Context: the previous declaration used interface{}
// and returned interface{}, which meant a real context was type-asserted away
// before reaching the service, so request deadlines and cancellation never
// applied to any of the calls below.
type Service interface {
	// Lifecycle.
	Start(ctx context.Context, tenantID string) error
	Stop(ctx context.Context) error

	// Module CRUD.
	CreateModuleRow(ctx context.Context, tenantID string, req *models.CreateModuleRequest) (*models.StartupModule, error)
	ListModules(ctx context.Context, tenantID string, offset, limit int) ([]models.StartupModule, int, error)
	GetModuleByID(ctx context.Context, tenantID, id string) (*models.StartupModule, error)
	UpdateModuleRow(ctx context.Context, tenantID, id string, req *models.UpdateModuleRequest) (*models.StartupModule, error)
	DeleteModule(ctx context.Context, tenantID, id string) error

	// Initialisation, health and dependency edges.
	InitModule(ctx context.Context, tenantID, id string) (*models.StartupModule, error)
	HealthCheckModule(ctx context.Context, tenantID, id string) (bool, error)
	AddDependency(ctx context.Context, tenantID, id, dependsOn string) (*models.StartupDependency, error)

	// Read-only runtime state.
	GetStartupProgress() map[string]interface{}

	// Error classifiers. The service owns its own error taxonomy, so the handler
	// maps these to HTTP statuses without importing the concrete package.
	IsNotFound(err error) bool
	IsUnhealthy(err error) bool
	IsConflict(err error) bool
}

// Handler exposes HTTP endpoints for startup module management.
type Handler struct {
	svc Service
}

// NewHandler creates a new Handler instance.
func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes mounts all startup routes onto the given router group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	s := rg.Group("/startup")

	s.POST("/start", h.StartAll)
	s.POST("/stop", h.StopAll)
	s.GET("/status", h.StartupProgress)

	m := s.Group("/modules")
	m.POST("", auth.RequirePermission("startup", "write"), h.CreateModule)
	m.GET("", h.ListModules)
	m.GET("/:id", h.GetModule)
	m.PUT("/:id", auth.RequirePermission("startup", "write"), h.UpdateModule)
	m.DELETE("/:id", auth.RequirePermission("startup", "delete"), h.DeleteModule)
	m.POST("/:id/init", auth.RequirePermission("startup", "write"), h.InitModule)
	m.POST("/:id/health", h.HealthCheckModule)
	m.POST("/:id/depends", auth.RequirePermission("startup", "write"), h.AddDependency)
}

// CreateModule creates a new startup module configuration.
func (h *Handler) CreateModule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "StartupCreateModule")
	defer span.End()
	tenantID := c.GetString("tenant_id")

	var req models.CreateModuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	mod, err := h.svc.CreateModuleRow(ctx, tenantID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, mod)
}

// ListModules retrieves startup modules with pagination.
func (h *Handler) ListModules(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "StartupListModules")
	defer span.End()
	page, pageSize := parsePagination(c)
	offset := (page - 1) * pageSize

	items, total, err := h.svc.ListModules(ctx, c.GetString("tenant_id"), offset, pageSize)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondPaginated(c, items, offset, pageSize, total)
}

// GetModule retrieves a single startup module by id.
func (h *Handler) GetModule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "StartupGetModule")
	defer span.End()

	mod, err := h.svc.GetModuleByID(ctx, c.GetString("tenant_id"), c.Param("id"))
	if err != nil {
		if h.svc.IsNotFound(err) {
			middleware.RespondNotFound(c, "startup module not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, mod)
}

// UpdateModule updates an existing startup module.
func (h *Handler) UpdateModule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "StartupUpdateModule")
	defer span.End()
	tenantID := c.GetString("tenant_id")

	var req models.UpdateModuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	mod, err := h.svc.UpdateModuleRow(ctx, tenantID, c.Param("id"), &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, mod)
}

// DeleteModule removes a startup module by id.
func (h *Handler) DeleteModule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "StartupDeleteModule")
	defer span.End()

	if err := h.svc.DeleteModule(ctx, c.GetString("tenant_id"), c.Param("id")); err != nil {
		if h.svc.IsNotFound(err) {
			middleware.RespondNotFound(c, "startup module not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondNoContent(c)
}

// -------------------------------------------------------
// Lifecycle
// -------------------------------------------------------

// StartAll initializes all registered modules.
func (h *Handler) StartAll(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "StartupStartAll")
	defer span.End()

	if err := h.svc.Start(ctx, c.GetString("tenant_id")); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	// Reply with the resulting runtime state, not a fixed message: the client
	// needs to see which modules actually came up.
	middleware.RespondSuccess(c, gin.H{
		"message":  "all modules started",
		"progress": h.svc.GetStartupProgress(),
	})
}

// StopAll shuts down all registered modules.
func (h *Handler) StopAll(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "StartupStopAll")
	defer span.End()

	if err := h.svc.Stop(ctx); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{
		"message":  "all modules stopped",
		"progress": h.svc.GetStartupProgress(),
	})
}

// InitModule initializes a single module by id.
func (h *Handler) InitModule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "StartupInitModule")
	defer span.End()

	mod, err := h.svc.InitModule(ctx, c.GetString("tenant_id"), c.Param("id"))
	if err != nil {
		if h.svc.IsNotFound(err) {
			middleware.RespondNotFound(c, "startup module not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, mod)
}

// -------------------------------------------------------
// Health / Status
// -------------------------------------------------------

// StartupProgress returns the overall startup progress.
func (h *Handler) StartupProgress(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "StartupProgress")
	defer span.End()
	progress := h.svc.GetStartupProgress()
	middleware.RespondSuccess(c, progress)
}

// HealthCheckModule runs a health check on a single module.
//
// The endpoint used to reply {"healthy": true} for every id, so a missing or
// stopped module reported as healthy. An unhealthy answer is a 200 with
// healthy=false and the reason; only a check that could not run is a 500.
func (h *Handler) HealthCheckModule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "StartupHealthCheckModule")
	defer span.End()

	healthy, err := h.svc.HealthCheckModule(ctx, c.GetString("tenant_id"), c.Param("id"))
	if err != nil {
		switch {
		case h.svc.IsNotFound(err):
			middleware.RespondNotFound(c, "startup module not found")
			return
		case h.svc.IsUnhealthy(err):
			middleware.RespondSuccess(c, gin.H{
				"healthy": false,
				"module":  c.Param("id"),
				"reason":  err.Error(),
			})
			return
		default:
			middleware.RespondInternalError(c, err.Error())
			return
		}
	}
	middleware.RespondSuccess(c, gin.H{
		"healthy": healthy,
		"module":  c.Param("id"),
	})
}

// -------------------------------------------------------
// Dependencies
// -------------------------------------------------------

// AddDependency adds a dependency edge to a module.
func (h *Handler) AddDependency(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "StartupAddDependency")
	defer span.End()
	tenantID := c.GetString("tenant_id")

	var req models.CreateDependencyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	dep, err := h.svc.AddDependency(ctx, tenantID, c.Param("id"), req.DependsOn)
	if err != nil {
		switch {
		case h.svc.IsNotFound(err):
			middleware.RespondNotFound(c, err.Error())
			return
		case h.svc.IsConflict(err):
			middleware.RespondConflict(c, err.Error())
			return
		default:
			middleware.RespondInternalError(c, err.Error())
			return
		}
	}
	middleware.RespondCreated(c, dep)
}

// parsePagination reads page/page_size query params with sensible defaults.
func parsePagination(c *gin.Context) (int, int) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	return page, pageSize
}
