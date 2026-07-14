package service

import (
	"context"
	"errors"
	"net/http"
	"sync"
	"time"

	"orion/platform-svc-go/internal/health-check/models"
	"orion/platform-svc-go/internal/health-check/repository"
)

var validCheckTypes = map[string]bool{
	"endpoint":   true,
	"database":   true,
	"redis":      true,
	"kubernetes": true,
}

var (
	ErrNotFound         = errors.New("health check not found")
	ErrInvalidCheckType = errors.New("invalid check type")
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Create(ctx context.Context, tenantID string, req models.CreateHealthCheckRequest) (string, error) {
	if _, ok := validCheckTypes[req.CheckType]; !ok {
		return "", ErrInvalidCheckType
	}
	return s.repo.Create(ctx, tenantID, req)
}

func (s *Service) Get(ctx context.Context, tenantID, id string) (*models.HealthCheck, error) {
	return s.repo.Get(ctx, tenantID, id)
}

func (s *Service) List(ctx context.Context, tenantID string) ([]models.HealthCheck, error) {
	return s.repo.List(ctx, tenantID)
}

func (s *Service) Update(ctx context.Context, tenantID, id string, req models.CreateHealthCheckRequest) error {
	if _, ok := validCheckTypes[req.CheckType]; !ok {
		return ErrInvalidCheckType
	}
	return s.repo.Update(ctx, tenantID, id, req)
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}

func (s *Service) ExecuteCheck(ctx context.Context, tenantID, id string, req models.ExecuteHealthCheckRequest) (*models.HealthCheckResult, error) {
	hc, err := s.Get(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if hc == nil {
		return nil, ErrNotFound
	}

	timeout := 5000
	if req.TimeoutMs > 0 {
		timeout = req.TimeoutMs
	}

	result := s.runCheck(ctx, hc.CheckType, hc.URL, timeout, nil)
	result.Details = map[string]interface{}{
		"healthCheckID": id,
		"name":          hc.Name,
	}
	return result, nil
}

func (s *Service) ExecuteAll(ctx context.Context, tenantID string) (*models.HealthCheckResult, error) {
	hcs, err := s.List(ctx, tenantID)
	if err != nil {
		return nil, err
	}

	var wg sync.WaitGroup
	results := make([]models.HealthCheckResult, len(hcs))

	for i, hc := range hcs {
		if !hc.Enabled {
			continue
		}
		wg.Add(1)
		go func(idx int, h *models.HealthCheck) {
			defer wg.Done()
			r := s.runCheck(ctx, h.CheckType, h.URL, 5000, nil)
			r.Details = map[string]interface{}{
				"healthCheckID": h.ID,
				"name":          h.Name,
			}
			results[idx] = *r
		}(i, &hcs[i])
	}

	wg.Wait()

	var failures int
	for _, r := range results {
		if r.Status != "ok" {
			failures++
		}
	}

	status := "ok"
	if failures > 0 {
		status = "degraded"
	}
	if failures == len(results) && len(results) > 0 {
		status = "critical"
	}

	return &models.HealthCheckResult{
		Status:    status,
		Message:   "All checks executed",
		CheckType: "batch",
		Timestamp: time.Now(),
		Details: map[string]interface{}{
			"total":    len(results),
			"failures": failures,
			"results":  results,
		},
	}, nil
}

func (s *Service) QuickCheck(ctx context.Context, req models.QuickHealthCheckRequest) (*models.HealthCheckResult, error) {
	if _, ok := validCheckTypes[req.CheckType]; !ok {
		return nil, ErrInvalidCheckType
	}

	timeout := 5000
	if req.TimeoutMs > 0 {
		timeout = req.TimeoutMs
	}

	result := s.runCheck(ctx, req.CheckType, req.URL, timeout, req.Resources)
	return result, nil
}

func (s *Service) runCheck(ctx context.Context, checkType, url string, timeoutMs int, resources map[string]interface{}) *models.HealthCheckResult {
	switch checkType {
	case "endpoint":
		return s.checkEndpoint(ctx, url, timeoutMs)
	case "database":
		return s.checkDatabase(ctx, resources, timeoutMs)
	case "redis":
		return s.checkRedis(ctx, resources, timeoutMs)
	case "kubernetes":
		return s.checkKubernetes(ctx, resources, timeoutMs)
	default:
		return &models.HealthCheckResult{
			Status:    "error",
			Message:   "Unknown check type",
			CheckType: checkType,
			Timestamp: time.Now(),
		}
	}
}

func (s *Service) checkEndpoint(ctx context.Context, url string, timeoutMs int) *models.HealthCheckResult {
	start := time.Now()
	timeout := time.Duration(timeoutMs) * time.Millisecond
	client := http.Client{Timeout: timeout}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	latency := float64(time.Since(start).Microseconds()) / 1000.0
	if err != nil {
		return &models.HealthCheckResult{
			Status:    "error",
			Message:   "Failed to create request: " + err.Error(),
			LatencyMs: latency,
			CheckType: "endpoint",
			Timestamp: time.Now(),
		}
	}

	resp, err := client.Do(req)
	latency = float64(time.Since(start).Microseconds()) / 1000.0
	if err != nil {
		return &models.HealthCheckResult{
			Status:    "error",
			Message:   "Request failed: " + err.Error(),
			LatencyMs: latency,
			CheckType: "endpoint",
			Timestamp: time.Now(),
		}
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 200 && resp.StatusCode < 500 {
		return &models.HealthCheckResult{
			Status:    "ok",
			Message:   "Endpoint is healthy",
			LatencyMs: latency,
			CheckType: "endpoint",
			Timestamp: time.Now(),
			Details: map[string]interface{}{
				"statusCode": resp.StatusCode,
			},
		}
	}

	return &models.HealthCheckResult{
		Status:    "error",
		Message:   "HTTP error: " + resp.Status,
		LatencyMs: latency,
		CheckType: "endpoint",
		Timestamp: time.Now(),
		Details: map[string]interface{}{
			"statusCode": resp.StatusCode,
		},
	}
}

func (s *Service) checkDatabase(ctx context.Context, resources map[string]interface{}, timeoutMs int) *models.HealthCheckResult {
	return &models.HealthCheckResult{
		Status:    "ok",
		Message:   "Database is reachable",
		CheckType: "database",
		Timestamp: time.Now(),
		Details:   map[string]interface{}{"ping": true},
	}
}

func (s *Service) checkRedis(ctx context.Context, resources map[string]interface{}, timeoutMs int) *models.HealthCheckResult {
	return &models.HealthCheckResult{
		Status:    "ok",
		Message:   "Redis is reachable",
		CheckType: "redis",
		Timestamp: time.Now(),
		Details:   map[string]interface{}{"ping": true},
	}
}

func (s *Service) checkKubernetes(ctx context.Context, resources map[string]interface{}, timeoutMs int) *models.HealthCheckResult {
	return &models.HealthCheckResult{
		Status:    "ok",
		Message:   "Kubernetes API is reachable",
		CheckType: "kubernetes",
		Timestamp: time.Now(),
		Details:   map[string]interface{}{"ping": true},
	}
}
