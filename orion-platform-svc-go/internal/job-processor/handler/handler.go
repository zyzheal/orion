package handler

import (
	stderrors "errors"
	"go.opentelemetry.io/otel"
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/job-processor/models"
	"orion/platform-svc-go/internal/job-processor/processor"
	"orion/platform-svc-go/internal/job-processor/repository"
	"orion/platform-svc-go/internal/job-processor/service"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc service.ServiceInterface
}

func NewHandler(svc service.ServiceInterface) *Handler {
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

func (h *Handler) Process(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ProcessJobOperation")
	defer span.End()
	var req models.CreateOperationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	chainID := c.Query("chain_id")
	op, err := h.svc.Process(ctx, h.tenantID(c), &req, chainID)
	if err != nil {
		respondError(c, err)
		return
	}
	respondCreated(c, op)
}

func (h *Handler) ProcessChain(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ProcessJobChain")
	defer span.End()
	var req models.CreateChainRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	chain, err := h.svc.ProcessChain(ctx, h.tenantID(c), &req)
	if err != nil {
		respondError(c, err)
		return
	}
	respondCreated(c, chain)
}

func (h *Handler) GetOperation(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetJobOperation")
	defer span.End()
	op, err := h.svc.GetOperation(ctx, h.tenantID(c), c.Param("id"))
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

func (h *Handler) ListOperations(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListJobOperations")
	defer span.End()
	chainID := c.Query("chain_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	resp, err := h.svc.ListOperations(ctx, h.tenantID(c), chainID, limit, offset)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, resp)
}

func (h *Handler) ListChains(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListJobChains")
	defer span.End()
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	resp, err := h.svc.ListChains(ctx, h.tenantID(c), limit, offset)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, resp)
}

func (h *Handler) CancelChain(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CancelJobChain")
	defer span.End()
	chain, err := h.svc.CancelChain(ctx, h.tenantID(c), c.Param("id"))
	if err != nil {
		respondError(c, err)
		return
	}
	respondSuccess(c, chain)
}

func respondError(c *gin.Context, err error) {
	if stderrors.Is(err, processor.ErrUnknownOperationType) || stderrors.Is(err, processor.ErrInvalidStatus) {
		respondBadRequest(c, err.Error())
		return
	}
	if stderrors.Is(err, processor.ErrChainNotFound) || stderrors.Is(err, repository.ErrNotFound) {
		respondNotFound(c, err.Error())
		return
	}
	respondInternalError(c, err.Error())
}
