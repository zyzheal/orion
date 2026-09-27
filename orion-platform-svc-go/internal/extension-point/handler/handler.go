// Package handler provides HTTP handlers for the Extension Point Framework.
// All endpoints are mounted under /api/v1 prefix via RegisterRoutes.
//
// API contract:
//
//	GET    /api/v1/extension-points             - List all extension points
//	GET    /api/v1/extension-points/:name        - Get by name
//	POST   /api/v1/extension-points              - Register new extension point
//	PUT    /api/v1/extension-points/:name        - Update config/status
//	POST   /api/v1/extension-points/:name/init   - Initialize extension point
//	POST   /api/v1/extension-points/:name/shutdown - Shutdown extension point
//	GET    /api/v1/extension-points/:name/status - Get status
//	POST   /api/v1/startups                      - Run startup tasks
//	GET    /api/v1/startups                      - List startup tasks
//	GET    /api/v1/startups/:name/status         - Get startup status
//	GET    /api/v1/extension-points/health       - Health check (no auth)
//	GET    /api/v1/extension-points/builtins     - List builtin extension points (Phase 303)
package handler

import (
	"context"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/extension-point/models"
	"orion/platform-svc-go/internal/extension-point/service"
	"orion/platform-svc-go/internal/middleware"
	"orion/platform-svc-go/internal/pagination"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
)

// Service defines the methods the handler calls on the service layer.
type Service interface {
	// Extension CRUD
	ListExtensions(ctx context.Context, category, status string, offset, limit int) ([]models.ExtensionSummary, int, error)
	GetExtension(ctx context.Context, name string) (*models.ExtensionSummary, error)
	Register(ctx context.Context, req *models.CreateExtensionRequest) (*models.ExtensionSummary, error)
	UpdateExtension(ctx context.Context, name string, req *models.UpdateExtensionRequest) (*models.ExtensionSummary, error)
	InitializeExtension(ctx context.Context, name string) (*models.ExtensionSummary, error)
	ShutdownExtension(ctx context.Context, name string) (*models.ExtensionSummary, error)
	GetExtensionStatus(ctx context.Context, name string) (*models.ExtensionSummary, error)

	// Startup CRUD
	CreateStartup(ctx context.Context, names []string) ([]models.StartupTask, error)
	ListStartupTasks(ctx context.Context, status string, offset, limit int) ([]models.StartupTask, int, error)
	GetStartupStatus(ctx context.Context, name string) (*models.StartupTask, error)

	// Phase 303: Builtin extension point catalog
	ListBuiltinPoints(ctx context.Context, category string) ([]models.BuiltinPointMeta, error)
}

type Handler struct{ svc Service }

func NewHandler(svc Service) *Handler { return &Handler{svc: svc} }

// RegisterRoutes mounts all extension-point endpoints under the given RouterGroup.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	// Health (no auth)
	rg.GET("/extension-points/health", h.Health)

	// Extension point CRUD
	rg.GET("/extension-points", auth.RequirePermission("extension-point", "read"), h.ListExtensions)
	rg.POST("/extension-points", auth.RequirePermission("extension-point", "write"), h.Register)
	// Phase 303: Builtin catalog — must be declared BEFORE /:name to avoid
	// being shadowed by the parameterized route.
	rg.GET("/extension-points/builtins", auth.RequirePermission("extension-point", "read"), h.ListBuiltinPoints)
	rg.GET("/extension-points/:name", auth.RequirePermission("extension-point", "read"), h.GetExtension)
	rg.PUT("/extension-points/:name", auth.RequirePermission("extension-point", "write"), h.UpdateExtension)
	rg.POST("/extension-points/:name/init", auth.RequirePermission("extension-point", "write"), h.InitializeExtension)
	rg.POST("/extension-points/:name/shutdown", auth.RequirePermission("extension-point", "write"), h.ShutdownExtension)
	rg.GET("/extension-points/:name/status", auth.RequirePermission("extension-point", "read"), h.GetExtensionStatus)

	// Startup tasks
	rg.POST("/startups", auth.RequirePermission("extension-point", "write"), h.CreateStartup)
	rg.GET("/startups", auth.RequirePermission("extension-point", "read"), h.ListStartupTasks)
	rg.GET("/startups/:name/status", auth.RequirePermission("extension-point", "read"), h.GetStartupStatus)
}

// ===========================================================================
// Health
// ===========================================================================

func (h *Handler) Health(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ExtensionPointHealth")
	defer span.End()
	middleware.RespondSuccess(c, gin.H{"status": "ok"})
}

// ===========================================================================
// Extension Point CRUD
// ===========================================================================

