package datasource

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// PrometheusSource implements DataSource for Prometheus metrics.
type PrometheusSource struct {
	cfg    *DataSourceConfig
	client *http.Client
}

// NewPrometheusSource creates a new PrometheusSource from config.
func NewPrometheusSource(cfg *DataSourceConfig) (*PrometheusSource, error) {
	if cfg == nil {
		return nil, fmt.Errorf("datasource config is nil")
	}
	timeout := 30 * time.Second
	if cfg.Timeout > 0 {
		timeout = cfg.Timeout
	}
	return &PrometheusSource{
		cfg: cfg,
		client: &http.Client{
			Timeout: timeout,
		},
	}, nil
}

// Type returns the data source type.
func (p *PrometheusSource) Type() DataSourceType {
	return TypePrometheus
}

// Connect performs a lightweight connectivity check against Prometheus.
func (p *PrometheusSource) Connect(ctx context.Context) error {
	addr := p.getAddress()
	reqURL := fmt.Sprintf("%s/api/v1/query", addr)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return fmt.Errorf("failed to build connect request: %w", err)
	}
	resp, err := p.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to connect to prometheus: %w", err)
	}
	resp.Body.Close()

	if resp.StatusCode >= 500 {
		return fmt.Errorf("prometheus returned server error: %d", resp.StatusCode)
	}
	return nil
}

// Close releases resources (http.Client does not need explicit close).
func (p *PrometheusSource) Close() error {
	return nil
}

// Execute runs a PromQL query against Prometheus.
func (p *PrometheusSource) Execute(ctx context.Context, query string, params map[string]interface{}) (*QueryResult, error) {
	if query == "" {
		return nil, fmt.Errorf("promql query is required")
	}

	addr := p.getAddress()
	paramsMap := url.Values{}
	paramsMap.Set("query", query)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, fmt.Sprintf("%s/api/v1/query?%s", addr, paramsMap.Encode()), nil)
	if err != nil {
		return nil, fmt.Errorf("failed to build prometheus request: %w", err)
	}
	p.applyHeaders(req)

	resp, err := p.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to execute prometheus query: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 500 {
		return nil, fmt.Errorf("prometheus returned server error: %d", resp.StatusCode)
	}

	// Prometheus API returns JSON with structure:
	// {"status":"success","data":{"resultType":"vector","result":[...]}}
	var promResp struct {
		Status string `json:"status"`
		Data   struct {
			ResultType string                 `json:"resultType"`
			Result     []map[string]interface{} `json:"result"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&promResp); err != nil {
		return nil, fmt.Errorf("failed to decode prometheus response: %w", err)
	}

	if promResp.Status != "success" {
		return nil, fmt.Errorf("prometheus query failed with status: %s", promResp.Status)
	}

	result := &QueryResult{Fields: []string{"metric", "value"}}
	for _, r := range promResp.Data.Result {
		// Extract metric label map and value.
		var metricLabels string
		if metric, ok := r["metric"]; ok {
			if ml, ok := metric.(map[string]interface{}); ok {
				parts := make([]string, 0, len(ml))
				for k, v := range ml {
					parts = append(parts, fmt.Sprintf("%s=%s", k, v))
				}
				metricLabels = strings.Join(parts, " ")
			}
		}
		// Value is an array [timestamp, value].
		var val string
		if v, ok := r["value"]; ok {
			if arr, ok := v.([]interface{}); ok && len(arr) >= 2 {
				val = fmt.Sprintf("%v", arr[1])
			}
		}
		result.Rows = append(result.Rows, []interface{}{metricLabels, val})
	}

	result.Total = len(result.Rows)
	return result, nil
}

// Health checks the Prometheus endpoint health.
func (p *PrometheusSource) Health(ctx context.Context) (bool, error) {
	addr := p.getAddress()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, fmt.Sprintf("%s/-/ready", addr), nil)
	if err != nil {
		return false, fmt.Errorf("failed to build health request: %w", err)
	}
	resp, err := p.client.Do(req)
	if err != nil {
		return false, fmt.Errorf("prometheus health check failed: %w", err)
	}
	resp.Body.Close()
	return resp.StatusCode < 500, nil
}

// -- Private helpers --------------------------------------------------

func (p *PrometheusSource) getAddress() string {
	if v, ok := p.cfg.Config["address"]; ok && v != "" {
		if s, ok := v.(string); ok {
			return strings.TrimRight(s, "/")
		}
	}
	return "http://localhost:9090"
}

func (p *PrometheusSource) applyHeaders(req *http.Request) {
	if token, ok := p.cfg.Config["bearer_token"]; ok && token != "" {
		if s, ok := token.(string); ok && s != "" {
			req.Header.Set("Authorization", "Bearer "+s)
		}
	}
}
