package handler

import (
	"context"
	"net/http"
	stderrors "errors"
	"orion/platform-svc-go/internal/middleware"

	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/errors"
	"orion/platform-svc-go/internal/pipeline-error-detail/models"
	"orion/platform-svc-go/internal/pipeline-error-detail/service"

	"github.com/gin-gonic/gin"
)

// Service defines the contract the handler needs from the service layer.
type Service interface {
	GetErrorDetail(ctx context.Context, runID string) (*models.PipelineErrorDetail, error)
}

type Handler struct {
	svc Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes mounts all pipeline-error-detail routes.
// Mirrors /api/v1/pipelines/:runId/error-detail from the TS source (1 endpoint).
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	// GET /pipelines/:runId/error-detail — Returns classified error info for a failed run
	rg.GET("/pipelines/:runId/error-detail",
		auth.RequirePermission("pipeline-error-detail", "read"),
		h.ErrorDetail)
}

// ErrorDetail handles GET /pipelines/:runId/error-detail.
func (h *Handler) ErrorDetail(c *gin.Context) {
	ctx := context.Background()
	runID := c.Param("runId")

	detail, err := h.svc.GetErrorDetail(ctx, runID)
	if err != nil {
		if stderrors.Is(err, service.ErrInvalidRun) {
			middleware.RespondBadRequest(c, err.Error())
			return
		}
		if stderrors.Is(err, service.ErrRunNotFound) {
			middleware.RespondNotFound(c, "pipeline run not found")
			return
		}
		if stderrors.Is(err, service.ErrNotFailed) {
			middleware.RespondBadRequest(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}

	middleware.RespondSuccess(c, detail)
}

// respondSuccess writes a canonical success envelope.
func respondSuccess(c *gin.Context, data any) {
	errors.WriteSuccess(c, data)
}

// respondBadRequest writes a canonical BAD_REQUEST error envelope.
func respondBadRequest(c *gin.Context, message string) {
	errors.WriteError(c, errors.ErrBadRequest, message, http.StatusBadRequest)
}

// respondNotFound writes a canonical NOT_FOUND error envelope.
func respondNotFound(c *gin.Context, message string) {
	errors.WriteError(c, errors.ErrNotFound, message, http.StatusNotFound)
}

// respondInternalError writes a canonical INTERNAL_ERROR envelope.
func respondInternalError(c *gin.Context, message string) {
	errors.WriteError(c, errors.ErrInternal, message, http.StatusInternalServerError)
}
