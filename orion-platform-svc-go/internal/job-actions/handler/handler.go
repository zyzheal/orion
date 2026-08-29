// Package handler exposes the job-actions executor over REST.
package handler

import (
	"errors"
	"strconv"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/job-actions/models"
	"orion/platform-svc-go/internal/job-actions/repository"
	"orion/platform-svc-go/internal/job-actions/service"
)

type Handler struct {
	exec *service.JobActionExecutor
	repo *repository.Repository
}

func NewHandler(exec *service.JobActionExecutor, repo *repository.Repository) *Handler {
	return &Handler{exec: exec, repo: repo}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	actions := rg.Group("/job-actions")
	actions.POST("", auth.RequirePermission("job-actions", "write"), h.CreateAction)
	actions.GET("", auth.RequirePermission("job-actions", "read"), h.ListActions)
	actions.GET("/:id", auth.RequirePermission("job-actions", "read"), h.GetAction)
	actions.POST("/:id/execute", auth.RequirePermission("job-actions", "execute"), h.ExecuteAction)
	actions.GET("/:id/history", auth.RequirePermission("job-actions", "read"), h.GetHistory)
}

func (h *Handler) tenantID(c *gin.Context) string {
	return c.GetString("tenant_id")
}

// ---------------------------------------------------------------------------
// CreateAction
// ---------------------------------------------------------------------------

func (h *Handler) CreateAction(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "JobActionsCreateAction")
	defer span.End()
	var req models.CreateActionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	if _, ok := containsActionType(req.Type); !ok {
		respondBadRequest(c, "unsupported action type: "+req.Type)
		return
	}
	action, err := h.repo.CreateAction(ctx, h.tenantID(c), &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, action)
}

// ---------------------------------------------------------------------------
// GetAction
// ---------------------------------------------------------------------------

func (h *Handler) GetAction(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "JobActionsGetAction")
	defer span.End()
	action, err := h.exec.GetAction(ctx, h.tenantID(c), c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, action)
}

// ---------------------------------------------------------------------------
// ListActions
// ---------------------------------------------------------------------------

func (h *Handler) ListActions(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "JobActionsListActions")
	defer span.End()
	category := c.Query("category")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	resp, err := h.repo.ListActions(ctx, h.tenantID(c), category, limit, offset)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, resp)
}

// ---------------------------------------------------------------------------
// ExecuteAction
// ---------------------------------------------------------------------------

func (h *Handler) ExecuteAction(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "JobActionsExecuteAction")
	defer span.End()
	var req models.ExecuteActionRequest
	_ = c.ShouldBindJSON(&req)

	// Resolve the action name: prefer the persisted action's name; fall back
	// to using the param :id as the action type directly.
	actionName := c.Param("id")

	ex, err := h.exec.ExecuteAction(ctx, h.tenantID(c), actionName, req.Params)
	if err != nil {
		if errors.Is(err, service.ErrActionNotFound) {
			respondNotFound(c, err.Error())
			return
		}
		if errors.Is(err, service.ErrHandlerNotFound) {
			respondBadRequest(c, err.Error())
			return
		}
		if errors.Is(err, service.ErrActionDisabled) {
			respondNotFound(c, err.Error())
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, ex)
}

// ---------------------------------------------------------------------------
// GetHistory
// ---------------------------------------------------------------------------

func (h *Handler) GetHistory(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "JobActionsGetHistory")
	defer span.End()
	actionID := c.Param("id")
	// Verify action belongs to tenant
	if _, terr := h.repo.GetAction(ctx, h.tenantID(c), actionID); terr != nil {
		respondNotFound(c, terr.Error())
		return
	}
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	resp, err := h.repo.ListHistory(ctx, actionID, limit, offset)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, resp)
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

func containsActionType(t string) (map[string]struct{}, bool) {
	registry := make(map[string]struct{})
	for _, typ := range models.AllActionTypes {
		registry[typ] = struct{}{}
	}
	_, ok := registry[t]
	return registry, ok
}
