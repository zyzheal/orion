package handler

import (
	"errors"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/middleware"
	"orion/platform-svc-go/internal/roweditor"
	"orion/platform-svc-go/internal/roweditor/handler/models"
	"orion/platform-svc-go/internal/roweditor/service"
)

type Handler struct {
	svc *service.Service
	db  roweditor.DBOperations
}

func NewHandler(svc *service.Service, db roweditor.DBOperations) *Handler {
	return &Handler{svc: svc, db: db}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	g := rg.Group("/row-editors")
	g.POST("/register", auth.RequirePermission("roweditor", "write"), h.RegisterEditor)
	g.GET("/:name/stats", auth.RequirePermission("roweditor", "read"), h.Stats)
	rg.POST("/rows/:editor/create", auth.RequirePermission("roweditor", "write"), h.CreateRow)
	rg.GET("/rows/:editor/:row_id", auth.RequirePermission("roweditor", "read"), h.ReadRow)
	rg.PUT("/rows/:editor", auth.RequirePermission("roweditor", "write"), h.UpdateRow)
	rg.DELETE("/rows/:editor/:row_id", auth.RequirePermission("roweditor", "delete"), h.DeleteRow)
	rg.POST("/rows/:editor/batch-create", auth.RequirePermission("roweditor", "write"), h.BatchCreate)
	rg.POST("/rows/:editor/batch-update", auth.RequirePermission("roweditor", "write"), h.BatchUpdate)
}

func (h *Handler) RegisterEditor(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RegisterRowEditor")
	defer span.End()
	tenantID, ok := h.tenantID(c)
	if !ok {
		return
	}
	var req models.RowEditorSpecRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	name := c.Query("name")
	if name == "" {
		name = req.TableName
	}
	if err := h.svc.RegisterEditor(ctx, tenantID, name, &req); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, gin.H{"status": "registered", "name": name})
}

func (h *Handler) Stats(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetRowEditorStats")
	defer span.End()
	tenantID, ok := h.tenantID(c)
	if !ok {
		return
	}
	stats, err := h.svc.Stats(ctx, tenantID, c.Param("name"))
	if err != nil {
		// A missing editor is a 404; anything else is a server fault. Reporting
		// every error as 404 hid database failures behind the wrong status code.
		if errors.Is(err, roweditor.ErrEditorNotFound) {
			middleware.RespondNotFound(c, "row editor not registered")
		} else {
			middleware.RespondInternalError(c, err.Error())
		}
		return
	}
	middleware.RespondSuccess(c, stats)
}

func (h *Handler) CreateRow(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateRowEditorRow")
	defer span.End()
	tenantID, ok := h.tenantID(c)
	if !ok {
		return
	}
	var req models.RowCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	resp, err := h.svc.CreateRow(ctx, tenantID, c.Param("editor"), h.db, &req)
	if err != nil {
		h.respondEditError(c, err)
		return
	}
	middleware.RespondCreated(c, resp)
}

func (h *Handler) ReadRow(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ReadRowEditorRow")
	defer span.End()
	tenantID, ok := h.tenantID(c)
	if !ok {
		return
	}
	resp, err := h.svc.ReadRow(ctx, tenantID, c.Param("editor"), h.db, c.Param("row_id"))
	if err != nil {
		h.respondEditError(c, err)
		return
	}
	middleware.RespondSuccess(c, resp)
}

func (h *Handler) UpdateRow(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateRowEditorRow")
	defer span.End()
	tenantID, ok := h.tenantID(c)
	if !ok {
		return
	}
	var req models.RowUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	resp, err := h.svc.UpdateRow(ctx, tenantID, c.Param("editor"), h.db, &req)
	if err != nil {
		h.respondEditError(c, err)
		return
	}
	middleware.RespondSuccess(c, resp)
}

func (h *Handler) DeleteRow(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteRowEditorRow")
	defer span.End()
	tenantID, ok := h.tenantID(c)
	if !ok {
		return
	}
	resp, err := h.svc.DeleteRow(ctx, tenantID, c.Param("editor"), h.db, c.Param("row_id"))
	if err != nil {
		h.respondEditError(c, err)
		return
	}
	middleware.RespondSuccess(c, resp)
}

func (h *Handler) BatchCreate(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "BatchCreateRows")
	defer span.End()
	tenantID, ok := h.tenantID(c)
	if !ok {
		return
	}
	var req models.BatchCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	resp, err := h.svc.BatchCreate(ctx, tenantID, c.Param("editor"), h.db, &req)
	if err != nil {
		h.respondEditError(c, err)
		return
	}
	middleware.RespondCreated(c, resp)
}

func (h *Handler) BatchUpdate(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "BatchUpdateRows")
	defer span.End()
	tenantID, ok := h.tenantID(c)
	if !ok {
		return
	}
	var req models.BatchUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	resp, err := h.svc.BatchUpdate(ctx, tenantID, c.Param("editor"), h.db, &req)
	if err != nil {
		h.respondEditError(c, err)
		return
	}
	middleware.RespondSuccess(c, resp)
}

// tenantID returns the caller's tenant id from the Gin context. It fails
// closed: the JWT middleware populates tenant_id, and when it has not, every
// query would run without a tenant predicate. The SQL helpers silently drop an
// empty tenant id, so an unauthenticated request would have read and written
// across all tenants. Callers must stop when ok is false — the 401 is already
// written.
func (h *Handler) tenantID(c *gin.Context) (string, bool) {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		middleware.RespondUnauthorized(c, "tenant_id required")
		return "", false
	}
	return tenantID, true
}

// respondEditError maps a service error to a status code. Not-found conditions
// are 404, an optimistic-lock conflict is 409, and validation failures are 400 —
// before every one of them came back as a 500, which turned a caller's mistake
// into a server incident.
func (h *Handler) respondEditError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, roweditor.ErrRowNotFound), errors.Is(err, roweditor.ErrEditorNotFound):
		middleware.RespondNotFound(c, err.Error())
	case errors.Is(err, roweditor.ErrOptimisticLock):
		middleware.RespondConflict(c, err.Error())
	case errors.Is(err, roweditor.ErrValidationError), errors.Is(err, roweditor.ErrReadOnlyField), errors.Is(err, roweditor.ErrNoChanges):
		middleware.RespondBadRequest(c, err.Error())
	default:
		middleware.RespondInternalError(c, err.Error())
	}
}
