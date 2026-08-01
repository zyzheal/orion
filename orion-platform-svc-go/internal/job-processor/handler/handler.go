// Package handler provides HTTP handlers for job-processor,
// delegating all business logic to the service layer.
//
// ARCHITECTURE (Clean Architecture):
//   Handler (thin, gin) → Service → Processor + Repository
//
// The handler is responsible ONLY for: HTTP binding, response formatting,
// error mapping, and routing. All orchestration lives in the service layer.
package handler

import (
	stderrors "errors"
	"strconv"

	"orion/go-common/pkg/auth"

	"orion/platform-svc-go/internal/job-processor/models"
	"orion/platform-svc-go/internal/job-processor/processor"
	"orion/platform-svc-go/internal/job-processor/repository"
	"orion/platform-svc-go/internal/job-processor/service"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	jobs := rg.Group("/job-operations")
	jobs.POST("", auth.RequirePermission("job-operations", "write"), h.Process)
	jobs.POST("/chain", auth.RequirePermission("job-operations", "write"), h.ProcessChain)
	jobs.GET("/:id", auth.RequirePermission("job-operations", "read"), h.GetOperation)
	jobs.GET("", auth.RequirePermission("job-operations", "read"), h.ListOperations)
	jobs.GET("/chains", auth.RequirePermission("job-operations", "read"), h.ListChains)
	jobs.POST("/chains/:id/cancel", auth.RequirePermission("job-operations", "write"), h.CancelChain)
}

func (h *Handler) tenantID(c *gin.Context) string {
	return c.GetString("tenant_id")
}

// ---------------------------------------------------------------------------
// Process — create and execute a single operation
// ---------------------------------------------------------------------------

func (h *Handler) Process(c *gin.Context) {
	var req models.CreateOperationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	chainID := c.Query("chain_id")
	op, err := h.svc.Process(c.Request.Context(), h.tenantID(c), &req, chainID)
	if err != nil {
		respondError(c, err)
		return
	}
	respondCreated(c, op)
}

// ---------------------------------------------------------------------------
// ProcessChain — create and execute a chain of operations
// ---------------------------------------------------------------------------

func (h *Handler) ProcessChain(c *gin.Context) {
	var req models.CreateChainRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	chain, err := h.svc.ProcessChain(c.Request.Context(), h.tenantID(c), &req)
	if err != nil {
		respondError(c, err)
		return
	}
	respondCreated(c, chain)
}

// ---------------------------------------------------------------------------
// GetOperation
// ---------------------------------------------------------------------------

func (h *Handler) GetOperation(c *gin.Context) {
	op, err := h.svc.GetOperation(c.Request.Context(), h.tenantID(c), c.Param("id"))
	if err != nil {
		if stderrors.Is(err, repository.ErrNotFound) {
			respondNotFound(c, err.Error())
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, op)
}

// ---------------------------------------------------------------------------
// ListOperations
// ---------------------------------------------------------------------------

func (h *Handler) ListOperations(c *gin.Context) {
	chainID := c.Query("chain_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	resp, err := h.svc.ListOperations(c.Request.Context(), h.tenantID(c), chainID, limit, offset)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, resp)
}

// ---------------------------------------------------------------------------
// ListChains
// ---------------------------------------------------------------------------

func (h *Handler) ListChains(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	resp, err := h.svc.ListChains(c.Request.Context(), h.tenantID(c), limit, offset)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, resp)
}

// ---------------------------------------------------------------------------
// CancelChain
// ---------------------------------------------------------------------------

func (h *Handler) CancelChain(c *gin.Context) {
	chain, err := h.svc.CancelChain(c.Request.Context(), h.tenantID(c), c.Param("id"))
	if err != nil {
		respondError(c, err)
		return
	}
	respondSuccess(c, chain)
}

// ---------------------------------------------------------------------------
// response helpers
// ---------------------------------------------------------------------------

func respondError(c *gin.Context, err error) {
	// Map known processor errors to appropriate HTTP statuses
	if stderrors.Is(err, processor.ErrUnknownOperationType) ||
		stderrors.Is(err, processor.ErrInvalidStatus) {
		respondBadRequest(c, err.Error())
		return
	}
	if stderrors.Is(err, processor.ErrChainNotFound) ||
		stderrors.Is(err, repository.ErrNotFound) {
		respondNotFound(c, err.Error())
		return
	}
	respondInternalError(c, err.Error())
}
