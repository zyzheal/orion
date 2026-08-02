package handler

import (
	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/errors"
	"orion/platform-svc-go/internal/ai/inference/models"
	"orion/platform-svc-go/internal/ai/inference/service"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
)

// Handler exposes the AI inference proxy's HTTP endpoints.
type Handler struct {
	svc *service.PythonInferenceService
}

// NewHandler creates a new Handler bound to the AI inference proxy service.
func NewHandler(svc *service.PythonInferenceService) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all AI inference endpoints under the given group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	r := rg.Group("/ai-inference")

	// Health check
	r.GET("/health", h.Health)

	// Inference endpoints
	r.POST("/classify", auth.RequirePermission("ai_inference", "write"), h.ClassifyImage)
	r.POST("/embedding", auth.RequirePermission("ai_inference", "write"), h.TextEmbedding)
	r.POST("/anomaly", auth.RequirePermission("ai_inference", "write"), h.AnomalyDetection)

	// Decision endpoints
	r.POST("/decision", auth.RequirePermission("ai_inference", "write"), h.MakeDecision)
	r.POST("/predict-deployment", auth.RequirePermission("ai_inference", "write"), h.PredictDeployment)
	r.POST("/predict-incident", auth.RequirePermission("ai_inference", "write"), h.PredictIncident)
}

// healthResponse wraps the AI service health status with a fallback-friendly shape.
type healthResponse struct {
	Available      bool   `json:"available"`
	TorchAvailable bool   `json:"torch_available"`
	Error          string `json:"error,omitempty"`
}

// Health checks if the Python AI service is reachable.
func (h *Handler) Health(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Health")
	defer span.End()

	status, err := h.svc.Health(ctx)
	if err != nil {
		// Health itself failing is not a caller error — return Available=false.
		if status != nil {
			errors.WriteSuccess(c, &healthResponse{
				Available:      status.Available,
				TorchAvailable: status.TorchAvailable,
				Error:          status.Error,
			})
		} else {
			errors.WriteSuccess(c, &healthResponse{Available: false, Error: err.Error()})
		}
		return
	}
	errors.WriteSuccess(c, &healthResponse{
		Available:      status.Available,
		TorchAvailable: status.TorchAvailable,
		Error:          status.Error,
	})
}

// ClassifyImage proxies an image classification request.
func (h *Handler) ClassifyImage(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ClassifyImage")
	defer span.End()

	var req models.InferenceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	if req.Model == "" {
		errors.WriteError(c, errors.ErrBadRequest, "model is required", 400)
		return
	}
	if req.ImageData == nil {
		errors.WriteError(c, errors.ErrBadRequest, "imageData is required", 400)
		return
	}

	result, err := h.svc.ClassifyImage(ctx, &req)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 502)
		return
	}
	errors.WriteSuccess(c, result)
}

// TextEmbedding proxies a text embedding request.
func (h *Handler) TextEmbedding(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TextEmbedding")
	defer span.End()

	var body struct {
		Text string `json:"text" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}

	result, err := h.svc.TextEmbedding(ctx, body.Text)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 502)
		return
	}
	errors.WriteSuccess(c, result)
}

// AnomalyDetection proxies an anomaly detection request.
func (h *Handler) AnomalyDetection(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AnomalyDetection")
	defer span.End()

	var body struct {
		DataPoints []map[string]interface{} `json:"dataPoints" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	if len(body.DataPoints) == 0 {
		errors.WriteError(c, errors.ErrBadRequest, "dataPoints must not be empty", 400)
		return
	}

	result, err := h.svc.AnomalyDetection(ctx, body.DataPoints)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 502)
		return
	}
	errors.WriteSuccess(c, result)
}

// MakeDecision proxies a decision-making request.
func (h *Handler) MakeDecision(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "MakeDecision")
	defer span.End()

	var req models.DecisionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	if req.Type == "" || req.Context == nil {
		errors.WriteError(c, errors.ErrBadRequest, "type and context are required", 400)
		return
	}

	result, err := h.svc.MakeDecision(ctx, &req)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 502)
		return
	}
	errors.WriteSuccess(c, result)
}

// PredictDeployment proxies a deployment success prediction.
func (h *Handler) PredictDeployment(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PredictDeployment")
	defer span.End()

	var body struct {
		AppMetrics map[string]interface{} `json:"appMetrics" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		// Fall back to accepting any JSON object as appMetrics.
		if err := c.ShouldBindJSON(&body.AppMetrics); err != nil {
			errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
			return
		}
	}
	if len(body.AppMetrics) == 0 {
		errors.WriteError(c, errors.ErrBadRequest, "appMetrics must not be empty", 400)
		return
	}

	result, err := h.svc.PredictDeploymentSuccess(ctx, body.AppMetrics)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 502)
		return
	}
	errors.WriteSuccess(c, result)
}

// PredictIncident proxies an incident severity prediction.
func (h *Handler) PredictIncident(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PredictIncident")
	defer span.End()

	var body struct {
		IncidentData map[string]interface{} `json:"incidentData" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		// Fall back to accepting any JSON object as incidentData.
		if err := c.ShouldBindJSON(&body.IncidentData); err != nil {
			errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
			return
		}
	}
	if len(body.IncidentData) == 0 {
		errors.WriteError(c, errors.ErrBadRequest, "incidentData must not be empty", 400)
		return
	}

	result, err := h.svc.PredictIncidentSeverity(ctx, body.IncidentData)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 502)
		return
	}
	errors.WriteSuccess(c, result)
}