func (h *Handler) ListExtensions(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListExtensions")
	defer span.End()
	_ = c.GetString("tenant_id")
	category := c.Query("category")
	status := c.Query("status")
	page := pagination.Page(c.Query("page"), 1)
	ps := pagination.Limit(c.Query("page_size"), 20)
	// The cap must land before the offset is derived: deriving from the requested
	// size and capping the limit afterwards makes `page=3&page_size=1000` return
	// rows 2001-2100 while every reader of the URL expects rows 201-300.
	//
	// This handler used to read both params with a bare strconv.Atoi, so page=-5,
	// page=0 and page=abc each produced a negative OFFSET - an error instead of a
	// page, turning a GET into a 500. `?page=abc` was the worst of them: one
	// mistyped character, Atoi returning 0 and discarding its error.
	//
	// offset and limit are derived once, here, and reused in the envelope. They
	// used to be computed twice - in the service call and again in
	// RespondPaginated - so the envelope could report a window the query never
	// fetched, and any edit to one side had to be made twice or they drifted.
	if ps > 100 {
		ps = 100
	}
	offset := pagination.OffsetFromPage(page, ps)
	limit := ps

	items, total, err := h.svc.ListExtensions(ctx, category, status, offset, limit)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if items == nil {
		items = []models.ExtensionSummary{}
	}
	middleware.RespondPaginated(c, items, offset, limit, total)
}

// ListBuiltinPoints returns the 15 builtin extension points catalog
// (Phase 303). Optional `category` query param filters by startup/api/handler/
// service/listener. Unknown category returns 400.
func (h *Handler) ListBuiltinPoints(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListBuiltinPoints")
	defer span.End()
	category := c.Query("category")
	points, err := h.svc.ListBuiltinPoints(ctx, category)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if points == nil {
		points = []models.BuiltinPointMeta{}
	}
	middleware.RespondSuccess(c, gin.H{
		"items": points,
		"count": len(points),
	})
}

func (h *Handler) GetExtension(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetExtension")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	name := c.Param("name")
	ep, err := h.svc.GetExtension(ctx, name)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	_ = tenantID // enforced at service layer
	middleware.RespondSuccess(c, ep)
}

func (h *Handler) Register(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RegisterExtension")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateExtensionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	ep, err := h.svc.Register(ctx, &req)
	if err != nil {
		if err.Error() == service.ErrDuplicateName.Error() {
			middleware.RespondConflict(c, err.Error())
			return
		}
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	_ = tenantID // enforced at service layer
	middleware.RespondCreated(c, ep)
}

func (h *Handler) UpdateExtension(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateExtension")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	name := c.Param("name")
	var req models.UpdateExtensionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	ep, err := h.svc.UpdateExtension(ctx, name, &req)
	if err != nil {
		if err.Error() == service.ErrExtensionNotFound.Error() {
			middleware.RespondNotFound(c, err.Error())
			return
		}
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	_ = tenantID // enforced at service layer
	middleware.RespondSuccess(c, ep)
}

func (h *Handler) InitializeExtension(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InitializeExtension")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	name := c.Param("name")
	ep, err := h.svc.InitializeExtension(ctx, name)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	_ = tenantID // enforced at service layer
	middleware.RespondSuccess(c, gin.H{
		"status": ep.Status,
		"name":   ep.Name,
	})
}

func (h *Handler) ShutdownExtension(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ShutdownExtension")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	name := c.Param("name")
	ep, err := h.svc.ShutdownExtension(ctx, name)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	_ = tenantID // enforced at service layer
	middleware.RespondSuccess(c, gin.H{
		"status": ep.Status,
		"name":   ep.Name,
	})
}

func (h *Handler) GetExtensionStatus(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetExtensionStatus")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	name := c.Param("name")
	ep, err := h.svc.GetExtensionStatus(ctx, name)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	_ = tenantID // enforced at service layer
	middleware.RespondSuccess(c, ep)
}

// ===========================================================================
// Startup Tasks
// ===========================================================================

func (h *Handler) CreateStartup(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateStartup")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateStartupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if len(req.ExtensionNames) == 0 {
		middleware.RespondBadRequest(c, "extension_names is required")
		return
	}
	tasks, err := h.svc.CreateStartup(ctx, req.ExtensionNames)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	_ = tenantID // enforced at service layer
	middleware.RespondCreated(c, tasks)
}

func (h *Handler) ListStartupTasks(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListStartupTasks")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	status := c.Query("status")
	page := pagination.Page(c.Query("page"), 1)
	ps := pagination.Limit(c.Query("page_size"), 20)
	// Same floors and cap as ListExtensions, and the cap before the derivation:
	// the two list endpoints share the pagination package for exactly this reason.
	if ps > 100 {
		ps = 100
	}
	offset := pagination.OffsetFromPage(page, ps)
	limit := ps

	items, total, err := h.svc.ListStartupTasks(ctx, status, offset, limit)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if items == nil {
		items = []models.StartupTask{}
	}
	_ = tenantID // enforced at service layer
	middleware.RespondPaginated(c, items, offset, limit, total)
}

func (h *Handler) GetStartupStatus(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetStartupStatus")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	name := c.Param("name")
	t, err := h.svc.GetStartupStatus(ctx, name)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	_ = tenantID // enforced at service layer
	middleware.RespondSuccess(c, t)
}
