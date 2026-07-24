package handler

import (
	"context"
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/product-line/models"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
	"go.opentelemetry.io/otel"
)

// Service defines the contract the handler needs from the service layer.
type Service interface {
	Create(ctx context.Context, tenantID string, req models.CreateProductLineRequest) (*models.ProductLine, error)
	Get(ctx context.Context, tenantID, id string) (*models.ProductLine, error)
	GetByName(ctx context.Context, tenantID, name string) (*models.ProductLine, error)
	List(ctx context.Context, tenantID string, limit, offset int) ([]models.ProductLine, error)
	Update(ctx context.Context, tenantID, id string, req models.UpdateProductLineRequest) (*models.ProductLine, error)
	Delete(ctx context.Context, tenantID, id string) error
	Activate(ctx context.Context, tenantID, id string) (*models.ProductLine, error)
	Suspend(ctx context.Context, tenantID, id string) (*models.ProductLine, error)
	CreateReleaseTrain(ctx context.Context, tenantID, productLineID string, req models.CreateReleaseTrainRequest) (*models.ReleaseTrain, error)
	GetReleaseTrains(ctx context.Context, tenantID, productLineID string) ([]models.ReleaseTrain, error)
	CreateHotfixChannel(ctx context.Context, tenantID, productLineID string, req models.CreateHotfixChannelRequest) (*models.HotfixChannel, error)
	GetHotfixChannels(ctx context.Context, tenantID, productLineID string) ([]models.HotfixChannel, error)
	IsHotfixBranch(ctx context.Context, tenantID, productLineID, branchName string) (bool, error)
}

type Handler struct {
	svc Service
}

func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes wires up all product-line endpoints with auth middleware.
// Mirrors TS routes at /api/product-lines/...
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/product-lines")

	// --- ProductLine CRUD ---
	f.POST("", auth.RequirePermission("product_line", "write"), h.Create)
	f.GET("", auth.RequirePermission("product_line", "read"), h.List)
	f.GET("/:id", auth.RequirePermission("product_line", "read"), h.Get)
	f.PUT("/:id", auth.RequirePermission("product_line", "write"), h.Update)
	f.DELETE("/:id", auth.RequirePermission("product_line", "delete"), h.Delete)

	// --- Name lookup ---
	f.GET("/name/:name", auth.RequirePermission("product_line", "read"), h.GetByName)

	// --- Lifecycle ---
	f.POST("/:id/activate", auth.RequirePermission("product_line", "write"), h.Activate)
	f.POST("/:id/suspend", auth.RequirePermission("product_line", "write"), h.Suspend)

	// --- Branch-Environment Mapping ---
	f.GET("/:id/resolve-environment", auth.RequirePermission("product_line", "read"), h.ResolveEnvironment)
	f.GET("/:id/requires-approval", auth.RequirePermission("product_line", "read"), h.RequiresApproval)

	// --- ReleaseTrain ---
	f.POST("/:id/release-trains", auth.RequirePermission("product_line", "write"), h.CreateReleaseTrain)
	f.GET("/:id/release-trains", auth.RequirePermission("product_line", "read"), h.GetReleaseTrains)

	// --- HotfixChannel ---
	f.POST("/:id/hotfix-channels", auth.RequirePermission("product_line", "write"), h.CreateHotfixChannel)
	f.GET("/:id/hotfix-channels", auth.RequirePermission("product_line", "read"), h.GetHotfixChannels)
	f.GET("/:id/is-hotfix", auth.RequirePermission("product_line", "read"), h.IsHotfix)
}

// ==================== ProductLine CRUD ====================

func (h *Handler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Create")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateProductLineRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	m, err := h.svc.Create(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, m)
}

func (h *Handler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Get")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	m, err := h.svc.Get(ctx, tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, "ProductLine not found")
		return
	}
	middleware.RespondSuccess(c, m)
}

func (h *Handler) GetByName(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetByName")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	name := c.Param("name")
	m, err := h.svc.GetByName(ctx, tenantID, name)
	if err != nil {
		middleware.RespondNotFound(c, "ProductLine not found")
		return
	}
	middleware.RespondSuccess(c, m)
}

func (h *Handler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "List")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	items, err := h.svc.List(ctx, tenantID, limit, offset)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, items)
}

