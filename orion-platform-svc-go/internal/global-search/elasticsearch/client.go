// Package elasticsearch provides an Elasticsearch client wrapper that
// gracefully degrades when ES is unavailable.
package elasticsearch

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

var (
	ErrESUnavailable = errors.New("elasticsearch is unavailable")
)

// Config holds Elasticsearch connection parameters.
type Config struct {
	URL        string        // e.g. "http://localhost:9200"
	Username   string
	Password   string
	Timeout    time.Duration // default 10s
	MaxRetries int           // default 3
	RetryDelay time.Duration // default 500ms
}

// DefaultConfig creates a Config with environment defaults.
func DefaultConfig() *Config {
	return &Config{
		URL:        "http://localhost:9200",
		Timeout:    10 * time.Second,
		MaxRetries: 3,
		RetryDelay: 500 * time.Millisecond,
	}
}

// Client wraps the Elasticsearch HTTP API.
type Client struct {
	cfg     *Config
	http    *http.Client
	mu      sync.RWMutex
	healthy bool
}

// New creates an Elasticsearch client. Operations return ErrESUnavailable
// when ES is not reachable rather than panicking.
func New(cfg *Config) *Client {
	if cfg == nil {
		cfg = DefaultConfig()
	}
	if cfg.Timeout == 0 {
		cfg.Timeout = 10 * time.Second
	}
	return &Client{
		cfg: cfg,
		http: &http.Client{
			Timeout: cfg.Timeout,
		},
	}
}

// Ping checks if Elasticsearch is reachable.
func (c *Client) Ping(ctx context.Context) error {
	_, err := c.doRequest(ctx, http.MethodGet, "/", nil, nil)
	c.mu.Lock()
	defer c.mu.Unlock()
	c.healthy = err == nil
	return err
}

// IsHealthy returns whether the last ping succeeded.
func (c *Client) IsHealthy() bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.healthy
}

// CreateIndex creates an index with the given mapping.
func (c *Client) CreateIndex(ctx context.Context, index string, mapping map[string]interface{}) error {
	body := map[string]interface{}{
		"settings": map[string]interface{}{
			"number_of_shards":   1,
			"number_of_replicas": 0,
		},
		"mappings": mapping,
	}
	_, err := c.doRequest(ctx, http.MethodPut, "/"+url.PathEscape(index), body, nil)
	return err
}

// IndexDoc indexes a single document.
func (c *Client) IndexDoc(ctx context.Context, index, docID string, doc map[string]interface{}) error {
	_, err := c.doRequest(ctx, http.MethodPut, "/"+url.PathEscape(index)+"/_doc/"+url.PathEscape(docID), doc, nil)
	return err
}

// DeleteIndex removes an index.
func (c *Client) DeleteIndex(ctx context.Context, index string) error {
	_, err := c.doRequest(ctx, http.MethodDelete, "/"+url.PathEscape(index), nil, nil)
	return err
}

// Exists checks if an index exists.
func (c *Client) Exists(ctx context.Context, index string) (bool, error) {
	resp, err := c.doRequest(ctx, http.MethodHead, "/"+url.PathEscape(index), nil, nil)
	if err != nil {
		return false, err
	}
	return resp.StatusCode == http.StatusOK, nil
}

// Count returns the number of documents in an index.
func (c *Client) Count(ctx context.Context, index string) (int64, error) {
	var result struct {
		Count int64 `json:"count"`
	}
	_, err := c.doRequest(ctx, http.MethodGet, "/"+url.PathEscape(index)+"/_count", nil, &result)
	if err != nil {
		return 0, err
	}
	return result.Count, nil
}

// BulkItem is a single item result in a bulk response.
type BulkItem struct {
	ID     string `json:"_id"`
	Index  string `json:"_index"`
	Status int    `json:"status"`
}

// BulkResponse holds the result of a bulk indexing operation.
type BulkResponse struct {
	Items  []BulkItem `json:"items"`
	Errors bool       `json:"errors"`
}

