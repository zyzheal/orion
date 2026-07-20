package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/workflow/models"
	"orion/platform-svc-go/internal/workflow/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
	"go.opentelemetry.io/otel"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all workflow endpoints under the given group.
// Matches /v1/workflows routes from the TS source.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/workflows")

	// GET /workflows - List workflows
	f.GET("", auth.RequirePermission("workflow", "read"), h.List)
	// GET /workflows/:id - Get workflow by ID
	f.GET("/:id", auth.RequirePermission("workflow", "read"), h.Get)
	// POST /workflows - Create workflow
	f.POST("", auth.RequirePermission("workflow", "write"), h.Create)
	// PUT /workflows/:id - Update workflow
	f.PUT("/:id", auth.RequirePermission("workflow", "write"), h.Update)
	// DELETE /workflows/:id - Delete workflow
	f.DELETE("/:id", auth.RequirePermission("workflow", "delete"), h.Delete)
	// POST /workflows/:id/pause - Pause workflow
	f.POST("/:id/pause", auth.RequirePermission("workflow", "write"), h.Pause)
	// POST /workflows/:id/resume - Resume workflow
	f.POST("/:id/resume", auth.RequirePermission("workflow", "write"), h.Resume)
	// POST /workflows/:id/execute - Execute workflow
	f.POST("/:id/execute", auth.RequirePermission("workflow", "execute"), h.Execute)
	// GET /workflows/:id/executions - List executions by workflow ID
	f.GET("/:id/executions", auth.RequirePermission("workflow", "read"), h.ListExecutions)
	// GET /workflows/executions/:executionId - Get execution detail
	f.GET("/executions/:executionId", auth.RequirePermission("workflow", "read"), h.GetExecution)
}

// getTenantID extracts tenant_id from Gin context, falling back to a zero UUID.
func (h *Handler) getTenantID(c *gin.Context) string {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		return "00000000-0000-0000-0000-000000000000"
	}
	return tenantID
}

// getPagination extracts page and pageSize from query params with defaults.
func getPagination(c *gin.Context) (int, int) {
	page := 1
	pageSize := 20
	if p, err := strconv.Atoi(c.Query("page")); err == nil && p > 0 {
		page = p
	}
	if ps, err := strconv.Atoi(c.Query("pageSize")); err == nil && ps > 0 {
		pageSize = ps
		if pageSize > 100 {
			pageSize = 100
		}
	}
	return page, pageSize
}

// --- Workflow handlers ---

func (h *Handler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "List")
	defer span.End()
	tenantID := h.getTenantID(c)
	status := c.Query("status")
	var statusPtr *string
	if status != "" {
		statusPtr = &status
	}
	page, pageSize := getPagination(c)

	wfs, total, err := h.svc.List(ctx, tenantID, statusPtr, page, pageSize)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, models.PaginatedResponse{
		Data:     wfs,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	})
}

func (h *Handler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Get")
	defer span.End()
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	wf, err := h.svc.Get(ctx, id, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "workflow not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, wf)
}

func (h *Handler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Create")
	defer span.End()
	var req models.CreateWorkflowRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	createdBy := auth.GetUserID(c)

	wf, err := h.svc.Create(ctx, &req, tenantID, createdBy)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, wf)
}

func (h *Handler) Update(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Update")
	defer span.End()
	id := c.Param("id")
	var req models.UpdateWorkflowRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	wf, err := h.svc.Update(ctx, id, &req, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "workflow not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, wf)
}

func (h *Handler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Delete")
	defer span.End()
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	deleted, err := h.svc.Delete(ctx, id, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if !deleted {
		middleware.RespondNotFound(c, "workflow not found")
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "workflow deleted"})
}

func (h *Handler) Pause(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Pause")
	defer span.End()
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	wf, err := h.svc.Pause(ctx, id, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "workflow not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, wf)
}

func (h *Handler) Resume(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Resume")
	defer span.End()
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	wf, err := h.svc.Resume(ctx, id, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "workflow not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, wf)
}

func (h *Handler) Execute(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Execute")
	defer span.End()
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	triggeredBy := auth.GetUserID(c)

	var body struct {
		InitialInput *string `json:"initialInput"`
	}
	_ = c.ShouldBindJSON(&body)

	initialInput := "{}"
	if body.InitialInput != nil {
		initialInput = *body.InitialInput
	}

	exec, err := h.svc.Execute(ctx, id, tenantID, triggeredBy, initialInput)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, err.Error())
			return
		}
		if err == service.ErrWorkflowDisabled {
			middleware.RespondBadRequest(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, exec)
}

func (h *Handler) ListExecutions(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListExecutions")
	defer span.End()
	workflowID := c.Param("id")
	tenantID := h.getTenantID(c)
	page, pageSize := getPagination(c)

	execs, total, err := h.svc.ListExecutions(ctx, workflowID, tenantID, page, pageSize)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, models.PaginatedResponse{
		Data:     execs,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	})
}

func (h *Handler) GetExecution(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetExecution")
	defer span.End()
	executionID := c.Param("executionId")
	tenantID := h.getTenantID(c)
	exec, err := h.svc.GetExecution(ctx, executionID, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "workflow execution not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, exec)
}
