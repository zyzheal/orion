// Package handler exposes the job-actions executor over REST.
package handler

import (
	"errors"
	"strconv"

	"orion/go-common/pkg/auth"

	"orion/platform-svc-go/internal/job-actions/models"
	"orion/platform-svc-go/internal/job-actions/repository"
	"orion/platform-svc-go/internal/job-actions/service"

	"github.com/gin-gonic/gin"
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
	var req models.CreateActionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	if _, ok := containsActionType(req.Type); !ok {
		respondBadRequest(c, "unsupported action type: "+req.Type)
		return
	}
	action, err := h.repo.CreateAction(c.Request.Context(), h.tenantID(c), &req)
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
	action, err := h.exec.GetAction(c.Request.Context(), h.tenantID(c), c.Param("id"))
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
	category := c.Query("category")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	resp, err := h.repo.ListActions(c.Request.Context(), h.tenantID(c), category, limit, offset)
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
	var req models.ExecuteActionRequest
	_ = c.ShouldBindJSON(&req)

	// Resolve the action name: prefer the persisted action's name; fall back
	// to using the param :id as the action type directly.
	actionName := c.Param("id")

	ex, err := h.exec.ExecuteAction(c.Request.Context(), h.tenantID(c), actionName, req.Params)
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
	actionID := c.Param("id")
	// Verify action belongs to tenant
	if _, terr := h.repo.GetAction(c.Request.Context(), h.tenantID(c), actionID); terr != nil {
		respondNotFound(c, terr.Error())
		return
	}
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	resp, err := h.repo.ListHistory(c.Request.Context(), actionID, limit, offset)
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
