package datasource

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// GraphQLSource implements DataSource for GraphQL endpoints.
type GraphQLSource struct {
	cfg    *DataSourceConfig
	client *http.Client
}

// GraphQLRequest represents a GraphQL request body.
type GraphQLRequest struct {
	Query     string                 `json:"query"`
	Variables map[string]interface{} `json:"variables,omitempty"`
}

// NewGraphQLSource creates a new GraphQLSource from config.
func NewGraphQLSource(cfg *DataSourceConfig) (*GraphQLSource, error) {
	if cfg == nil {
		return nil, fmt.Errorf("datasource config is nil")
	}
	timeout := 30 * time.Second
	if cfg.Timeout > 0 {
		timeout = cfg.Timeout
	}
	return &GraphQLSource{
		cfg: cfg,
		client: &http.Client{
			Timeout: timeout,
		},
	}, nil
}

// Type returns the data source type.
func (g *GraphQLSource) Type() DataSourceType {
	return TypeGraphQL
}

// Connect performs a lightweight connectivity check.
func (g *GraphQLSource) Connect(ctx context.Context) error {
	url := g.getURL()
	payload, err := json.Marshal(GraphQLRequest{Query: "{ __typename }"})
	if err != nil {
		return fmt.Errorf("failed to build connect payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewBuffer(payload))
	if err != nil {
		return fmt.Errorf("failed to build connect request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	g.applyHeaders(req)

	resp, err := g.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to connect to graphql endpoint: %w", err)
	}
	resp.Body.Close()

	if resp.StatusCode >= 500 {
		return fmt.Errorf("graphql endpoint returned server error: %d", resp.StatusCode)
	}
	return nil
}

// Close releases resources.
func (g *GraphQLSource) Close() error {
	return nil
}

// Execute runs a GraphQL query.
func (g *GraphQLSource) Execute(ctx context.Context, query string, params map[string]interface{}) (*QueryResult, error) {
	if query == "" {
		return nil, fmt.Errorf("graphql query is required")
	}

	variables := make(map[string]interface{})
	for k, v := range params {
		variables[k] = v
	}

	payload, err := json.Marshal(GraphQLRequest{
		Query:     query,
		Variables: variables,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to encode graphql request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, g.getURL(), bytes.NewBuffer(payload))
	if err != nil {
		return nil, fmt.Errorf("failed to build graphql request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	g.applyHeaders(req)

	resp, err := g.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to execute graphql request: %w", err)
	}
	defer resp.Body.Close()

	var data map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, fmt.Errorf("failed to decode graphql response: %w", err)
	}

	result := &QueryResult{Fields: []string{"key", "value"}}
	total := 0
	for key, val := range data {
		result.Rows = append(result.Rows, []interface{}{key, val})
		total++
	}
	result.Total = total

	return result, nil
}

// Health checks the GraphQL endpoint health.
func (g *GraphQLSource) Health(ctx context.Context) (bool, error) {
	url := g.getURL()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return false, fmt.Errorf("failed to build health request: %w", err)
	}
	resp, err := g.client.Do(req)
	if err != nil {
		return false, fmt.Errorf("graphql health check failed: %w", err)
	}
	resp.Body.Close()
	return resp.StatusCode < 500, nil
}

// -- Private helpers --------------------------------------------------

func (g *GraphQLSource) getURL() string {
	if v, ok := g.cfg.Config["base_url"]; ok && v != "" {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return "http://localhost:8080/graphql"
}

func (g *GraphQLSource) applyHeaders(req *http.Request) {
	if auth, ok := g.cfg.Config["auth_token"]; ok && auth != "" {
		if s, ok := auth.(string); ok && s != "" {
			req.Header.Set("Authorization", "Bearer "+s)
		}
	}
	if v, ok := g.cfg.Config["headers"]; ok {
		if mp, ok := v.(map[string]interface{}); ok {
			for k, vv := range mp {
				if s, ok := vv.(string); ok {
					req.Header.Set(k, s)
				}
			}
		}
	}
}
