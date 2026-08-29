package handler

import (
	"context"
	stderrors "errors"
	"net/http"
	"orion/platform-svc-go/internal/middleware"

	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/errors"
	"orion/platform-svc-go/internal/pipeline-error-detail/models"
	"orion/platform-svc-go/internal/pipeline-error-detail/service"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
)

// Service defines the contract the handler needs from the service layer.
type Service interface {
	GetErrorDetail(ctx context.Context, runID string) (*models.PipelineErrorDetail, error)
}

type Handler struct {
	svc Service
}

func NewHandler(svc service.ServiceInterface) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes mounts all pipeline-error-detail routes.
// Mirrors /api/v1/pipelines/:id/error-detail from the TS source (1 endpoint).
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	// GET /pipelines/:id/error-detail — Returns classified error info for a failed run
	rg.GET("/pipelines/:id/error-detail",
		auth.RequirePermission("pipeline-error-detail", "read"),
		h.ErrorDetail)
}

// ErrorDetail handles GET /pipelines/:id/error-detail.
func (h *Handler) ErrorDetail(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ErrorDetail")
	defer span.End()
	ctx = middleware.TimeoutContext(c)
	runID := c.Param("id")

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
