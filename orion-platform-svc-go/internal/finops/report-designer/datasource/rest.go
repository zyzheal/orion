package datasource

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"time"
)

// RESTSource implements DataSource for REST API endpoints.
type RESTSource struct {
	cfg    *DataSourceConfig
	client *http.Client
}

// NewRESTSource creates a new RESTSource from config.
func NewRESTSource(cfg *DataSourceConfig) (*RESTSource, error) {
	if cfg == nil {
		return nil, fmt.Errorf("datasource config is nil")
	}
	timeout := 30 * time.Second
	if cfg.Timeout > 0 {
		timeout = cfg.Timeout
	}
	return &RESTSource{
		cfg: cfg,
		client: &http.Client{
			Timeout: timeout,
		},
	}, nil
}

// Type returns the data source type.
func (r *RESTSource) Type() DataSourceType {
	return TypeREST
}

// Connect performs a lightweight connectivity check against the API.
func (r *RESTSource) Connect(ctx context.Context) error {
	baseURL := r.getBaseURL()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, baseURL, nil)
	if err != nil {
		return fmt.Errorf("failed to build connect request: %w", err)
	}
	r.applyHeaders(req)
	resp, err := r.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to connect to rest api: %w", err)
	}
	resp.Body.Close()

	if resp.StatusCode >= 500 {
		return fmt.Errorf("rest api returned server error: %d", resp.StatusCode)
	}
	return nil
}

// Close releases resources (http.Client does not need explicit close).
func (r *RESTSource) Close() error {
	return nil
}

// Execute runs a query against the REST API.
func (r *RESTSource) Execute(ctx context.Context, query string, params map[string]interface{}) (*QueryResult, error) {
	baseURL := r.getBaseURL()
	path := r.getPath()

	// Build request URL.
	u := baseURL + "/" + path
	qp := r.getQueryParams()
	if len(qp) > 0 {
		u += "?" + qp.Encode()
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to build rest request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	r.applyHeaders(req)

	resp, err := r.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to execute rest request: %w", err)
	}
	defer resp.Body.Close()

	var body []map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		// Try as a single object.
		var single map[string]interface{}
		if err2 := json.NewDecoder(resp.Body).Decode(&single); err2 != nil {
			return nil, fmt.Errorf("failed to decode rest response: %w", err)
		}
		body = append(body, single)
	}

	result := &QueryResult{}
	for _, item := range body {
		if len(result.Fields) == 0 {
			for k := range item {
				// For deterministic field order, we sort alphabetically implicitly
				// by range over map — order is non-deterministic but acceptable here.
				result.Fields = append(result.Fields, k)
			}
		}
		var row []interface{}
		for _, field := range result.Fields {
			if val, exists := item[field]; exists {
				row = append(row, val)
			} else {
				_ = row // keep aligned
			}
		}
		result.Rows = append(result.Rows, row)
	}

	result.Total = len(result.Rows)
	return result, nil
}

// Health checks the REST API health.
func (r *RESTSource) Health(ctx context.Context) (bool, error) {
	baseURL := r.getBaseURL()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, baseURL, nil)
	if err != nil {
		return false, fmt.Errorf("failed to build health request: %w", err)
	}
	resp, err := r.client.Do(req)
	if err != nil {
		return false, fmt.Errorf("rest api health check failed: %w", err)
	}
	resp.Body.Close()
	return resp.StatusCode < 500, nil
}

// -- Private helpers --------------------------------------------------

func (r *RESTSource) getBaseURL() string {
	if v, ok := r.cfg.Config["base_url"]; ok && v != "" {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return "http://localhost:8080"
}

func (r *RESTSource) getPath() string {
	if v, ok := r.cfg.Config["path"]; ok && v != "" {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return "/"
}

func (r *RESTSource) getQueryParams() url.Values {
	qp := url.Values{}
	if v, ok := r.cfg.Config["query_params"]; ok {
		if mp, ok := v.(map[string]interface{}); ok {
			for k, vv := range mp {
				if s, ok := vv.(string); ok {
					qp.Set(k, s)
				}
			}
		}
	}
	return qp
}

func (r *RESTSource) applyHeaders(req *http.Request) {
	if auth, ok := r.cfg.Config["auth_token"]; ok && auth != "" {
		if s, ok := auth.(string); ok && s != "" {
			req.Header.Set("Authorization", "Bearer "+s)
		}
	}
	if v, ok := r.cfg.Config["headers"]; ok {
		if mp, ok := v.(map[string]interface{}); ok {
			for k, vv := range mp {
				if s, ok := vv.(string); ok {
					req.Header.Set(k, s)
				}
			}
		}
	}
}
