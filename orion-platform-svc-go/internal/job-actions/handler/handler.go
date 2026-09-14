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
	if !containsActionType(req.Type) {
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
	// A malformed body is a caller error, not a missing-params request. The
	// bind result used to be discarded with "_ =", so "paramas: oops" silently
	// executed with no params at all and the audit row recorded success.
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, "invalid execute request: "+err.Error())
		return
	}

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
		// The executor recorded this execution as 'failed' before returning.
		// 501 says "the server cannot do this" rather than 500 "something broke",
		// which is what a caller reading the error needs to know.
		if errors.Is(err, service.ErrActionNotImplemented) {
			respondNotImplemented(c, err.Error())
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
	tenant := h.tenantID(c)
	// The owner check is the tenancy gate for this endpoint; ListHistory also
	// scopes by tenant itself, so the audit table cannot be probed by id guess.
	if _, terr := h.repo.GetAction(ctx, tenant, actionID); terr != nil {
		respondNotFound(c, terr.Error())
		return
	}
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	resp, err := h.repo.ListHistory(ctx, tenant, actionID, limit, offset)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, resp)
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

// allActionTypes is built once. The previous version allocated a fresh map on
// every call and returned it to the caller, which discarded it.
var allActionTypes = func() map[string]struct{} {
	set := make(map[string]struct{}, len(models.AllActionTypes))
	for _, typ := range models.AllActionTypes {
		set[typ] = struct{}{}
	}
	return set
}()

func containsActionType(t string) bool {
	_, ok := allActionTypes[t]
	return ok
}
