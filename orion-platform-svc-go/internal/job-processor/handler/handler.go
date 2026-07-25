// Package handler exposes the Job Operation Processor over REST.
package handler

import (
	"errors"
	"strconv"

	"orion/go-common/pkg/auth"

	"orion/platform-svc-go/internal/job-processor/models"
	"orion/platform-svc-go/internal/job-processor/processor"
	"orion/platform-svc-go/internal/job-processor/repository"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	proc *processor.Processor
	repo *repository.Repository
}

func NewHandler(proc *processor.Processor, repo *repository.Repository) *Handler {
	return &Handler{proc: proc, repo: repo}
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
	op, err := h.proc.Process(c.Request.Context(), h.tenantID(c), &req, chainID)
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
	chain, err := h.proc.ProcessChain(c.Request.Context(), h.tenantID(c), &req)
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
	op, err := h.proc.GetOperation(c.Request.Context(), h.tenantID(c), c.Param("id"))
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
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
	resp, err := h.proc.ListOperations(c.Request.Context(), h.tenantID(c), chainID, limit, offset)
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
	resp, err := h.repo.ListChains(c.Request.Context(), h.tenantID(c), limit, offset)
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
	chain, err := h.proc.CancelChain(c.Request.Context(), h.tenantID(c), c.Param("id"))
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
	if errors.Is(err, processor.ErrUnknownOperationType) ||
		errors.Is(err, processor.ErrInvalidStatus) {
		respondBadRequest(c, err.Error())
		return
	}
	if errors.Is(err, processor.ErrChainNotFound) ||
		errors.Is(err, repository.ErrNotFound) {
		respondNotFound(c, err.Error())
		return
	}
	respondInternalError(c, err.Error())
}