func (h *Handler) Update(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Update")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateProductLineRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	m, err := h.svc.Update(ctx, tenantID, id, req)
	if err != nil {
		middleware.RespondNotFound(c, "ProductLine not found")
		return
	}
	middleware.RespondSuccess(c, m)
}

func (h *Handler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Delete")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.Delete(ctx, tenantID, id); err != nil {
		middleware.RespondNotFound(c, "ProductLine not found")
		return
	}
	c.Status(204)
	return
}

// ==================== Lifecycle ====================

func (h *Handler) Activate(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Activate")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	m, err := h.svc.Activate(ctx, tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, "ProductLine not found")
		return
	}
	middleware.RespondSuccess(c, m)
}

func (h *Handler) Suspend(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Suspend")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	m, err := h.svc.Suspend(ctx, tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, "ProductLine not found")
		return
	}
	middleware.RespondSuccess(c, m)
}

// ==================== Branch-Environment Mapping ====================

// ResolveEnvironment resolves the target environment for a given branch.
// Currently returns the default "dev" environment; the TS implementation
// resolves via environmentMappings stored in the full product-line model.
func (h *Handler) ResolveEnvironment(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ResolveEnvironment")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	branch := c.Query("branch")
	// Verify product line exists
	if _, err := h.svc.Get(ctx, tenantID, id); err != nil {
		middleware.RespondNotFound(c, "ProductLine not found")
		return
	}
	environment := "dev"
	if branch != "" {
		// TODO: resolve via environmentMappings in the full model
		environment = "dev"
	}
	middleware.RespondSuccess(c, gin.H{"environment": environment})
}

// RequiresApproval checks whether a branch requires approval before deployment.
// Default: true when no mapping matches (safe default per TS service).
func (h *Handler) RequiresApproval(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RequiresApproval")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	_ = c.Query("branch")
	// Verify product line exists
	if _, err := h.svc.Get(ctx, tenantID, id); err != nil {
		middleware.RespondNotFound(c, "ProductLine not found")
		return
	}
	// Default to true (safe default per TS service)
	middleware.RespondSuccess(c, gin.H{"requiresApproval": true})
}

// ==================== ReleaseTrain ====================

func (h *Handler) CreateReleaseTrain(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateReleaseTrain")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	productLineID := c.Param("id")
	var req models.CreateReleaseTrainRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	// Verify product line exists
	if _, err := h.svc.Get(ctx, tenantID, productLineID); err != nil {
		middleware.RespondNotFound(c, "ProductLine not found")
		return
	}
	rt, err := h.svc.CreateReleaseTrain(ctx, tenantID, productLineID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, rt)
}

func (h *Handler) GetReleaseTrains(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetReleaseTrains")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	productLineID := c.Param("id")
	// Verify product line exists
	if _, err := h.svc.Get(ctx, tenantID, productLineID); err != nil {
		middleware.RespondNotFound(c, "ProductLine not found")
		return
	}
	rts, err := h.svc.GetReleaseTrains(ctx, tenantID, productLineID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, rts)
}

// ==================== HotfixChannel ====================

func (h *Handler) CreateHotfixChannel(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateHotfixChannel")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	productLineID := c.Param("id")
	var req models.CreateHotfixChannelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	// Verify product line exists
	if _, err := h.svc.Get(ctx, tenantID, productLineID); err != nil {
		middleware.RespondNotFound(c, "ProductLine not found")
		return
	}
	hc, err := h.svc.CreateHotfixChannel(ctx, tenantID, productLineID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, hc)
}

func (h *Handler) GetHotfixChannels(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetHotfixChannels")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	productLineID := c.Param("id")
	// Verify product line exists
	if _, err := h.svc.Get(ctx, tenantID, productLineID); err != nil {
		middleware.RespondNotFound(c, "ProductLine not found")
		return
	}
	hcs, err := h.svc.GetHotfixChannels(ctx, tenantID, productLineID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, hcs)
}

func (h *Handler) IsHotfix(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "IsHotfix")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	productLineID := c.Param("id")
	branch := c.Query("branch")
	isHotfix, err := h.svc.IsHotfixBranch(ctx, tenantID, productLineID, branch)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"isHotfix": isHotfix})
}
