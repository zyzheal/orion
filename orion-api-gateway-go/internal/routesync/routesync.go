// Package routesync provides dynamic route synchronization from the platform service.
//
// It fetches enabled sub-app configurations from the platform service and registers
// reverse proxy routes automatically. Supports periodic sync to handle config changes.
//
// Workflow:
//  1. On startup, fetch /api/v1/subapps/enabled from platform service
//  2. For each sub-app with api_domain, find the matching upstream URL
//  3. Register proxy routes for each api_path prefix
//  4. Periodically re-sync (default 60s) to pick up config changes
package routesync

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// SubAppConfig mirrors the platform service sub-app configuration.
type SubAppConfig struct {
	ID         string   `json:"id"`
	Name       string   `json:"name"`
	Key        string   `json:"key"`
	APIDomain  string   `json:"api_domain"`
	APIPaths   []string `json:"api_paths"`
	Status     string   `json:"status"`
}

type platformResponse struct {
	Success bool            `json:"success"`
	Data    []SubAppConfig  `json:"data"`
}

// DomainServiceMap maps api_domain values to upstream service URLs.
type DomainServiceMap map[string]string

// DefaultAPIPathMap provides fallback API paths when sub-app doesn't specify api_paths.
var DefaultAPIPathMap = map[string][]string{
	"knowledge": {
		"/api/v1/knowledge_base", "/api/v1/knowledge", "/api/v1/nav",
		"/api/v1/node", "/api/v1/user", "/api/v1/model", "/api/v1/stat",
		"/api/v1/app", "/api/v1/file", "/api/v1/conversation", "/api/v1/comment",
		"/api/v1/crawler", "/api/v1/setting", "/api/v1/license", "/api/v1/share",
		"/api/v1/health", "/share", "/static-file",
	},
}

// Syncer handles dynamic route synchronization.
type Syncer struct {
	platformURL  string
	domainMap    DomainServiceMap
	registered   map[string]bool
	mu           sync.RWMutex
	logger       *zap.Logger
	httpClient   *http.Client
}

// NewSyncer creates a new route syncer.
func NewSyncer(platformURL string, domainMap DomainServiceMap, logger *zap.Logger) *Syncer {
	return &Syncer{
		platformURL: platformURL,
		domainMap:   domainMap,
		registered:  make(map[string]bool),
		logger:      logger,
		httpClient: &http.Client{
			Timeout: 5 * time.Second,
		},
	}
}

// GetRegisteredPrefixes returns a copy of all registered sub-app route prefixes.
func (s *Syncer) GetRegisteredPrefixes() []string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	prefixes := make([]string, 0, len(s.registered))
	for p := range s.registered {
		prefixes = append(prefixes, p)
	}
	return prefixes
}

// IsRegistered checks if a path prefix is a registered sub-app route.
func (s *Syncer) IsRegistered(prefix string) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.registered[prefix]
}

// fetchEnabledSubApps retrieves enabled sub-apps from the platform service.
func (s *Syncer) fetchEnabledSubApps(ctx context.Context) ([]SubAppConfig, error) {
	reqURL := fmt.Sprintf("%s/api/v1/subapps/enabled", s.platformURL)
	req, err := http.NewRequestWithContext(ctx, "GET", reqURL, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch subapps: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("platform returned %d", resp.StatusCode)
	}

	var result platformResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}
	if !result.Success {
		return nil, fmt.Errorf("platform returned unsuccessful response")
	}
	return result.Data, nil
}

// getAPIPaths returns the API paths for a sub-app, preferring configured api_paths.
func (s *Syncer) getAPIPaths(subApp SubAppConfig) []string {
	if len(subApp.APIPaths) > 0 {
		return subApp.APIPaths
	}
	if subApp.APIDomain != "" {
		if paths, ok := DefaultAPIPathMap[subApp.APIDomain]; ok {
			return paths
		}
	}
	return nil
}

// RegisterRoutes registers proxy routes for a sub-app on the given Gin engine.
// Returns the number of newly registered routes.
func (s *Syncer) RegisterRoutes(r *gin.Engine, subApp SubAppConfig) int {
	if subApp.APIDomain == "" {
		return 0
	}

	upstream, ok := s.domainMap[subApp.APIDomain]
	if !ok {
		s.logger.Warn("no service mapping for api_domain",
			zap.String("domain", subApp.APIDomain),
			zap.String("key", subApp.Key),
		)
		return 0
	}

	apiPaths := s.getAPIPaths(subApp)
	if len(apiPaths) == 0 {
		return 0
	}

	target, err := url.Parse(upstream)
	if err != nil {
		s.logger.Error("invalid upstream URL", zap.String("url", upstream), zap.Error(err))
		return 0
	}

	proxy := httputil.NewSingleHostReverseProxy(target)
	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		s.logger.Error("proxy error", zap.String("path", r.URL.Path), zap.Error(err))
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadGateway)
		w.Write([]byte(`{"code":502,"message":"upstream service unavailable"}`))
	}

	count := 0
	s.mu.Lock()
	for _, prefix := range apiPaths {
		if s.registered[prefix] {
			continue
		}
		s.registered[prefix] = true
		// Capture prefix for closure
		p := prefix
		r.Any(p+"/*path", func(c *gin.Context) {
			path := c.Param("path")
			c.Request.URL.Path = p + path

			// Forward tenant ID
			if tid, exists := c.Get("tenant_id"); exists {
				if s, ok := tid.(string); ok && s != "" {
					c.Request.Header.Set("X-Tenant-ID", s)
				}
			}
			// Forward request ID
			if reqID := c.GetString("request_id"); reqID != "" {
				c.Request.Header.Set("X-Request-ID", reqID)
			}

			proxy.ServeHTTP(c.Writer, c.Request)
		})
		count++
		s.logger.Info("registered dynamic route",
			zap.String("prefix", p),
			zap.String("upstream", upstream),
			zap.String("key", subApp.Key),
		)
	}
	s.mu.Unlock()

	return count
}

// SyncOnce performs a single route synchronization cycle.
func (s *Syncer) SyncOnce(ctx context.Context, r *gin.Engine) int {
	subApps, err := s.fetchEnabledSubApps(ctx)
	if err != nil {
		s.logger.Warn("failed to fetch subapps", zap.Error(err))
		return 0
	}

	total := 0
	for _, app := range subApps {
		if app.Status == "enabled" {
			total += s.RegisterRoutes(r, app)
		}
	}

	if total > 0 {
		s.logger.Info("route sync complete", zap.Int("newRoutes", total))
	}
	return total
}

// StartPeriodicSync starts background route synchronization.
// Returns a stop function.
func (s *Syncer) StartPeriodicSync(ctx context.Context, r *gin.Engine, interval time.Duration) func() {
	ctx, cancel := context.WithCancel(ctx)

	// Initial sync
	s.SyncOnce(ctx, r)

	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				s.SyncOnce(ctx, r)
			}
		}
	}()

	return cancel
}
