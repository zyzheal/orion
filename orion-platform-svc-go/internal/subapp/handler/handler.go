package handler

import (
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/subapp/models"
	"orion/platform-svc-go/internal/subapp/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
	"go.opentelemetry.io/otel/trace"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes mounts all sub-app endpoints on the given router group.
// Routes mirror the TypeScript subapp-routes.ts:
//
//	GET    /subapps           — list all
//	GET    /subapps/enabled   — list enabled only
//	GET    /subapps/:key      — get single
//	GET    /subapps/:key/history — get config history
//	POST   /subapps           — create new
//	PUT    /subapps/:key      — update
//	PUT    /subapps/:key/status — toggle status
//	DELETE /subapps/:key      — delete
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/subapps")

	// GET /subapps — list all sub-app configurations (read)
	f.GET("", auth.RequirePermission("subapp", "read"), h.List)

	// GET /subapps/enabled — list enabled sub-apps only (read)
	f.GET("/enabled", auth.RequirePermission("subapp", "read"), h.ListEnabled)

	// GET /subapps/:key — get single sub-app config (read)
	f.GET("/:key", auth.RequirePermission("subapp", "read"), h.Get)

	// GET /subapps/:key/history — get configuration history (read)
	f.GET("/:key/history", auth.RequirePermission("subapp", "read"), h.History)

	// POST /subapps — create new sub-app (write)
	f.POST("", auth.RequirePermission("subapp", "write"), h.Create)

	// PUT /subapps/:key — update sub-app config (write)
	f.PUT("/:key", auth.RequirePermission("subapp", "write"), h.Update)

	// PUT /subapps/:key/status — toggle sub-app status (write)
	f.PUT("/:key/status", auth.RequirePermission("subapp", "write"), h.ToggleStatus)

	// DELETE /subapps/:key — delete sub-app (delete)
	f.DELETE("/:key", auth.RequirePermission("subapp", "delete"), h.Delete)
}

// --- Handlers ---

func (h *Handler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "List")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.GetAll(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": items, "total": len(items)})
}

func (h *Handler) ListEnabled(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListEnabled")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.GetEnabled(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": items})
}

func (h *Handler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Get")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	m, err := h.svc.GetByKey(ctx, tenantID, c.Param("key"))
	if err != nil {
		middleware.RespondNotFound(c, "sub-app not found")
		return
	}
	middleware.RespondSuccess(c, m)
}

func (h *Handler) History(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "History")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.GetHistory(ctx, tenantID, c.Param("key"))
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": items, "total": len(items)})
}

func (h *Handler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Create")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	createdBy := c.GetString("user_id")
	var req models.CreateSubAppRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	// Convert optional string pointers
	createdByPtr := &createdBy
	var m *models.SubApp
	var err error
	if createdBy != "" {
		m, err = h.svc.Create(ctx, tenantID, createdByPtr, req)
	} else {
		m, err = h.svc.Create(ctx, tenantID, nil, req)
	}
	if err != nil {
		if err == service.ErrSubAppKeyExists {
			middleware.RespondConflict(c, "sub-app with key already exists")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, m)
}

func (h *Handler) Update(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Update")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	updatedBy := c.GetString("user_id")
	var req models.UpdateSubAppRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	updatedByPtr := &updatedBy
	var m *models.SubApp
	var err error
	if updatedBy != "" {
		m, err = h.svc.Update(ctx, tenantID, c.Param("key"), updatedByPtr, req)
	} else {
		m, err = h.svc.Update(ctx, tenantID, c.Param("key"), nil, req)
	}
	if err != nil {
		if err == service.ErrSubAppNotFound {
			middleware.RespondNotFound(c, "sub-app not found")
			return
		}
		if err == service.ErrSubAppKeyImmutable {
			middleware.RespondBadRequest(c, "cannot change sub-app key")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, m)
}

func (h *Handler) ToggleStatus(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ToggleStatus")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	changedBy := c.GetString("user_id")
	changedByPtr := &changedBy
	var m *models.SubApp
	var err error
	if changedBy != "" {
		m, err = h.svc.ToggleStatus(ctx, tenantID, c.Param("key"), changedByPtr)
	} else {
		m, err = h.svc.ToggleStatus(ctx, tenantID, c.Param("key"), nil)
	}
	if err != nil {
		if err == service.ErrSubAppNotFound {
			middleware.RespondNotFound(c, "sub-app not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	message := "sub-app disabled successfully"
	if m.Status == models.SubAppStatusEnabled {
		message = "sub-app enabled successfully"
	}
	middleware.RespondSuccess(c, gin.H{"data": m, "message": message})
}

func (h *Handler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Delete")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	changedBy := c.GetString("user_id")
	changedByPtr := &changedBy
	var err error
	if changedBy != "" {
		err = h.svc.Delete(ctx, tenantID, c.Param("key"), changedByPtr)
	} else {
		err = h.svc.Delete(ctx, tenantID, c.Param("key"), nil)
	}
	if err != nil {
		if err == service.ErrSubAppNotFound {
			middleware.RespondNotFound(c, "sub-app not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "sub-app deleted successfully"})
}
