package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"orion/platform-svc-go/internal/ai-inference/models"
)

// PythonInferenceService proxies requests to the Python AI inference service.
type PythonInferenceService struct {
	baseURL string
	client  *http.Client
}

// NewPythonInferenceService creates a new proxy service.
func NewPythonInferenceService() *PythonInferenceService {
	baseURL := os.Getenv("AI_SERVICE_URL")
	if baseURL == "" {
		baseURL = "http://localhost:8000"
	}
	return &PythonInferenceService{
		baseURL: baseURL,
		client: &http.Client{
			Timeout: 60 * time.Second,
		},
	}
}

// HealthStatus represents the health status of the Python AI service.
type HealthStatus struct {
	Available      bool   `json:"available"`
	TorchAvailable bool   `json:"torch_available"`
	Error          string `json:"error,omitempty"`
}

// Health checks if the Python AI service is reachable.
// Returns Available=false (not an error) if the service is unreachable.
func (s *PythonInferenceService) Health(ctx context.Context) (*HealthStatus, error) {
	url := s.baseURL + "/api/inference/health"
	resp, err := s.doRequest(ctx, "GET", url, nil)
	if err != nil {
		return &HealthStatus{Available: false, Error: err.Error()}, nil
	}
	var health struct {
		Success bool `json:"success"`
		Data    struct {
			Status         string `json:"status"`
			TorchAvailable bool   `json:"torch_available"`
		} `json:"data"`
	}
	if err := json.Unmarshal(resp, &health); err != nil {
		return &HealthStatus{Available: false, Error: err.Error()}, nil
	}
	return &HealthStatus{
		Available:      health.Success && health.Data.Status == "healthy",
		TorchAvailable: health.Data.TorchAvailable,
	}, nil
}

// ClassifyImage proxies an image classification request.
func (s *PythonInferenceService) ClassifyImage(ctx context.Context, req *models.InferenceRequest) (*models.InferenceResponse, error) {
	payload := map[string]interface{}{
		"image":   req.ImageData,
		"model":   req.Model,
		"options": req.Options,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}
	resp, err := s.doRequest(ctx, "POST", s.baseURL+"/api/inference/classify", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	var result models.InferenceResponse
	if err := json.Unmarshal(resp, &result); err != nil {
		return nil, fmt.Errorf("unmarshal response: %w", err)
	}
	return &result, nil
}

// TextEmbedding proxies a text embedding request.
func (s *PythonInferenceService) TextEmbedding(ctx context.Context, text string) (*models.InferenceResponse, error) {
	payload := map[string]string{"text": text}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}
	resp, err := s.doRequest(ctx, "POST", s.baseURL+"/api/inference/embedding", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	var result models.InferenceResponse
	if err := json.Unmarshal(resp, &result); err != nil {
		return nil, fmt.Errorf("unmarshal response: %w", err)
	}
	return &result, nil
}

// AnomalyDetection proxies an anomaly detection request.
func (s *PythonInferenceService) AnomalyDetection(ctx context.Context, dataPoints []map[string]interface{}) (*models.InferenceResponse, error) {
	payload := map[string]interface{}{
		"data_points": dataPoints,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}
	resp, err := s.doRequest(ctx, "POST", s.baseURL+"/api/inference/anomaly", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	var result models.InferenceResponse
	if err := json.Unmarshal(resp, &result); err != nil {
		return nil, fmt.Errorf("unmarshal response: %w", err)
	}
	return &result, nil
}

// MakeDecision proxies a decision-making request.
func (s *PythonInferenceService) MakeDecision(ctx context.Context, req *models.DecisionRequest) (*models.DecisionResponse, error) {
	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}
	resp, err := s.doRequest(ctx, "POST", s.baseURL+"/api/decision/make", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	var result models.DecisionResponse
	if err := json.Unmarshal(resp, &result); err != nil {
		return nil, fmt.Errorf("unmarshal response: %w", err)
	}
	return &result, nil
}

// PredictDeploymentSuccess proxies a deployment success prediction.
func (s *PythonInferenceService) PredictDeploymentSuccess(ctx context.Context, appMetrics map[string]interface{}) (*models.DecisionResponse, error) {
	payload := map[string]interface{}{
		"context": appMetrics,
		"type":    "deployment",
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}
	resp, err := s.doRequest(ctx, "POST", s.baseURL+"/api/decision/deployment-predict", bytes.NewReader(body))
	if err != nil {
		return nil, err
		}
	var result models.DecisionResponse
	if err := json.Unmarshal(resp, &result); err != nil {
		return nil, fmt.Errorf("unmarshal response: %w", err)
	}
	return &result, nil
}

// PredictIncidentSeverity proxies an incident severity prediction.
func (s *PythonInferenceService) PredictIncidentSeverity(ctx context.Context, incidentData map[string]interface{}) (*models.DecisionResponse, error) {
	payload := map[string]interface{}{
		"context": incidentData,
		"type":    "incident",
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}
	resp, err := s.doRequest(ctx, "POST", s.baseURL+"/api/decision/incident-severity", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	var result models.DecisionResponse
	if err := json.Unmarshal(resp, &result); err != nil {
		return nil, fmt.Errorf("unmarshal response: %w", err)
	}
	return &result, nil
}

// doRequest performs an HTTP request to the Python AI service.
func (s *PythonInferenceService) doRequest(ctx context.Context, method, url string, body io.Reader) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, method, url, body)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request to AI service failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("AI service returned status %d", resp.StatusCode)
	}

	return io.ReadAll(resp.Body)
}