// BulkIndex sends a batch of documents to the ES bulk API.
func (c *Client) BulkIndex(ctx context.Context, index string, docs []map[string]interface{}) (*BulkResponse, error) {
	var buf bytes.Buffer
	for _, doc := range docs {
		meta := fmt.Sprintf(`{"index":{"_index":"%s","_id":"%s"}}`, index, doc["id"])
		buf.WriteString(meta + "\n")
		data, _ := json.Marshal(doc)
		buf.WriteString(string(data) + "\n")
	}

	var result BulkResponse
	_, err := c.doRequestRaw(ctx, http.MethodPost, "/_bulk", bytes.NewReader(buf.Bytes()), "application/x-ndjson", &result)
	return &result, err
}

// SearchResultRaw is the raw ES search response.
type SearchResultRaw struct {
	Took int     `json:"took"`
	Hits HitsRaw `json:"hits"`
}

// HitsRaw holds the hits section.
type HitsRaw struct {
	Total map[string]interface{} `json:"total"`
	Hits  []HitRaw               `json:"hits"`
}

// HitRaw is a single ES hit.
type HitRaw struct {
	ID        string                 `json:"_id"`
	Index     string                 `json:"_index"`
	Score     float64                `json:"_score"`
	Source    map[string]interface{} `json:"_source"`
	Highlight map[string][]string    `json:"highlight"`
}

// Search executes a full-text search against the given index patterns.
func (c *Client) Search(ctx context.Context, indices []string, body map[string]interface{}) (*SearchResultRaw, error) {
	if len(indices) == 0 {
		return &SearchResultRaw{Hits: HitsRaw{Total: map[string]interface{}{"value": int64(0)}}, Took: 0}, nil
	}
	indexPattern := strings.Join(indices, ",")
	var result SearchResultRaw
	resp, err := c.doRequest(ctx, http.MethodGet, "/"+indexPattern+"/_search", body, &result)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode == http.StatusNotFound {
		return &SearchResultRaw{Hits: HitsRaw{Total: map[string]interface{}{"value": int64(0)}}, Took: 0}, nil
	}
	return &result, nil
}

// doRequest executes an HTTP request against ES and optionally unmarshals the response.
func (c *Client) doRequest(ctx context.Context, method, path string, body interface{}, resp interface{}) (*http.Response, error) {
	var reqBody []byte
	var err error
	if body != nil {
		reqBody, err = json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal request body: %w", err)
		}
	}
	return c.doRequestRaw(ctx, method, path, bytes.NewReader(reqBody), "application/json", resp)
}

func (c *Client) doRequestRaw(ctx context.Context, method, path string, body *bytes.Reader, contentType string, resp interface{}) (*http.Response, error) {
	var lastErr error
	for i := 0; i <= c.cfg.MaxRetries; i++ {
		if i > 0 {
			select {
			case <-time.After(c.cfg.RetryDelay):
			case <-ctx.Done():
				return nil, ctx.Err()
			}
		}

		urlStr := c.cfg.URL + path
		req, err := http.NewRequestWithContext(ctx, method, urlStr, bytes.NewReader([]byte{}))
		if err != nil {
			return nil, err
		}
		if body != nil {
			req.Body = io.NopCloser(body)
			req.ContentLength = int64(body.Len())
			req.Header.Set("Content-Type", contentType)
		}
		if c.cfg.Username != "" && c.cfg.Password != "" {
			req.SetBasicAuth(c.cfg.Username, c.cfg.Password)
		}

		httpResp, err := c.http.Do(req)
		if err != nil {
			// Network error — ES is unreachable
			lastErr = err
			continue
		}

		if httpResp.StatusCode >= 500 {
			b, _ := io.ReadAll(httpResp.Body)
			httpResp.Body.Close()
			msg := string(b)
			if len(msg) > 200 {
				msg = msg[:200] + "..."
			}
			lastErr = fmt.Errorf("elasticsearch error (status=%d): %s", httpResp.StatusCode, msg)
			continue
		}
		if httpResp.StatusCode == http.StatusServiceUnavailable {
			httpResp.Body.Close()
			lastErr = ErrESUnavailable
			// 503 is not always transient; try one more time
			continue
		}

		b, _ := io.ReadAll(httpResp.Body)
		httpResp.Body.Close()

		if resp != nil && len(b) > 0 {
			if err := json.Unmarshal(b, resp); err != nil {
				return httpResp, fmt.Errorf("failed to unmarshal response: %w", err)
			}
		}

		return httpResp, nil
	}
	return nil, lastErr
}
